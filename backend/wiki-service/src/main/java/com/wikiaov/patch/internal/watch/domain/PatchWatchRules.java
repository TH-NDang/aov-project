package com.wikiaov.patch.internal.watch.domain;

import java.time.Duration;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** Whether a post seen for the first time belongs in the inbox, and when a failed read is tried again. */
public final class PatchWatchRules {

    /** A post older than this when first seen is history, not news. */
    public static final Duration NEWS_WINDOW = Duration.ofDays(14);

    /** An editor's "check now" does not read a source again sooner than this. */
    public static final Duration MANUAL_GAP = Duration.ofMinutes(2);

    /** The first retry after a failed read; each further failure doubles it, up to {@link #MAX_RETRY}. */
    private static final Duration FIRST_RETRY = Duration.ofMinutes(30);
    private static final Duration MAX_RETRY = Duration.ofHours(6);

    private PatchWatchRules() {
    }

    public static PatchNotePostState firstState(@Nullable Instant publishedAt, Instant now) {
        return publishedAt == null || !publishedAt.isBefore(now.minus(NEWS_WINDOW))
                ? PatchNotePostState.NEW
                : PatchNotePostState.EARLIER;
    }

    /**
     * When to try again after {@code failures} failures in a row. A retry never waits past the next planned reading,
     * and never comes sooner than {@link #FIRST_RETRY}, so a broken page is not asked every few minutes.
     */
    public static Instant retryAt(Instant now, int failures, Instant planned) {
        Duration wait = FIRST_RETRY;
        for (int i = 1; i < failures && wait.compareTo(MAX_RETRY) < 0; i++) {
            wait = wait.multipliedBy(2);
        }
        Instant retry = now.plus(wait.compareTo(MAX_RETRY) > 0 ? MAX_RETRY : wait);
        return retry.isBefore(planned) ? retry : planned;
    }

    public static boolean manualCheckAllowed(@Nullable Instant lastCheckedAt, Instant now) {
        return lastCheckedAt == null || !lastCheckedAt.plus(MANUAL_GAP).isAfter(now);
    }
}
