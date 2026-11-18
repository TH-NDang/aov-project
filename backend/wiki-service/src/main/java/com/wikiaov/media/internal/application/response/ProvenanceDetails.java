package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One recorded source of an asset or version, as editors see it.
 *
 * @param unverified recorded without evidence of where the image came from (V074); Admin words it instead of
 *                   {@code label}
 */
public record ProvenanceDetails(
        UUID id,
        @Nullable UUID versionId,
        ProvenanceSourceType type,
        String label,
        boolean unverified,
        @Nullable String url,
        @Nullable Instant observedAt,
        @Nullable String note,
        @Nullable String ownerName,
        @Nullable String contactUrl,
        @Nullable UUID ownerId,
        @Nullable UUID ownerPageId,
        @Nullable UUID relatedPageId,
        long referenceVersion
) {
}
