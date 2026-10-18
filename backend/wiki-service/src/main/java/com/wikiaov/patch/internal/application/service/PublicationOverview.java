package com.wikiaov.patch.internal.application.service;

import com.wikiaov.patch.internal.application.response.PublicationOverviewView.*;
import com.wikiaov.patch.internal.persistence.*;
import com.wikiaov.patch.internal.persistence.entity.*;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PublicationOverview {
    private final RegionRepository regions;
    private final GameplayRulesetRepository rulesets;
    private final RulesetAssignmentRepository assignments;
    private final RankedSeasonRepository seasons;
    private final SeasonScheduleRepository schedules;
    private final GamePatchRepository patches;
    private final PatchVariantRepository variants;
    private final PatchReleaseRepository releases;
    private final Clock clock;

    public PublicationOverview(RegionRepository regions, GameplayRulesetRepository rulesets,
            RulesetAssignmentRepository assignments, RankedSeasonRepository seasons, SeasonScheduleRepository schedules,
            GamePatchRepository patches,
            PatchVariantRepository variants, PatchReleaseRepository releases, Clock clock) {
        this.regions = regions;
        this.rulesets = rulesets;
        this.assignments = assignments;
        this.seasons = seasons;
        this.schedules = schedules;
        this.patches = patches;
        this.variants = variants;
        this.releases = releases;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public Snapshot read() {
        var now = clock.instant();
        var allRulesets = rulesets.findAll();
        var activeRulesets = allRulesets.stream().filter(r -> "ACTIVE".equals(r.getLifecycleState()))
                .map(GameplayRuleset::getId).collect(Collectors.toSet());
        var allAssignments = assignments.findAll();
        var allSeasons = seasons.findAll();
        var allSchedules = schedules.findAll();
        var allReleases = releases.findAll();
        var allVariants = variants.findAll();
        var variantById = allVariants.stream().collect(Collectors.toMap(PatchVariant::getId, Function.identity()));
        var patchById = patches.findAll().stream().collect(Collectors.toMap(GamePatch::getId, Function.identity()));
        List<Market> markets = regions.findAllByOrderBySortOrderAscCodeAsc().stream().map(region -> {
            var assignment = allAssignments.stream().filter(a -> a.getRegionId().equals(region.getId())
                    && activeRulesets.contains(a.getRulesetId()) && !a.getValidFrom().isAfter(now)
                    && (a.getValidTo() == null || now.isBefore(a.getValidTo())))
                    .findFirst().orElse(null);
            var season = allSchedules.stream().filter(s -> s.getRegionId().equals(region.getId())
                    && s.getStartsOn() == null && s.getEndsOn() == null && s.getEndsAt() != null
                    && !s.getStartsAt().isAfter(now) && now.isBefore(s.getEndsAt())).findFirst().orElse(null);
            var release = allReleases.stream().filter(r -> {
                var v = variantById.get(r.getPatchVariantId());
                return region.isAvailable() && assignment != null && r.getRegionId().equals(region.getId())
                        && "SCHEDULED".equals(r.getStatus()) && !r.getEffectiveAt().isAfter(now)
                        && v != null && v.getRulesetId().equals(assignment.getRulesetId())
                        && "PUBLISHED".equals(v.getStatus())
                        && "PUBLISHED".equals(patchById.get(v.getPatchId()).getStatus());
            }).max(Comparator.comparing(PatchRelease::getEffectiveAt)).orElse(null);
            return new Market(region.getId(), region.getCode(), region.getDisplayName(), region.isAvailable(),
                    assignment == null ? null : assignment.getRulesetId(), season == null ? null : season.getSeasonId(),
                    release == null ? null : release.getId());
        }).toList();
        Set<UUID> current = markets.stream().map(Market::currentReleaseId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        return new Snapshot(now, markets,
                allRulesets.stream().sorted(Comparator.comparing(GameplayRuleset::getCode))
                        .map(r -> new RulesetView(r.getId(), r.getCode(), r.getDescription())).toList(),
                allAssignments.stream().map(a -> new AssignmentView(a.getId(), a.getRegionId(), a.getRulesetId(),
                        a.getValidFrom(), a.getValidTo())).toList(),
                allSeasons.stream().sorted(Comparator.comparingLong(RankedSeason::getOrdinal).reversed())
                        .map(s -> new SeasonView(s.getId(), s.getCode(), s.getDisplayName(), s.getOrdinal())).toList(),
                allSchedules.stream().map(s -> new SeasonScheduleView(s.getId(), s.getSeasonId(), s.getRegionId(),
                        s.getStartsOn() == null ? s.getStartsAt() : null,
                        s.getEndsOn() == null ? s.getEndsAt() : null,
                        s.getStartsOn(), s.getEndsOn(),
                        s.getStartsOn() != null || s.getEndsOn() != null || s.getEndsAt() == null
                                ? "RECORDED"
                                : now.isBefore(s.getStartsAt())
                                        ? "UPCOMING"
                                        : now.isBefore(s.getEndsAt()) ? "CURRENT" : "ENDED"))
                        .toList(),
                allVariants.stream().sorted(Comparator.comparingLong(PatchVariant::getRulesetOrdinal).reversed())
                        .map(v -> new VariantView(v.getId(), v.getPatchId(), patchById.get(v.getPatchId()).getCode(),
                                v.getRulesetId(), v.getRulesetOrdinal(), v.getSeasonId(), v.getStatus()))
                        .toList(),
                allReleases.stream().sorted(Comparator.comparing(PatchRelease::getCreatedAt).reversed())
                        .map(r -> new ReleaseView(r.getId(), r.getPatchVariantId(), r.getRegionId(), r.getSeasonId(),
                                r.getEffectiveOn() == null ? r.getEffectiveAt() : null, r.getEffectiveOn(),
                                r.getConfirmedAt(), r.getSourceUrl(), r.getStatus(),
                                releasePhase(r, variantById.get(r.getPatchVariantId()),
                                        patchById.get(variantById.get(r.getPatchVariantId()).getPatchId()), current,
                                        now)))
                        .toList());
    }
    private static String releasePhase(PatchRelease release, PatchVariant variant, GamePatch patch,
            Set<UUID> current, Instant now) {
        if (release.getEffectiveOn() != null && "DRAFT".equals(release.getStatus()))
            return "AWAITING_CONFIRMATION";
        if (!"SCHEDULED".equals(release.getStatus()))
            return release.getStatus();
        if (!"PUBLISHED".equals(variant.getStatus()) || !"PUBLISHED".equals(patch.getStatus()))
            return "DRAFT";
        if (release.getEffectiveAt().isAfter(now))
            return "UPCOMING";
        return current.contains(release.getId()) ? "CURRENT" : "PAST";
    }

}
