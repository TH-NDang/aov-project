package com.wikiaov.patch.internal.application.service;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.internal.application.PatchCommands.Release;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.PatchReleaseStore;
import com.wikiaov.patch.internal.persistence.PatchReleaseStore.VariantSnapshot;
import com.wikiaov.patch.internal.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.persistence.entity.Region;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Release use cases invoked within PatchAuthoring's authorization and transaction boundary. */
@Component
class PatchReleaseWorkflow {
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

    UUID schedule(UUID variantId, Release input) {
        // Every release writer acquires the region lock before the ruleset lock.
        releases.lockActiveRegion(input.regionId());
        var selectedVariant = releases.lockVariantWithinRuleset(variantId);
        UUID seasonId = resolveReleaseSeason(selectedVariant, input.seasonId());
        requireValidAnnouncement(input, seasonId);

        var variant = releases.lockAndReadVariant(variantId);
        requirePublished(variant, "Publish the variant before scheduling a release.");
        if (input.effectiveAt() != null)
            requireConsistentTimeline(input.regionId(), variant, input.effectiveAt());

        var release = createRelease(variantId, input, seasonId);
        releases.insert(release);
        record("PATCH_RELEASE_SCHEDULED", release.getId());
        return release.getId();
    }

    void confirm(UUID releaseId) {
        var target = releases.releaseTarget(releaseId);
        var region = releases.lockRegion(target.regionId());
        requireAvailableRegion(region);
        var variant = releases.readVariantAfterLockingRuleset(target.variantId());
        var release = releases.lockRelease(releaseId);
        if (release.getConfirmedAt() != null)
            return;

        requireDateOnlyDraft(release);
        var now = clock.instant();
        requireAnnouncedDateReached(release, region, now);
        requirePublished(variant, "Publish the variant before confirming its release.");
        seasons.requireRelease(release.getSeasonId(), target.regionId(), now);
        requireConsistentTimeline(target.regionId(), variant, now);

        markApplied(release, now);
        record("PATCH_RELEASE_CONFIRMED", releaseId);
    }

    private UUID resolveReleaseSeason(PatchVariant variant, UUID requestedSeason) {
        UUID seasonId = variant.getSeasonId() == null ? requestedSeason : variant.getSeasonId();
        if (requestedSeason != null && !requestedSeason.equals(seasonId))
            throw invalid("The release season must match its patch season.");
        return seasonId;
    }

    private void requireValidAnnouncement(Release input, UUID seasonId) {
        if ((input.effectiveAt() == null) == (input.effectiveOn() == null))
            throw invalid("Provide either an exact timestamp or a calendar date.");
        if (input.effectiveAt() != null)
            seasons.requireRelease(seasonId, input.regionId(), input.effectiveAt());
        else
            seasons.requireReleaseDate(seasonId, input.regionId(), input.effectiveOn());
        if (input.sourceUrl() != null && !input.sourceUrl().matches("https?://[^\s]+"))
            throw invalid("Source URL must use HTTP or HTTPS.");
    }

    private void requireConsistentTimeline(UUID regionId, VariantSnapshot variant, Instant effectiveAt) {
        if (!releases.regionUsesRulesetAt(regionId, variant.rulesetId(), effectiveAt))
            throw invalid("The region does not use this ruleset at the release time.");
        if (releases.contradictsTimeline(regionId, variant, effectiveAt))
            throw invalid("The release would contradict the region patch timeline.");
    }

    private static void requireAvailableRegion(Region region) {
        if (!region.isAvailable())
            throw invalid("The market is unavailable.");
    }

    private static void requireDateOnlyDraft(PatchRelease release) {
        if (release.getEffectiveOn() == null || !"DRAFT".equals(release.getStatus()))
            throw invalid("Only a date-only release awaiting confirmation can be confirmed.");
    }

    private static void requireAnnouncedDateReached(PatchRelease release, Region region, Instant now) {
        var localToday = now.atZone(ZoneId.of(region.getTimezone())).toLocalDate();
        if (release.getEffectiveOn().isAfter(localToday))
            throw invalid("A future release cannot be confirmed as applied.");
    }

    private static void requirePublished(VariantSnapshot variant, String detail) {
        if (!"PUBLISHED".equals(variant.status()))
            throw invalid(detail);
    }

    private PatchRelease createRelease(UUID variantId, Release input, UUID seasonId) {
        var release = new PatchRelease();
        release.setId(UUID.randomUUID());
        release.setPatchVariantId(variantId);
        release.setRegionId(input.regionId());
        release.setEffectiveAt(input.effectiveAt());
        release.setAnnouncedAt(input.announcedAt());
        release.setEffectiveOn(input.effectiveOn());
        release.setStatus(input.effectiveAt() == null ? "DRAFT" : "SCHEDULED");
        release.setSourceUrl(input.sourceUrl());
        release.setCreatedAt(clock.instant());
        release.setSeasonId(seasonId);
        return release;
    }

    private static void markApplied(PatchRelease release, Instant now) {
        release.setEffectiveAt(now);
        release.setConfirmedAt(now);
        release.setStatus("SCHEDULED");
    }

    private void record(String action, UUID releaseId) {
        audit.record(AuditEntry.of(actors.require(), action, "PATCH", releaseId));
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }
}
