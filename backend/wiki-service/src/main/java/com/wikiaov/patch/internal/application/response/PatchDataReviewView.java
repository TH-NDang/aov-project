package com.wikiaov.patch.internal.application.response;
import java.time.Instant;
import java.util.UUID;
public record PatchDataReviewView(
        UUID variantId,
        String state,
        long version,
        Instant completedAt
) {
}
