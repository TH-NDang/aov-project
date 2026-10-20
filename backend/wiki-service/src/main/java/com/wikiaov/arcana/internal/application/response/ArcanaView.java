package com.wikiaov.arcana.internal.application.response;
import com.wikiaov.arcana.internal.domain.ArcanaContent;
import java.time.Instant;
import java.util.*;
public record ArcanaView(
        UUID id,
        String code,
        Revision revision,
        ArcanaContent content,
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
