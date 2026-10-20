package com.wikiaov.enchantment.internal.application.response;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import java.time.Instant;
import java.util.*;
public record EnchantmentView(
        UUID id,
        String code,
        Revision revision,
        EnchantmentContent content,
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
