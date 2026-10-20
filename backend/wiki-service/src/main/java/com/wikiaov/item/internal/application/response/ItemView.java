package com.wikiaov.item.internal.application.response;
import com.wikiaov.item.internal.domain.ItemContent;
import java.time.Instant;
import java.util.*;
public record ItemView(
        UUID id,
        String code,
        Revision revision,
        ItemContent content,
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
