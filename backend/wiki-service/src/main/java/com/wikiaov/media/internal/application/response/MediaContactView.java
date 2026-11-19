package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.internal.contact.domain.MediaContactStatus;
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
        MediaContactStatus status,
        Instant createdAt,
        @Nullable Instant resolvedAt
) {
}
