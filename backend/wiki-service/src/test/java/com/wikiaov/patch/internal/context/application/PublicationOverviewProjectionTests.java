package com.wikiaov.patch.internal.context.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.patch.internal.application.response.PublicationOverviewView.ReleaseView;
import com.wikiaov.patch.internal.application.response.PublicationOverviewView.SeasonScheduleView;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchRepository;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatch;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.context.application.PatchPublicationOverview.Timeline;
import com.wikiaov.patch.internal.context.application.SeasonPublicationOverview.Calendar;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseRepository;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.review.persistence.PatchDataReviewRepository;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RulesetAssignmentRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.patch.internal.ruleset.persistence.entity.RulesetAssignment;
import com.wikiaov.patch.internal.season.persistence.RankedSeasonRepository;
import com.wikiaov.patch.internal.season.persistence.SeasonScheduleRepository;
import com.wikiaov.patch.internal.season.persistence.entity.RankedSeason;
import com.wikiaov.patch.internal.season.persistence.entity.SeasonSchedule;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PublicationOverviewProjectionTests {
    private final Instant now = Instant.parse("2026-10-15T00:00:00Z");
    private final UUID regionId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final UUID patchId = UUID.randomUUID();

    @Test
    void keepsScheduleOrderDatePrecisionAndExclusiveTimestampEnds() {
        var renderer = new SeasonPublicationOverview(mock(RankedSeasonRepository.class),
                mock(SeasonScheduleRepository.class));
        var dateOnly = schedule(now.minusSeconds(10), null);
        dateOnly.setStartsOn(LocalDate.of(2026, 10, 14));
        var current = schedule(now, now.plusSeconds(10));
        var ended = schedule(now.minusSeconds(10), now);
        var upcoming = schedule(now.plusSeconds(1), now.plusSeconds(10));
        var calendar = new Calendar(List.of(season(2), season(4)), List.of(dateOnly, current, ended, upcoming));

        var views = renderer.schedules(calendar, now);

        assertThat(views).extracting(SeasonScheduleView::phase)
                .containsExactly("RECORDED", "CURRENT", "ENDED", "UPCOMING");
        assertThat(views.getFirst().startsAt()).isNull();
        assertThat(views.getFirst().startsOn()).isEqualTo(dateOnly.getStartsOn());
        assertThat(views.getFirst().endsAt()).isNull();
        assertThat(views.get(1).startsAt()).isEqualTo(now);
        assertThat(renderer.seasons(calendar)).extracting(value -> value.ordinal()).containsExactly(4L, 2L);
    }

    @Test
    void distinguishesDateAnnouncementsFromCurrentPastUpcomingAndCancelledReleases() {
        var renderer = new PatchPublicationOverview(mock(PatchDataReviewRepository.class),
                mock(PatchReleaseRepository.class), mock(PatchVariantRepository.class),
                mock(GamePatchRepository.class));
        var variant = variant("PUBLISHED");
        var past = release(variant, "SCHEDULED", now.minusSeconds(1), 1);
        var current = release(variant, "SCHEDULED", now, 2);
        var upcoming = release(variant, "SCHEDULED", now.plusSeconds(1), 3);
        var cancelled = release(variant, "CANCELLED", now, 4);
        var announcement = release(variant, "DRAFT", null, 5);
        announcement.setEffectiveOn(LocalDate.of(2026, 10, 15));
        var timeline = timeline(variant, List.of(past, current, upcoming, cancelled, announcement));

        var views = renderer.releases(timeline, Set.of(current.getId()), now);

        assertThat(views).extracting(ReleaseView::phase)
                .containsExactly("AWAITING_CONFIRMATION", "CANCELLED", "UPCOMING", "CURRENT", "PAST");
        assertThat(views.getFirst().effectiveAt()).isNull();
        assertThat(views.getFirst().effectiveOn()).isEqualTo(announcement.getEffectiveOn());
        assertThat(renderer.variants(timeline)).singleElement().satisfies(value -> {
            assertThat(value.dataReviewState()).isEqualTo("IN_PROGRESS");
            assertThat(value.dataReviewVersion()).isZero();
            assertThat(value.dataReviewedAt()).isNull();
        });
    }

    @Test
    void prefersReleaseSeasonThenVariantSeasonAndUsesOnlyExactSchedulesAsFallback() {
        var regions = mock(RegionRepository.class);
        var renderer = new MarketPublicationOverview(regions, mock(GameplayRulesetRepository.class),
                mock(RulesetAssignmentRepository.class));
        when(regions.findAllByOrderBySortOrderAscCodeAsc()).thenReturn(
                List.of(new Region(regionId, "VN", "Vietnam", "AOV", "vi-VN", "Asia/Ho_Chi_Minh", true)));
        var assignment = new RulesetAssignment();
        assignment.setRegionId(regionId);
        assignment.setRulesetId(rulesetId);
        assignment.setValidFrom(now);
        assignment.setValidTo(now.plusSeconds(10));
        var rules = new MarketPublicationOverview.Rules(List.of(), Set.of(rulesetId), List.of(assignment));
        var exact = schedule(now, now.plusSeconds(10));
        var variant = variant("PUBLISHED");
        var release = release(variant, "SCHEDULED", now, 1);
        var recordedSeason = UUID.randomUUID();
        release.setSeasonId(recordedSeason);
        var calendar = new Calendar(List.of(), List.of(exact));
        var timeline = timeline(variant, List.of(release));

        assertThat(renderer.current(rules, calendar, timeline, now).getFirst().currentSeasonId())
                .isEqualTo(recordedSeason);
        release.setSeasonId(null);
        assertThat(renderer.current(rules, calendar, timeline, now).getFirst().currentSeasonId())
                .isEqualTo(variant.getSeasonId());
        release.setStatus("CANCELLED");
        assertThat(renderer.current(rules, calendar, timeline, now).getFirst().currentSeasonId()).isEqualTo(seasonId);
        exact.setStartsOn(LocalDate.of(2026, 10, 15));
        assertThat(renderer.current(rules, calendar, timeline, now).getFirst().currentSeasonId()).isNull();
    }

    @Test
    void excludesExpiredAssignmentsAndUnpublishedVariantsFromTheCurrentMarketRelease() {
        var regions = mock(RegionRepository.class);
        var renderer = new MarketPublicationOverview(regions, mock(GameplayRulesetRepository.class),
                mock(RulesetAssignmentRepository.class));
        when(regions.findAllByOrderBySortOrderAscCodeAsc()).thenReturn(
                List.of(new Region(regionId, "VN", "Vietnam", "AOV", "vi-VN", "Asia/Ho_Chi_Minh", true)));
        var assignment = new RulesetAssignment();
        assignment.setRegionId(regionId);
        assignment.setRulesetId(rulesetId);
        assignment.setValidFrom(now.minusSeconds(1));
        assignment.setValidTo(now);
        var rules = new MarketPublicationOverview.Rules(List.of(), Set.of(rulesetId), List.of(assignment));
        var variant = variant("PUBLISHED");
        var timeline = timeline(variant, List.of(release(variant, "SCHEDULED", now, 1)));
        var emptyCalendar = new Calendar(List.of(), List.of());

        var expired = renderer.current(rules, emptyCalendar, timeline, now).getFirst();
        assertThat(expired.currentRulesetId()).isNull();
        assertThat(expired.currentReleaseId()).isNull();
        assignment.setValidTo(null);
        variant.setStatus("DRAFT");
        var draft = renderer.current(rules, emptyCalendar, timeline, now).getFirst();
        assertThat(draft.currentRulesetId()).isEqualTo(rulesetId);
        assertThat(draft.currentReleaseId()).isNull();
    }

    private SeasonSchedule schedule(Instant startsAt, Instant endsAt) {
        var schedule = new SeasonSchedule();
        schedule.setId(UUID.randomUUID());
        schedule.setRegionId(regionId);
        schedule.setSeasonId(seasonId);
        schedule.setStartsAt(startsAt);
        schedule.setEndsAt(endsAt);
        return schedule;
    }

    private static RankedSeason season(long ordinal) {
        var season = new RankedSeason();
        season.setId(UUID.randomUUID());
        season.setOrdinal(ordinal);
        return season;
    }

    private PatchVariant variant(String status) {
        var variant = new PatchVariant();
        variant.setId(UUID.randomUUID());
        variant.setPatchId(patchId);
        variant.setRulesetId(rulesetId);
        variant.setSeasonId(UUID.randomUUID());
        variant.setStatus(status);
        return variant;
    }

    private PatchRelease release(PatchVariant variant, String status, Instant effectiveAt, int createdOrder) {
        var release = new PatchRelease();
        release.setId(UUID.randomUUID());
        release.setPatchVariantId(variant.getId());
        release.setRegionId(regionId);
        release.setStatus(status);
        release.setEffectiveAt(effectiveAt);
        release.setCreatedAt(now.plusSeconds(createdOrder));
        return release;
    }

    private Timeline timeline(PatchVariant variant, List<PatchRelease> releases) {
        var patch = new GamePatch();
        patch.setId(patchId);
        patch.setStatus("PUBLISHED");
        patch.setCode("fixture");
        return new Timeline(releases, List.of(variant), Map.of(variant.getId(), variant), Map.of(patchId, patch),
                Map.of());
    }
}
