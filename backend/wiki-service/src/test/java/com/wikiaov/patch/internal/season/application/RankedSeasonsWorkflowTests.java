package com.wikiaov.patch.internal.season.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseRepository;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.patch.internal.season.persistence.RankedSeasonRepository;
import com.wikiaov.patch.internal.season.persistence.SeasonOrderLock;
import com.wikiaov.patch.internal.season.persistence.SeasonScheduleRepository;
import com.wikiaov.patch.internal.season.persistence.entity.RankedSeason;
import com.wikiaov.patch.internal.season.persistence.entity.SeasonSchedule;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class RankedSeasonsWorkflowTests {
    private final RankedSeasonRepository seasons = mock(RankedSeasonRepository.class);
    private final SeasonScheduleRepository schedules = mock(SeasonScheduleRepository.class);
    private final SeasonOrderLock orderLock = mock(SeasonOrderLock.class);
    private final RegionRepository regions = mock(RegionRepository.class);
    private final PatchReleaseRepository releases = mock(PatchReleaseRepository.class);
    private final AuditLog audit = mock(AuditLog.class);
    private final CurrentActor actors = mock(CurrentActor.class);
    private final RankedSeasons service = new RankedSeasons(seasons, schedules, orderLock, regions, releases, audit,
            actors);
    private final UUID seasonId = UUID.fromString("00000000-0000-4000-8000-000000000001");
    private final UUID regionId = UUID.fromString("00000000-0000-4000-8000-000000000002");

    @BeforeEach
    void prepareActor() {
        when(actors.require()).thenReturn(new Actor("https://issuer.test", "editor", ActorType.HUMAN,
                "Editor", Set.of("patch:write")));
    }

    @Test
    void locksTheGlobalOrderBeforeReadingOrCreatingTheFirstSeason() {
        when(seasons.findAllByOrderByOrdinalDesc()).thenReturn(List.of());

        var result = service.create(new RankedSeasons.Input("s4-2026", "S4 2026", 2026, 4, null));

        assertThat(result.ordinal()).isEqualTo(1);
        var order = inOrder(orderLock, seasons, audit);
        order.verify(orderLock).acquire();
        order.verify(seasons).findAllByOrderByOrdinalDesc();
        order.verify(seasons).saveAndFlush(any(RankedSeason.class));
        order.verify(audit).record(any());
    }

    @Test
    void permitsAnUnknownEndDateAndKeepsTheMarketDatePrecision() {
        prepareCalendar();

        service.schedule(seasonId, new RankedSeasons.ScheduleInput(regionId, null, null,
                LocalDate.of(2026, 9, 29), null));

        var saved = ArgumentCaptor.forClass(SeasonSchedule.class);
        verify(schedules).saveAndFlush(saved.capture());
        assertThat(saved.getValue().getStartsAt()).isEqualTo(Instant.parse("2026-09-28T17:00:00Z"));
        assertThat(saved.getValue().getStartsOn()).isEqualTo(LocalDate.of(2026, 9, 29));
        assertThat(saved.getValue().getEndsAt()).isNull();
        assertThat(saved.getValue().getEndsOn()).isNull();
        var order = inOrder(regions, schedules, releases);
        order.verify(regions).lockById(regionId);
        order.verify(schedules).findAll();
        order.verify(releases).findBySeasonIdAndRegionId(seasonId, regionId);
        order.verify(schedules).findBySeasonIdAndRegionId(seasonId, regionId);
        order.verify(schedules).saveAndFlush(any());
    }

    @Test
    void treatsAnEndDateAsTheWholeMarketDayAndKeepsTheTimestampBoundaryExclusive() {
        prepareCalendar();
        service.schedule(seasonId, new RankedSeasons.ScheduleInput(regionId, null, null,
                LocalDate.of(2026, 9, 29), LocalDate.of(2026, 10, 12)));
        var saved = ArgumentCaptor.forClass(SeasonSchedule.class);
        verify(schedules).saveAndFlush(saved.capture());
        var schedule = saved.getValue();
        assertThat(schedule.getEndsAt()).isEqualTo(Instant.parse("2026-10-12T17:00:00Z"));
        when(schedules.findBySeasonIdAndRegionId(seasonId, regionId)).thenReturn(Optional.of(schedule));

        service.requireRelease(seasonId, regionId, schedule.getEndsAt().minusNanos(1));
        assertThatThrownBy(() -> service.requireRelease(seasonId, regionId, schedule.getEndsAt()))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_INVALID));
    }

    @Test
    void rejectsACalendarThatWouldExcludeAnExistingReleaseBeforeSaving() {
        prepareCalendar();
        var release = new PatchRelease();
        release.setStatus("PUBLISHED");
        release.setEffectiveOn(LocalDate.of(2026, 9, 28));
        when(releases.findBySeasonIdAndRegionId(seasonId, regionId)).thenReturn(List.of(release));

        assertThatThrownBy(() -> service.schedule(seasonId, new RankedSeasons.ScheduleInput(regionId,
                null, null, LocalDate.of(2026, 9, 29), null)))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_INVALID);
                    assertThat(exception.getMessage())
                            .isEqualTo("The season schedule must include its recorded patch releases.");
                });
        verify(schedules, never()).saveAndFlush(any());
        verifyNoInteractions(audit);
    }

    @Test
    void reportsAMissingMarketBeforeCheckingDateInput() {
        var season = new RankedSeason();
        season.setId(seasonId);
        when(seasons.findById(seasonId)).thenReturn(Optional.of(season));

        assertThatThrownBy(() -> service.schedule(seasonId,
                new RankedSeasons.ScheduleInput(regionId, null, null, null, null)))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getMessage()).isEqualTo("Market not found."));
        verifyNoInteractions(schedules, audit);
    }

    private void prepareCalendar() {
        var season = new RankedSeason();
        season.setId(seasonId);
        season.setOrdinal(4);
        when(seasons.findById(seasonId)).thenReturn(Optional.of(season));
        when(regions.lockById(regionId)).thenReturn(Optional.of(
                new Region(regionId, "VN", "Vietnam", "AOV", "vi-VN", "Asia/Ho_Chi_Minh", true)));
        when(releases.findBySeasonIdAndRegionId(seasonId, regionId)).thenReturn(List.of());
        when(schedules.findAll()).thenReturn(List.of());
        when(schedules.findBySeasonIdAndRegionId(seasonId, regionId)).thenReturn(Optional.empty());
    }
}
