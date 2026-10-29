package com.wikiaov.media.internal.application.response;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record MediaContactView(
        UUID id,
        @Nullable UUID assetId,
        @Nullable UUID versionId,
        String name,
        String email,
        String topic,
        String message,
        String status,
        Instant createdAt,
        @Nullable Instant resolvedAt
) {
}
