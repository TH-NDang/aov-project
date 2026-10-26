package com.wikiaov.item.internal.application.response;

import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.media.MediaAssetReference;
import java.time.Instant;
import java.util.*;

public record ItemView(
        UUID id,
        String code,
        Revision revision,
        ItemContent content,
        List<String> missingFields,
        Map<UUID, MediaAssetReference> media
) {
    public ItemView {
        media = media == null ? Map.of() : Map.copyOf(media);
    }

    public ItemView(UUID id, String code, Revision revision, ItemContent content, List<String> missingFields) {
        this(id, code, revision, content, missingFields, Map.of());
    }

    public record Revision(
            UUID id,
            UUID ownerId,
            String code,
            UUID rulesetId,
            long revisionNo,
            String state,
            long version,
            Long publicationSequence,
            Instant publishedAt,
            String cause,
            UUID effectiveFromPatchVariantId,
            UUID sourceRevisionId,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
