package com.wikiaov.gamemode.internal.lineup.application;

import com.wikiaov.gamemode.internal.application.GameModeErrorCode;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import org.springframework.stereotype.Component;

/**
 * Per-reader, per-instance limits on likes and saved lineups (ADR-023). Identity comes from the verified token, so a
 * client cannot spread its requests over invented names; the tables are bounded like the contact form's.
 */
@Component
public class LineupThrottle {
    static final int LIKES_PER_WINDOW = 60;

    static final Duration LIKE_WINDOW = Duration.ofMinutes(10);

    static final int WRITES_PER_WINDOW = 10;

    static final Duration WRITE_WINDOW = Duration.ofHours(1);

    private static final int MAX_TRACKED = 10_000;

    private final Clock clock;

    private final LinkedHashMap<String, Window> likes = new LinkedHashMap<>();

    private final LinkedHashMap<String, Window> writes = new LinkedHashMap<>();

    public LineupThrottle(Clock clock) {
        this.clock = clock;
    }

    public void like(String reader) {
        check(likes, reader, LIKES_PER_WINDOW, LIKE_WINDOW);
    }

    public void write(String reader) {
        check(writes, reader, WRITES_PER_WINDOW, WRITE_WINDOW);
    }

    private synchronized void check(LinkedHashMap<String, Window> windows, String reader, int limit,
            Duration length) {
        var now = clock.instant();
        windows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
        var window = windows.get(reader);
        if (window != null && window.count() >= limit) {
            throw new ApiException(GameModeErrorCode.GAME_MODE_RATE_LIMITED,
                    "Too many changes in a short time. Please wait a moment.");
        }
        if (window == null && windows.size() >= MAX_TRACKED) {
            throw new ApiException(GameModeErrorCode.GAME_MODE_RATE_LIMITED, "Please try again later.");
        }

        windows.put(reader, window == null
                ? new Window(now.plus(length), 1)
                : new Window(window.expiresAt(), window.count() + 1));
    }

    private record Window(
            Instant expiresAt,
            int count
    ) {
    }
}
