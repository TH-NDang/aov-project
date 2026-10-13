package com.wikiaov.user.internal.application.response;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record UserProfile(
        @Nullable UUID id,
        String displayName,
        String biography,
        String locale,
        String timeZone,
        @Nullable UUID avatarAssetId,
        @Nullable String avatarUrl,
        long version,
        @Nullable Instant createdAt,
        @Nullable Instant updatedAt
) {
}
