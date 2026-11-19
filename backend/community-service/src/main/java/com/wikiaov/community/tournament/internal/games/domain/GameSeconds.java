package com.wikiaov.community.tournament.internal.games.domain;

import java.util.List;
import org.jspecify.annotations.Nullable;

/** Seconds on the game clock: never negative, at most one day and never after the game ended. */
final class GameSeconds {
    /** Latest game second an observation can name, one day. */
    static final int MAX_GAME_SECOND = 86_400;

    private GameSeconds() {
    }

    /** A moment every event must name. */
    static void moment(@Nullable Integer seconds, @Nullable Integer duration, String path, List<String> errors) {
        if (seconds == null || seconds < 0 || seconds > MAX_GAME_SECOND || duration != null && seconds > duration) {
            errors.add(path + ".atSeconds.range");
        }
    }

    /** The moment the source showed something, when it is known. */
    static void observedAt(@Nullable Integer seconds, @Nullable Integer duration, String path, List<String> errors) {
        if (seconds != null && (seconds < 0 || seconds > MAX_GAME_SECOND || duration != null && seconds > duration)) {
            errors.add(path + ".range");
        }
    }
}
