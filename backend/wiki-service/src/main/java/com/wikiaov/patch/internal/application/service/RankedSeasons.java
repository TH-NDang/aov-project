package com.wikiaov.patch.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.*;
import com.wikiaov.patch.internal.persistence.entity.*;
import com.wikiaov.platform.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RankedSeasons {
    private final RankedSeasonRepository seasons;
    private final SeasonScheduleRepository schedules;
    private final EntityManager entities;
    private final AuditLog audit;
    private final CurrentActor actors;
    public RankedSeasons(RankedSeasonRepository seasons, SeasonScheduleRepository schedules,
            EntityManager entities, AuditLog audit, CurrentActor actors) {
        this.seasons = seasons;
        this.schedules = schedules;
        this.entities = entities;
        this.audit = audit;
        this.actors = actors;
    }
    public record Input(
            @NotBlank @Size(max = 64) @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String code,
            @NotBlank @Size(max = 120) String displayName,
            @Min(2000) @Max(9999) Integer seasonYear,
            @Positive Integer seasonNumber,
            UUID beforeSeasonId
    ) {
    }
    public record View(
            UUID id,
            String code,
            String displayName,
            Integer seasonYear,
            Integer seasonNumber,
            long ordinal
    ) {
    }
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
        // Serialize insertion into the global season order, including the empty-table case.
        entities.createNativeQuery("LOCK TABLE patch.ranked_season IN EXCLUSIVE MODE").executeUpdate();
        var ordered = seasons.findAllByOrderByOrdinalDesc();
        long ordinal = ordered.isEmpty() ? 1 : Math.addExact(ordered.getFirst().getOrdinal(), 1);
        if (input.beforeSeasonId() != null) {
            ordinal = require(input.beforeSeasonId()).getOrdinal();
            for (var existing : ordered) {
                if (existing.getOrdinal() >= ordinal) {
                    existing.setOrdinal(Math.addExact(existing.getOrdinal(), 1));
                    seasons.flush();
                }
            }
        }
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
        var region = entities.find(Region.class, input.regionId(), jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (region == null)
            throw invalid("Market not found.");
        if ((input.startsAt() == null) == (input.startsOn() == null)
                || (input.endsAt() != null && input.endsOn() != null))
            throw invalid("Provide a start date or timestamp, and at most one end date or timestamp.");
        var zone = java.time.ZoneId.of(region.getTimezone());
        var start = input.startsAt() != null ? input.startsAt() : input.startsOn().atStartOfDay(zone).toInstant();
        var end = input.endsAt() != null
                ? input.endsAt()
                : (input.endsOn() == null ? null : input.endsOn().plusDays(1).atStartOfDay(zone).toInstant());
        if (end != null && !end.isAfter(start))
            throw invalid("Season end must follow its start.");
        for (var existing : schedules.findAll()) {
            if (!existing.getRegionId().equals(input.regionId()) || existing.getSeasonId().equals(seasonId))
                continue;
            long order = require(existing.getSeasonId()).getOrdinal();
            if ((order < season.getOrdinal() && !existing.getStartsAt().isBefore(start))
                    || (order > season.getOrdinal() && !existing.getStartsAt().isAfter(start)))
                throw invalid("The market schedule contradicts the shared season order.");
            if ((order < season.getOrdinal() && existing.getEndsAt() != null && existing.getEndsAt().isAfter(start))
                    || (order > season.getOrdinal() && end != null && end.isAfter(existing.getStartsAt())))
                throw conflict();
        }
        for (var release : entities.createQuery(
                "select r from PatchRelease r where r.seasonId = :season and r.regionId = :region", PatchRelease.class)
                .setParameter("season", seasonId).setParameter("region", input.regionId()).getResultList()) {
            if ("CANCELLED".equals(release.getStatus()))
                continue;
            var earliest = release.getEffectiveOn() == null
                    ? release.getEffectiveAt()
                    : release.getEffectiveOn().atStartOfDay(zone).toInstant();
            var latest = release.getEffectiveOn() == null
                    ? earliest.plusNanos(1)
                    : release.getEffectiveOn().plusDays(1).atStartOfDay(zone).toInstant();
            if (!latest.isAfter(start) || (end != null && !earliest.isBefore(end)))
                throw invalid("The season schedule must include its recorded patch releases.");
        }
        var s = schedules.findBySeasonIdAndRegionId(seasonId, input.regionId()).orElseGet(() -> {
            var created = new SeasonSchedule();
            created.setId(UUID.randomUUID());
            return created;
        });
        s.setSeasonId(seasonId);
        s.setRegionId(input.regionId());
        s.setStartsAt(start);
        s.setEndsAt(end);
        s.setStartsOn(input.startsOn());
        s.setEndsOn(input.endsOn());
        try {
            schedules.saveAndFlush(s);
        } catch (DataIntegrityViolationException e) {
            throw conflict();
        }
        audit.record(AuditEntry.of(actors.require(), "SEASON_SCHEDULE_CREATED", "RANKED_SEASON", seasonId));
        return s.getId();
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
        var region = entities.find(Region.class, regionId);
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
    private static ApiException conflict() {
        return new ApiException(PatchErrorCode.PATCH_CONFLICT,
                "Season code or market schedule conflicts with existing data.");
    }
}
