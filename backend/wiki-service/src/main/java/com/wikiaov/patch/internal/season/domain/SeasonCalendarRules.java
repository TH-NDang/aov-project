package com.wikiaov.patch.internal.season.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Calendar precision and ordering rules independent of persistence and API errors. */
public final class SeasonCalendarRules {
    private SeasonCalendarRules() {
    }

    public enum Violation {
        INVALID_PRECISION,
        INVALID_END,
        INCONSISTENT_ORDER,
        OVERLAPPING_SEASONS,
        EXCLUDED_RELEASE
    }

    public static class InvalidCalendar extends RuntimeException {
        private final Violation violation;

        private InvalidCalendar(Violation violation) {
            super(violation.name());
            this.violation = violation;
        }

        public Violation violation() {
            return violation;
        }
    }

    public record Window(
            Instant start,
            Instant end
    ) {
        public void requireSeasonOrder(long selectedOrdinal, long existingOrdinal, Instant existingStart,
                Instant existingEnd) {
            if ((existingOrdinal < selectedOrdinal && !existingStart.isBefore(start))
                    || (existingOrdinal > selectedOrdinal && !existingStart.isAfter(start)))
                throw new InvalidCalendar(Violation.INCONSISTENT_ORDER);
            if ((existingOrdinal < selectedOrdinal && existingEnd != null && existingEnd.isAfter(start))
                    || (existingOrdinal > selectedOrdinal && end != null && end.isAfter(existingStart)))
                throw new InvalidCalendar(Violation.OVERLAPPING_SEASONS);
        }

        public void requireIncludesRelease(Instant effectiveAt, LocalDate effectiveOn, ZoneId zone) {
            var earliest = effectiveOn == null ? effectiveAt : effectiveOn.atStartOfDay(zone).toInstant();
            var latest = effectiveOn == null
                    ? earliest.plusNanos(1)
                    : effectiveOn.plusDays(1).atStartOfDay(zone).toInstant();
            if (!latest.isAfter(start) || (end != null && !earliest.isBefore(end)))
                throw new InvalidCalendar(Violation.EXCLUDED_RELEASE);
        }
    }

    public static Window resolve(Instant startsAt, Instant endsAt, LocalDate startsOn, LocalDate endsOn,
            String timezone) {
        if ((startsAt == null) == (startsOn == null) || (endsAt != null && endsOn != null))
            throw new InvalidCalendar(Violation.INVALID_PRECISION);
        var zone = ZoneId.of(timezone);
        var start = startsAt != null ? startsAt : startsOn.atStartOfDay(zone).toInstant();
        var end = endsAt != null ? endsAt : (endsOn == null ? null : endsOn.plusDays(1).atStartOfDay(zone).toInstant());
        if (end != null && !end.isAfter(start))
            throw new InvalidCalendar(Violation.INVALID_END);
        return new Window(start, end);
    }
}
