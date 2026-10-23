package com.wikiaov.patch.internal.season.application;

import com.wikiaov.access.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.season.domain.SeasonCalendarRules;
import com.wikiaov.patch.internal.season.domain.SeasonCalendarRules.InvalidCalendar;
import com.wikiaov.patch.internal.season.domain.SeasonCalendarRules.Window;
import com.wikiaov.patch.internal.season.persistence.RankedSeasonRepository;
import com.wikiaov.patch.internal.season.persistence.SeasonOrderLock;
import com.wikiaov.patch.internal.season.persistence.SeasonScheduleRepository;
import com.wikiaov.patch.internal.season.persistence.entity.RankedSeason;
import com.wikiaov.patch.internal.season.persistence.entity.SeasonSchedule;
import com.wikiaov.platform.ApiException;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RankedSeasons {
    private final RankedSeasonRepository seasons;
    private final SeasonScheduleRepository schedules;
    private final SeasonOrderLock orderLock;
    private final RegionRepository regions;
    private final PatchReleaseRepository releases;
    private final AuditLog audit;
    private final CurrentActor actors;

    public RankedSeasons(RankedSeasonRepository seasons, SeasonScheduleRepository schedules,
            SeasonOrderLock orderLock, RegionRepository regions, PatchReleaseRepository releases,
            AuditLog audit, CurrentActor actors) {
        this.seasons = seasons;
        this.schedules = schedules;
        this.orderLock = orderLock;
        this.regions = regions;
        this.releases = releases;
        this.audit = audit;
        this.actors = actors;
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "com.wikiaov.patch.internal.application.service.RankedSeasons.Input")
    public record Input(
            @NotBlank @Size(max = 64) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotBlank @Size(max = 120) String displayName,
            @Min(2000) @Max(9999) Integer seasonYear,
            @Positive Integer seasonNumber,
            UUID beforeSeasonId
    ) {
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "com.wikiaov.patch.internal.application.service.RankedSeasons.View")
    public record View(
            UUID id,
            String code,
            String displayName,
            Integer seasonYear,
            Integer seasonNumber,
            long ordinal
    ) {
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "com.wikiaov.patch.internal.application.service.RankedSeasons.ScheduleInput")
    public record ScheduleInput(
            @NotNull UUID regionId,
            Instant startsAt,
            Instant endsAt,
            java.time.LocalDate startsOn,
            java.time.LocalDate endsOn
    ) {
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('catalog:read')")
    public List<View> list() {
        return seasons.findAllByOrderByOrdinalDesc().stream().map(this::view).toList();
    }

    @Transactional
    @PreAuthorize("hasAuthority('patch:write')")
    public View create(Input input) {
        orderLock.acquire();
        long ordinal = reserveOrdinal(input.beforeSeasonId());
        var s = new RankedSeason();
        s.setId(UUID.randomUUID());
        s.setCode(input.code());
        s.setDisplayName(input.displayName());
        s.setSeasonYear(input.seasonYear());
        s.setSeasonNumber(input.seasonNumber());
        s.setOrdinal(ordinal);
        try {
            seasons.saveAndFlush(s);
        } catch (DataIntegrityViolationException e) {
            throw conflict();
        }
        audit.record(AuditEntry.of(actors.require(), "RANKED_SEASON_CREATED", "RANKED_SEASON", s.getId()));
        return view(s);
    }

    @Transactional
    @PreAuthorize("hasAuthority('patch:write')")
    public UUID schedule(UUID seasonId, ScheduleInput input) {
        var season = require(seasonId);
        var region = regions.lockById(input.regionId()).orElseThrow(() -> invalid("Market not found."));
        Window window;
        try {
            window = SeasonCalendarRules.resolve(input.startsAt(), input.endsAt(), input.startsOn(), input.endsOn(),
                    region.getTimezone());
            var zone = ZoneId.of(region.getTimezone());
            requireCompatibleSchedules(season, input.regionId(), window);
            requireIncludesReleases(seasonId, input.regionId(), window, zone);
        } catch (InvalidCalendar violation) {
            throw calendarError(violation);
        }
        var schedule = writeSchedule(seasonId, input, window);
        audit.record(AuditEntry.of(actors.require(), "SEASON_SCHEDULE_CREATED", "RANKED_SEASON", seasonId));
        return schedule.getId();
    }

    private long reserveOrdinal(UUID beforeSeasonId) {
        var ordered = seasons.findAllByOrderByOrdinalDesc();
        long appendOrdinal = ordered.isEmpty() ? 1 : Math.addExact(ordered.getFirst().getOrdinal(), 1);
        if (beforeSeasonId == null)
            return appendOrdinal;
        long ordinal = require(beforeSeasonId).getOrdinal();
        for (var existing : ordered) {
            if (existing.getOrdinal() >= ordinal) {
                existing.setOrdinal(Math.addExact(existing.getOrdinal(), 1));
                seasons.flush();
            }
        }
        return ordinal;
    }

    private void requireCompatibleSchedules(RankedSeason season, UUID regionId, Window window) {
        for (var existing : schedules.findAll()) {
            if (!existing.getRegionId().equals(regionId) || existing.getSeasonId().equals(season.getId()))
                continue;
            long order = require(existing.getSeasonId()).getOrdinal();
            window.requireSeasonOrder(season.getOrdinal(), order, existing.getStartsAt(), existing.getEndsAt());
        }
    }

    private void requireIncludesReleases(UUID seasonId, UUID regionId, Window window, ZoneId zone) {
        for (var release : releases.findBySeasonIdAndRegionId(seasonId, regionId)) {
            if ("CANCELLED".equals(release.getStatus()))
                continue;
            window.requireIncludesRelease(release.getEffectiveAt(), release.getEffectiveOn(), zone);
        }
    }

    private SeasonSchedule writeSchedule(UUID seasonId, ScheduleInput input, Window window) {
        var s = schedules.findBySeasonIdAndRegionId(seasonId, input.regionId()).orElseGet(() -> {
            var created = new SeasonSchedule();
            created.setId(UUID.randomUUID());
            return created;
        });
        s.setSeasonId(seasonId);
        s.setRegionId(input.regionId());
        s.setStartsAt(window.start());
        s.setEndsAt(window.end());
        s.setStartsOn(input.startsOn());
        s.setEndsOn(input.endsOn());
        try {
            schedules.saveAndFlush(s);
        } catch (DataIntegrityViolationException e) {
            throw conflict();
        }
        return s;
    }

    public RankedSeason require(UUID id) {
        return seasons.findById(id)
                .orElseThrow(() -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "Season not found."));
    }

    public void requireRelease(UUID seasonId, UUID regionId, Instant time) {
        if (seasonId == null)
            return;
        var schedule = schedules.findBySeasonIdAndRegionId(seasonId, regionId)
                .orElse(null);
        if (schedule == null)
            return;
        if (time.isBefore(schedule.getStartsAt())
                || (schedule.getEndsAt() != null && !time.isBefore(schedule.getEndsAt())))
            throw invalid("The release must be within the market season schedule.");
    }

    public void requireReleaseDate(UUID seasonId, UUID regionId, java.time.LocalDate date) {
        if (seasonId == null)
            return;
        var schedule = schedules.findBySeasonIdAndRegionId(seasonId, regionId)
                .orElse(null);
        if (schedule == null)
            return;
        var region = regions.findById(regionId).orElse(null);
        var zone = java.time.ZoneId.of(region.getTimezone());
        if ((schedule.getEndsAt() != null && !date.atStartOfDay(zone).toInstant().isBefore(schedule.getEndsAt()))
                || !date.plusDays(1).atStartOfDay(zone).toInstant().isAfter(schedule.getStartsAt()))
            throw invalid("The release date must overlap its market season.");
    }

    private View view(RankedSeason s) {
        return new View(s.getId(), s.getCode(), s.getDisplayName(), s.getSeasonYear(), s.getSeasonNumber(),
                s.getOrdinal());
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }

    private static ApiException calendarError(InvalidCalendar violation) {
        return switch (violation.violation()) {
            case INVALID_PRECISION ->
                invalid("Provide a start date or timestamp, and at most one end date or timestamp.");
            case INVALID_END -> invalid("Season end must follow its start.");
            case INCONSISTENT_ORDER -> invalid("The market schedule contradicts the shared season order.");
            case OVERLAPPING_SEASONS -> conflict();
            case EXCLUDED_RELEASE -> invalid("The season schedule must include its recorded patch releases.");
        };
    }

    private static ApiException conflict() {
        return new ApiException(PatchErrorCode.PATCH_CONFLICT,
                "Season code or market schedule conflicts with existing data.");
    }
}
