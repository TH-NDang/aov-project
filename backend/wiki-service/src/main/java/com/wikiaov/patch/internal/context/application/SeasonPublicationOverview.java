package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.internal.application.response.PublicationOverviewView.SeasonScheduleView;
import com.wikiaov.patch.internal.application.response.PublicationOverviewView.SeasonView;
import com.wikiaov.patch.internal.season.persistence.RankedSeasonRepository;
import com.wikiaov.patch.internal.season.persistence.SeasonScheduleRepository;
import com.wikiaov.patch.internal.season.persistence.entity.RankedSeason;
import com.wikiaov.patch.internal.season.persistence.entity.SeasonSchedule;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

/** Reads the shared seasons and renders market schedules without inventing timestamp precision. */
@Component
class SeasonPublicationOverview {
    private final RankedSeasonRepository seasons;
    private final SeasonScheduleRepository schedules;

    SeasonPublicationOverview(RankedSeasonRepository seasons, SeasonScheduleRepository schedules) {
        this.seasons = seasons;
        this.schedules = schedules;
    }

    record Calendar(
            List<RankedSeason> seasons,
            List<SeasonSchedule> schedules
    ) {
    }

    Calendar readCalendar() {
        return new Calendar(seasons.findAll(), schedules.findAll());
    }

    List<SeasonView> seasons(Calendar calendar) {
        return calendar.seasons().stream().sorted(Comparator.comparingLong(RankedSeason::getOrdinal).reversed())
                .map(season -> new SeasonView(season.getId(), season.getCode(), season.getDisplayName(),
                        season.getOrdinal()))
                .toList();
    }

    List<SeasonScheduleView> schedules(Calendar calendar, Instant now) {
        return calendar.schedules().stream().map(schedule -> new SeasonScheduleView(schedule.getId(),
                schedule.getSeasonId(), schedule.getRegionId(),
                schedule.getStartsOn() == null ? schedule.getStartsAt() : null,
                schedule.getEndsOn() == null ? schedule.getEndsAt() : null,
                schedule.getStartsOn(), schedule.getEndsOn(), phase(schedule, now))).toList();
    }

    private static String phase(SeasonSchedule schedule, Instant now) {
        if (schedule.getStartsOn() != null || schedule.getEndsOn() != null || schedule.getEndsAt() == null)
            return "RECORDED";
        if (now.isBefore(schedule.getStartsAt()))
            return "UPCOMING";
        return now.isBefore(schedule.getEndsAt()) ? "CURRENT" : "ENDED";
    }
}
