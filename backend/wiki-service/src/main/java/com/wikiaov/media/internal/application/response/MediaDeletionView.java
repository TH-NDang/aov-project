package com.wikiaov.media.internal.application.response;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record MediaDeletionView(
        UUID assetId,
        String state,
        long expectedVersion,
        int objects,
        int publicUrls,
        @Nullable String lastError,
        Instant requestedAt,
        @Nullable Instant completedAt
) {
}
