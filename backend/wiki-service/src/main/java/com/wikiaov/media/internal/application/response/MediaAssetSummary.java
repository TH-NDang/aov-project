package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaSemanticType;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** One row of the asset list. */
public record MediaAssetSummary(
        UUID id,
        MediaSemanticType semanticType,
        MediaAssetState state,
        long version,
        @Nullable UUID currentVersionId,
        @Nullable String currentUrl,
        Instant createdAt,
        Instant updatedAt
) {
}
