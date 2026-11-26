package com.wikiaov.patch.internal.release.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.internal.application.PatchCommands.Release;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.domain.PatchReleaseStatus;
import com.wikiaov.patch.internal.domain.PatchVariantStatus;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseStore;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseStore.VariantSnapshot;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.patch.internal.season.application.RankedSeasons;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Release use cases invoked within PatchAuthoring's authorization and transaction boundary. */
@Component
public class PatchReleaseWorkflow {
    private final PatchReleaseStore releases;
    private final RankedSeasons seasons;
    private final Clock clock;
    private final CurrentActor actors;
    private final AuditLog audit;

    PatchReleaseWorkflow(PatchReleaseStore releases, RankedSeasons seasons, Clock clock,
            CurrentActor actors, AuditLog audit) {
        this.releases = releases;
        this.seasons = seasons;
        this.clock = clock;
        this.actors = actors;
        this.audit = audit;
    }

    public UUID schedule(UUID variantId, Release input) {
        // Every release writer acquires the region lock before the ruleset lock.
        if (input.effectiveOn() != null && input.effectiveAt() == null) {
            releases.lockRegion(input.regionId());
        } else {
            releases.lockActiveRegion(input.regionId());
        }
        var selectedVariant = releases.lockVariantWithinRuleset(variantId);
        UUID seasonId = resolveReleaseSeason(selectedVariant, input.seasonId());
        requireValidAnnouncement(input, seasonId);

        var variant = releases.lockAndReadVariant(variantId);
        requirePublished(variant, "Publish the variant before scheduling a release.");
        if (input.effectiveAt() != null) {
            requireConsistentTimeline(input.regionId(), variant, input.effectiveAt());
        }

        var release = createRelease(variantId, input, seasonId);
        releases.insert(release);
        record("PATCH_RELEASE_SCHEDULED", release.getId());
        return release.getId();
    }

    public void confirm(UUID releaseId) {
        var target = releases.releaseTarget(releaseId);
        var region = releases.lockRegion(target.regionId());
        requireAvailableRegion(region);
        var variant = releases.readVariantAfterLockingRuleset(target.variantId());
        var release = releases.lockRelease(releaseId);
        if (release.getConfirmedAt() != null) {
            return;
        }

        requireDateOnlyDraft(release);
        var now = clock.instant();
        requireAnnouncedDateReached(release, region, now);
        requirePublished(variant, "Publish the variant before confirming its release.");
        var appliedAt = activationInstant(release, region, now);
        seasons.requireRelease(release.getSeasonId(), target.regionId(), appliedAt);
        requireConsistentTimeline(target.regionId(), variant, appliedAt);

        markApplied(release, appliedAt);
        record("PATCH_RELEASE_CONFIRMED", releaseId);
    }

    /**
     * Moves the releases of a patch that just joined a season into that season. The caller holds the ruleset and
     * variant locks; every release that is not cancelled must be unseasoned or already in the season and fall within
     * its market's schedule of that season.
     */
    public void adoptSeason(UUID variantId, UUID seasonId) {
        for (var release : releases.lockVariantReleases(variantId)) {
            if (release.getStatus() == PatchReleaseStatus.CANCELLED) {
                continue;
            }
            if (release.getSeasonId() != null && !release.getSeasonId().equals(seasonId)) {
                throw invalid("A release of this patch belongs to another season.");
            }
            if (release.getEffectiveOn() != null) {
                seasons.requireReleaseDate(seasonId, release.getRegionId(), release.getEffectiveOn());
            } else {
                seasons.requireRelease(seasonId, release.getRegionId(), release.getEffectiveAt());
            }

            release.setSeasonId(seasonId);
        }
    }

    private UUID resolveReleaseSeason(PatchVariant variant, UUID requestedSeason) {
        UUID seasonId = variant.getSeasonId() == null ? requestedSeason : variant.getSeasonId();
        if (requestedSeason != null && !requestedSeason.equals(seasonId)) {
            throw invalid("The release season must match its patch season.");
        }
        return seasonId;
    }

    private void requireValidAnnouncement(Release input, UUID seasonId) {
        if ((input.effectiveAt() == null) == (input.effectiveOn() == null)) {
            throw invalid("Provide either an exact timestamp or a calendar date.");
        }
        if (input.effectiveAt() != null) {
            seasons.requireRelease(seasonId, input.regionId(), input.effectiveAt());
        } else {
            seasons.requireReleaseDate(seasonId, input.regionId(), input.effectiveOn());
        }
        if (input.sourceUrl() != null && !input.sourceUrl().matches("https?://\\S+")) {
            throw invalid("Source URL must use HTTP or HTTPS.");
        }
    }

    private void requireConsistentTimeline(UUID regionId, VariantSnapshot variant, Instant effectiveAt) {
        if (!releases.regionUsesRulesetAt(regionId, variant.rulesetId(), effectiveAt)) {
            throw invalid("The region does not use this ruleset at the release time.");
        }
        if (releases.contradictsTimeline(regionId, variant, effectiveAt)) {
            throw invalid("The release would contradict the region patch timeline.");
        }
    }

    private static void requireAvailableRegion(Region region) {
        if (!region.isAvailable()) {
            throw invalid("The market is unavailable.");
        }
    }

    private static void requireDateOnlyDraft(PatchRelease release) {
        if (release.getEffectiveOn() == null || release.getStatus() != PatchReleaseStatus.DRAFT) {
            throw invalid("Only a date-only release awaiting confirmation can be confirmed.");
        }
    }

    private static void requireAnnouncedDateReached(PatchRelease release, Region region, Instant now) {
        var localToday = now.atZone(ZoneId.of(region.getTimezone())).toLocalDate();
        if (release.getEffectiveOn().isAfter(localToday)) {
            throw invalid("A future release cannot be confirmed as applied.");
        }
    }

    /**
     * A release dated today becomes active at the confirmation instant, because the hour it reached the game is not
     * known. A release dated on an earlier day is a historical record: it was already in the game by the end of that
     * day, so it becomes active from the start of that day in the market's time zone. This keeps the order of past
     * patches, so a season archive can be confirmed after the fact.
     */
    private static Instant activationInstant(PatchRelease release, Region region, Instant now) {
        var zone = ZoneId.of(region.getTimezone());
        if (release.getEffectiveOn().isBefore(now.atZone(zone).toLocalDate())) {
            return release.getEffectiveOn().atStartOfDay(zone).toInstant();
        }
        return now;
    }

    private static void requirePublished(VariantSnapshot variant, String detail) {
        if (variant.status() != PatchVariantStatus.PUBLISHED) {
            throw invalid(detail);
        }
    }

    private PatchRelease createRelease(UUID variantId, Release input, UUID seasonId) {
        var release = new PatchRelease();
        release.setId(UUID.randomUUID());
        release.setPatchVariantId(variantId);
        release.setRegionId(input.regionId());
        release.setEffectiveAt(input.effectiveAt());
        release.setAnnouncedAt(input.announcedAt());
        release.setEffectiveOn(input.effectiveOn());
        release.setStatus(input.effectiveAt() == null ? PatchReleaseStatus.DRAFT : PatchReleaseStatus.SCHEDULED);
        release.setSourceUrl(input.sourceUrl());
        release.setCreatedAt(clock.instant());
        release.setSeasonId(seasonId);
        return release;
    }

    private static void markApplied(PatchRelease release, Instant appliedAt) {
        release.setEffectiveAt(appliedAt);
        release.setConfirmedAt(appliedAt);
        release.setStatus(PatchReleaseStatus.SCHEDULED);
    }

    private void record(String action, UUID releaseId) {
        audit.record(AuditEntry.of(actors.require(), action, CatalogAggregates.PATCH, releaseId));
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }
}
