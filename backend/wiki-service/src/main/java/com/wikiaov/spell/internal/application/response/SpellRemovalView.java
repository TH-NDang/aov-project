package com.wikiaov.spell.internal.application.response;

import com.wikiaov.spell.internal.persistence.entity.SpellRemoval;
import java.time.Instant;
import java.util.UUID;

public record SpellRemovalView(
        UUID id,
        UUID revisionId,
        UUID rulesetId,
        UUID patchVariantId,
        String sourceUrl,
        String notes,
        Instant recordedAt
) {
    public static SpellRemovalView from(SpellRemoval event) {
        return new SpellRemovalView(event.getId(), event.getRevisionId(), event.getRulesetId(),
                event.getPatchVariantId(), event.getSourceUrl(), event.getNotes(), event.getRecordedAt());
    }
}
