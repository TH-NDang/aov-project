package com.wikiaov.spell.internal.application.response;

import com.wikiaov.spell.internal.domain.SpellContent;
import java.time.Instant;
import java.util.*;

public record SpellView(
        UUID id,
        String code,
        Revision revision,
        SpellContent content,
        List<String> missingFields
) {
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
