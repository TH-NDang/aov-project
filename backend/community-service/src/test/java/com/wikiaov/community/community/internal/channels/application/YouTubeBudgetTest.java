package com.wikiaov.community.community.internal.channels.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class YouTubeBudgetTest {
    /** 07:59 UTC is 23:59 of the day before in Los Angeles in November. */
    private final MovableClock clock = new MovableClock(Instant.parse("2026-11-26T07:59:00Z"));

    @Test
    void unitsRunOutAtTheDailyShare() {
        var budget = new YouTubeBudget(2, clock);

        assertThat(budget.spend()).isTrue();
        assertThat(budget.spend()).isTrue();
        assertThat(budget.spend()).isFalse();
    }

    @Test
    void theShareComesBackAtMidnightInCalifornia() {
        var budget = new YouTubeBudget(1, clock);
        budget.spend();

        clock.move(Duration.ofMinutes(2));

        assertThat(budget.spend()).isTrue();
    }

    @Test
    void aQuotaRefusalSpendsTheRestOfTheDay() {
        var budget = new YouTubeBudget(100, clock);

        budget.exhaust();

        assertThat(budget.spend()).isFalse();
        assertThat(budget.spent()).isEqualTo(100);
    }

    static final class MovableClock extends Clock {
        private Instant now;

        MovableClock(Instant now) {
            this.now = now;
        }

        void move(Duration by) {
            now = now.plus(by);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            var outer = this;
            return new Clock() {
                @Override
                public ZoneId getZone() {
                    return zone;
                }

                @Override
                public Clock withZone(ZoneId other) {
                    return outer.withZone(other);
                }

                @Override
                public Instant instant() {
                    return outer.instant();
                }
            };
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
