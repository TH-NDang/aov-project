package com.wikiaov.spell.internal.application.response;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.spell.internal.domain.SpellContent;
import java.time.Instant;
import java.util.*;

public record SpellView(
        UUID id,
        String code,
        Revision revision,
        SpellContent content,
        List<String> missingFields,
        Map<UUID, MediaAssetReference> media
) {
    public SpellView {
        media = media == null ? Map.of() : Map.copyOf(media);
    }

    public SpellView(UUID id, String code, Revision revision, SpellContent content, List<String> missingFields) {
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
            Instant updatedAt,
            boolean archived
    ) {
    }
}
