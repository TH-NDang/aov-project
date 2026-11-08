package com.wikiaov.gamemode.internal.lineup.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.MutableClock;
import com.wikiaov.gamemode.internal.application.GameModeErrorCode;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class LineupThrottleTest {
    @Test
    void limitsEachReaderSeparatelyAndResetsAfterTheWindow() {
        var clock = new MutableClock(Instant.parse("2026-11-08T00:00:00Z"));
        var throttle = new LineupThrottle(clock);
        for (int i = 0; i < LineupThrottle.LIKES_PER_WINDOW; i++)
            throttle.like("reader-a");

        assertThatThrownBy(() -> throttle.like("reader-a")).isInstanceOfSatisfying(ApiException.class,
                error -> org.assertj.core.api.Assertions.assertThat(error.getErrorCode())
                        .isEqualTo(GameModeErrorCode.GAME_MODE_RATE_LIMITED));
        assertThatCode(() -> throttle.like("reader-b")).doesNotThrowAnyException();

        clock.advance(LineupThrottle.LIKE_WINDOW.plusSeconds(1));
        assertThatCode(() -> throttle.like("reader-a")).doesNotThrowAnyException();
    }

    @Test
    void savingLineupsHasItsOwnSmallerLimit() {
        var throttle = new LineupThrottle(new MutableClock(Instant.parse("2026-11-08T00:00:00Z")));
        for (int i = 0; i < LineupThrottle.WRITES_PER_WINDOW; i++)
            throttle.write("reader-a");

        assertThatThrownBy(() -> throttle.write("reader-a")).isInstanceOf(ApiException.class);
        assertThatCode(() -> throttle.like("reader-a")).doesNotThrowAnyException();
    }
}
