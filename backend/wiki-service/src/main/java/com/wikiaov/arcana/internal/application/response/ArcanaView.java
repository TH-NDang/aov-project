package com.wikiaov.arcana.internal.application.response;

import com.wikiaov.arcana.internal.domain.ArcanaContent;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.platform.CatalogCause;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ArcanaView(
        UUID id,
        String code,
        Revision revision,
        ArcanaContent content,
        List<String> missingFields,
        Map<UUID, MediaAssetReference> media
) {
    public ArcanaView {
        media = media == null ? Map.of() : Map.copyOf(media);
    }

    public ArcanaView(UUID id, String code, Revision revision, ArcanaContent content, List<String> missingFields) {
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
