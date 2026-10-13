package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaSemanticType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * An asset with all its versions.
 *
 * @param version optimistic lock value; send it back as {@code expectedVersion} when changing the asset
 */
public record MediaAssetDetails(
        UUID id,
        MediaSemanticType semanticType,
        MediaAssetState state,
        long version,
        @Nullable UUID currentVersionId,
        List<MediaVersionDetails> versions,
        List<ProvenanceDetails> provenance,
        Instant createdAt,
        Instant updatedAt
) {
}
