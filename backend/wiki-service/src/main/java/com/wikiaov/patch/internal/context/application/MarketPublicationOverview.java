package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.internal.application.response.PublicationOverviewView.AssignmentView;
import com.wikiaov.patch.internal.application.response.PublicationOverviewView.Market;
import com.wikiaov.patch.internal.application.response.PublicationOverviewView.RulesetView;
import com.wikiaov.patch.internal.context.application.PatchPublicationOverview.Timeline;
import com.wikiaov.patch.internal.context.application.SeasonPublicationOverview.Calendar;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RulesetAssignmentRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.GameplayRuleset;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.patch.internal.ruleset.persistence.entity.RulesetAssignment;
import com.wikiaov.patch.internal.season.persistence.entity.SeasonSchedule;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Resolves each market's current ruleset, season and verified release for the overview. */
@Component
class MarketPublicationOverview {
    private final RegionRepository regions;
    private final GameplayRulesetRepository rulesets;
    private final RulesetAssignmentRepository assignments;

    MarketPublicationOverview(RegionRepository regions, GameplayRulesetRepository rulesets,
            RulesetAssignmentRepository assignments) {
        this.regions = regions;
        this.rulesets = rulesets;
        this.assignments = assignments;
    }

    record Rules(
            List<GameplayRuleset> rulesets,
            Set<UUID> activeRulesets,
            List<RulesetAssignment> assignments
    ) {
    }

    Rules readRules() {
        var allRulesets = rulesets.findAll();
        var activeRulesets = allRulesets.stream().filter(ruleset -> "ACTIVE".equals(ruleset.getLifecycleState()))
                .map(GameplayRuleset::getId).collect(Collectors.toSet());
        return new Rules(allRulesets, activeRulesets, assignments.findAll());
    }

    List<Market> current(Rules rules, Calendar calendar, Timeline timeline, Instant now) {
        return regions.findAllByOrderBySortOrderAscCodeAsc().stream()
                .map(region -> market(region, rules, calendar, timeline, now)).toList();
    }

    List<RulesetView> rulesets(Rules rules) {
        return rules.rulesets().stream().sorted(Comparator.comparing(GameplayRuleset::getCode))
                .map(ruleset -> new RulesetView(ruleset.getId(), ruleset.getCode(), ruleset.getDescription())).toList();
    }

    List<AssignmentView> assignments(Rules rules) {
        return rules.assignments().stream().map(assignment -> new AssignmentView(assignment.getId(),
                assignment.getRegionId(), assignment.getRulesetId(), assignment.getValidFrom(),
                assignment.getValidTo()))
                .toList();
    }

    private static Market market(Region region, Rules rules, Calendar calendar, Timeline timeline, Instant now) {
        var assignment = currentAssignment(region, rules, now);
        var schedule = currentExactSchedule(region, calendar, now);
        var release = currentRelease(region, assignment, timeline, now);
        UUID currentSeason = releaseSeason(release, timeline);
        if (currentSeason == null && schedule != null)
            currentSeason = schedule.getSeasonId();
        return new Market(region.getId(), region.getCode(), region.getDisplayName(), region.isAvailable(),
                assignment == null ? null : assignment.getRulesetId(), currentSeason,
                release == null ? null : release.getId());
    }

    private static RulesetAssignment currentAssignment(Region region, Rules rules, Instant now) {
        return rules.assignments().stream().filter(assignment -> assignment.getRegionId().equals(region.getId())
                && rules.activeRulesets().contains(assignment.getRulesetId()) && !assignment.getValidFrom().isAfter(now)
                && (assignment.getValidTo() == null || now.isBefore(assignment.getValidTo()))).findFirst().orElse(null);
    }

    private static SeasonSchedule currentExactSchedule(Region region, Calendar calendar, Instant now) {
        return calendar.schedules().stream().filter(schedule -> schedule.getRegionId().equals(region.getId())
                && schedule.getStartsOn() == null && schedule.getEndsOn() == null && schedule.getEndsAt() != null
                && !schedule.getStartsAt().isAfter(now) && now.isBefore(schedule.getEndsAt())).findFirst().orElse(null);
    }

    private static PatchRelease currentRelease(Region region, RulesetAssignment assignment, Timeline timeline,
            Instant now) {
        return timeline.releases().stream().filter(release -> {
            var variant = timeline.variantsById().get(release.getPatchVariantId());
            return region.isAvailable() && assignment != null && release.getRegionId().equals(region.getId())
                    && "SCHEDULED".equals(release.getStatus()) && !release.getEffectiveAt().isAfter(now)
                    && variant != null && variant.getRulesetId().equals(assignment.getRulesetId())
                    && "PUBLISHED".equals(variant.getStatus())
                    && "PUBLISHED".equals(timeline.patchesById().get(variant.getPatchId()).getStatus());
        }).max(Comparator.comparing(PatchRelease::getEffectiveAt)).orElse(null);
    }

    private static UUID releaseSeason(PatchRelease release, Timeline timeline) {
        if (release == null)
            return null;
        return release.getSeasonId() != null
                ? release.getSeasonId()
                : timeline.variantsById().get(release.getPatchVariantId()).getSeasonId();
    }
}
