package com.wikiaov.item.internal.application.response;

import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.platform.CatalogCause;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
            RevisionState state,
            long version,
            Long publicationSequence,
            Instant publishedAt,
            CatalogCause cause,
            UUID effectiveFromPatchVariantId,
            UUID sourceRevisionId,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
