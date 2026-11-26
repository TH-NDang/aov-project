package com.wikiaov.patch.internal.watch.application;

import com.wikiaov.patch.internal.watch.domain.PatchNoteChannel;
import com.wikiaov.patch.internal.watch.domain.PatchNoteFailure;
import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteRegion;
import com.wikiaov.patch.internal.watch.domain.PatchNoteScheduleMode;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public final class PatchWatchViews {

    private PatchWatchViews() {
    }

    /**
     * @param publishedAt when the source says the post went out; null when it does not say
     * @param firstSeenAt when the check first found the post
     */
    public record PatchNotePostView(
            UUID id,
            PatchNoteSource source,
            PatchNoteRegion region,
            PatchNoteChannel channel,
            String url,
            @Nullable String title,
            @Nullable Instant publishedAt,
            Instant firstSeenAt,
            PatchNotePostState state,
            @Nullable Instant stateChangedAt,
            long version
    ) {
    }

    /**
     * @param readable      false when this server cannot read the source (the page reader runs on the server only)
     * @param dailyAt       wall-clock time in {@link PatchWatchOverview#zone()}
     * @param nextCheckAt   the next planned read; none while paused or unreadable
     * @param failures      failed reads in a row; each one makes the retry wait longer
     * @param failure       why the last read failed, when it did
     * @param failureStatus HTTP status of the last failed read, when the server answered
     * @param version       the schedule's version, sent back when changing it
     */
    public record PatchNoteSourceView(
            PatchNoteSource code,
            PatchNoteRegion region,
            Set<PatchNoteChannel> channels,
            String pageUrl,
            boolean readable,
            PatchNoteScheduleMode mode,
            LocalTime dailyAt,
            int everyHours,
            boolean paused,
            @Nullable Instant lastCheckedAt,
            @Nullable Instant lastSuccessAt,
            @Nullable Instant nextCheckAt,
            int failures,
            @Nullable PatchNoteFailure failure,
            @Nullable Integer failureStatus,
            long version
    ) {
    }

    /**
     * @param scheduled whether the schedule runs on this server
     * @param zone      the zone of the daily reading times
     * @param newCount  posts waiting in the inbox
     */
    public record PatchWatchOverview(
            boolean scheduled,
            String zone,
            long newCount,
            List<PatchNoteSourceView> sources
    ) {
    }
}
