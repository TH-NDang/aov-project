package com.wikiaov.patch.internal.watch.domain;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Objects;

/**
 * When a source is read. A daily time is a wall-clock time in the watch's zone (Vietnam), so 08:00 stays 08:00 there.
 *
 * @param mode       once a day or every few hours
 * @param dailyAt    the time of day for {@link PatchNoteScheduleMode#DAILY}, kept for the other mode too
 * @param everyHours the gap for {@link PatchNoteScheduleMode#EVERY_HOURS}, kept for the other mode too
 */
public record PatchNoteSchedule(
        PatchNoteScheduleMode mode,
        LocalTime dailyAt,
        int everyHours
) {

    public static final LocalTime DEFAULT_TIME = LocalTime.of(8, 0);
    public static final int MIN_HOURS = 1;
    public static final int MAX_HOURS = 24;
    public static final int DEFAULT_HOURS = 6;
    public static final PatchNoteSchedule DEFAULT = new PatchNoteSchedule(PatchNoteScheduleMode.DAILY, DEFAULT_TIME,
            DEFAULT_HOURS);

    public PatchNoteSchedule {
        Objects.requireNonNull(mode, "mode");
        Objects.requireNonNull(dailyAt, "dailyAt");
        dailyAt = dailyAt.truncatedTo(ChronoUnit.MINUTES);
    }

    public static boolean validHours(int hours) {
        return hours >= MIN_HOURS && hours <= MAX_HOURS;
    }

    /** The first reading time strictly after {@code now}. */
    public Instant next(Instant now, ZoneId zone) {
        if (mode == PatchNoteScheduleMode.EVERY_HOURS) {
            return now.plus(Duration.ofHours(everyHours));
        }
        ZonedDateTime local = now.atZone(zone);
        ZonedDateTime today = local.toLocalDate().atTime(dailyAt).atZone(zone);
        return today.isAfter(local) ? today.toInstant() : today.plusDays(1).toInstant();
    }
}
