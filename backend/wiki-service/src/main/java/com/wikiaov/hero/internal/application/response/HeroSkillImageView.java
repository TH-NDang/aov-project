package com.wikiaov.hero.internal.application.response;

import java.time.Instant;
import java.util.UUID;

public record HeroSkillImageView(
        UUID id,
        UUID heroId,
        String skillKey,
        int sourceSlot,
        int variantNo,
        UUID assetId,
        String sourceFilename,
        String label,
        long version,
        Instant createdAt,
        Instant updatedAt
) {
}
