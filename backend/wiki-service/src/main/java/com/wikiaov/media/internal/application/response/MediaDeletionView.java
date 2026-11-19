package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.internal.deletion.domain.MediaDeletionState;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record MediaDeletionView(
        UUID assetId,
        MediaDeletionState state,
        long expectedVersion,
        int objects,
        int publicUrls,
        @Nullable String lastError,
        Instant requestedAt,
        @Nullable Instant completedAt
) {
}
