package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record ProvenanceDetails(
        UUID id,
        @Nullable UUID versionId,
        ProvenanceSourceType type,
        String label,
        @Nullable String url,
        @Nullable Instant observedAt,
        @Nullable String note
) {
}
