package com.wikiaov.patch.internal.season.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.patch.internal.season.domain.SeasonCalendarRules.InvalidCalendar;
import com.wikiaov.patch.internal.season.domain.SeasonCalendarRules.Violation;
import com.wikiaov.patch.internal.season.domain.SeasonCalendarRules.Window;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class SeasonCalendarRulesTests {
    private final Instant start = Instant.parse("2026-09-28T17:00:00Z");
    private final Instant end = Instant.parse("2026-12-31T17:00:00Z");
    private final ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");

    @Test
    void checksDatePrecisionBeforeResolvingTheMarketTimezone() {
        assertViolation(() -> SeasonCalendarRules.resolve(null, null, null, null, "invalid/timezone"),
                Violation.INVALID_PRECISION);
    }

    @Test
    void keepsCalendarDatesInclusiveAndAnUnknownEndOpen() {
        var window = SeasonCalendarRules.resolve(null, null, LocalDate.of(2026, 9, 29),
                LocalDate.of(2026, 12, 31), zone.getId());
        assertThat(window).isEqualTo(new Window(start, end));
        assertThat(SeasonCalendarRules.resolve(start, null, null, null, zone.getId()).end()).isNull();
    }

    @Test
    void reportsAnOrderContradictionBeforeTheOverlap() {
        var window = new Window(start, end);
        assertViolation(() -> window.requireSeasonOrder(4, 3, start, end), Violation.INCONSISTENT_ORDER);
    }

    @Test
    void acceptsTouchingSeasonBoundariesAndRejectsOverlapsInBothDirections() {
        var window = new Window(start, end);
        window.requireSeasonOrder(4, 3, start.minusSeconds(20), start);
        window.requireSeasonOrder(4, 5, end, null);
        assertViolation(() -> window.requireSeasonOrder(4, 3, start.minusSeconds(20), start.plusNanos(1)),
                Violation.OVERLAPPING_SEASONS);
        assertViolation(() -> window.requireSeasonOrder(4, 5, end.minusNanos(1), null),
                Violation.OVERLAPPING_SEASONS);
    }

    @Test
    void permitsAnyOverlapForADateOnlyReleaseButUsesExclusiveEndForAnExactRelease() {
        var window = new Window(start.plusSeconds(3600), end);
        window.requireIncludesRelease(null, LocalDate.of(2026, 9, 29), zone);
        window.requireIncludesRelease(end.minusNanos(1), null, zone);
        assertViolation(() -> window.requireIncludesRelease(end, null, zone), Violation.EXCLUDED_RELEASE);
        assertViolation(() -> window.requireIncludesRelease(null, LocalDate.of(2027, 1, 1), zone),
                Violation.EXCLUDED_RELEASE);
    }

    private static void assertViolation(Runnable action, Violation expected) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(InvalidCalendar.class,
                exception -> assertThat(exception.violation()).isEqualTo(expected));
    }
}
