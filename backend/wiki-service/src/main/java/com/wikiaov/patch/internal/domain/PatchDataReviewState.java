package com.wikiaov.patch.internal.domain;

import java.util.Arrays;

/** Progress of the editorial data review of a patch variant. Stored and sent as its name. */
public enum PatchDataReviewState {
    IN_PROGRESS,
    COMPLETE;

    /** Whether {@code value} is the exact name of a state, as a request must send it. */
    public static boolean isName(String value) {
        return Arrays.stream(values()).anyMatch(state -> state.name().equals(value));
    }
}
