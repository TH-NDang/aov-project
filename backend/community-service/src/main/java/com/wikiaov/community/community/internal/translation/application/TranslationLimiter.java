package com.wikiaov.community.community.internal.translation.application;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * New translations each account or address may start in a sliding hour. One service process serves the site, so the
 * count lives in memory and starts over on a restart; the monthly budget in the database is the hard limit.
 */
class TranslationLimiter {
    private static final Duration WINDOW = Duration.ofHours(1);

    private final int perHour;
    private final Clock clock;
    private final Cache<String, Deque<Instant>> starts = Caffeine.newBuilder().expireAfterAccess(WINDOW)
            .maximumSize(50_000).build();

    TranslationLimiter(int perHour, Clock clock) {
        this.perHour = perHour;
        this.clock = clock;
    }

    /** Counts a start and says whether it fits the hour. */
    boolean tryStart(String requester) {
        var times = starts.get(requester, ignored -> new ArrayDeque<>());
        synchronized (times) {
            Instant now = clock.instant();
            while (!times.isEmpty() && !times.peekFirst().isAfter(now.minus(WINDOW))) {
                times.pollFirst();
            }
            if (times.size() >= perHour) {
                return false;
            }
            times.addLast(now);
            return true;
        }
    }
}
