package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaCredit;
import com.wikiaov.media.MediaSemanticType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One row of the asset list.
 *
 * @param usage where the image is used; only when the list was asked for it, because it needs every module's answer
 */
public record MediaAssetSummary(
        UUID id,
        MediaSemanticType semanticType,
        MediaAssetState state,
        long version,
        @Nullable UUID currentVersionId,
        @Nullable String currentUrl,
        Instant createdAt,
        Instant updatedAt,
        List<MediaCredit> sources,
        @Nullable MediaUsageSummary usage
) {

    public MediaAssetSummary withUsage(MediaUsageSummary summary) {
        return new MediaAssetSummary(id, semanticType, state, version, currentVersionId, currentUrl, createdAt,
                updatedAt, sources, summary);
    }
}
