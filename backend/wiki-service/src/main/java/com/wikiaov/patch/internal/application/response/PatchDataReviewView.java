package com.wikiaov.patch.internal.application.response;

import com.wikiaov.patch.internal.domain.PatchDataReviewState;
import java.time.Instant;
import java.util.UUID;

public record PatchDataReviewView(
        UUID variantId,
        PatchDataReviewState state,
        long version,
        Instant completedAt
) {
}
