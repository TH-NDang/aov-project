package com.wikiaov.patch.internal.watch.application;

import com.wikiaov.patch.internal.watch.domain.PatchNoteChannel;
import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteRegion;
import com.wikiaov.patch.internal.watch.domain.PatchNoteScheduleMode;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;

public final class PatchWatchCommands {

    private PatchWatchCommands() {
    }

    /** Moves a post in the inbox, at the version the editor saw. */
    public record ChangePatchNoteState(
            @NotNull PatchNotePostState state,
            @NotNull @PositiveOrZero Long expectedVersion
    ) {
    }

    /** Adds a post the check did not find by itself. */
    public record AddPatchNotePost(
            @NotBlank @Size(max = 1000) String url,
            @NotBlank @Size(max = 500) String title,
            @NotNull PatchNoteRegion region,
            @NotNull PatchNoteChannel channel
    ) {
    }

    /**
     * Sets when one source is read, at the version the editor saw.
     *
     * @param dailyAt    wall-clock time in Vietnam, used by {@code DAILY}
     * @param everyHours gap in hours, used by {@code EVERY_HOURS}
     * @param paused     true stops the schedule for this source; "check now" still reads it
     */
    public record ChangePatchNoteSchedule(
            @NotNull PatchNoteScheduleMode mode,
            @NotNull LocalTime dailyAt,
            @NotNull @Min(1) @Max(24) Integer everyHours,
            @NotNull Boolean paused,
            @NotNull @PositiveOrZero Long expectedVersion
    ) {
    }
}
