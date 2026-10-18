package com.wikiaov.patch;

import java.time.Instant;
import java.util.UUID;

public record AuthoringContext(
        UUID contextId,
        UUID regionId,
        String regionCode,
        UUID seasonId,
        String seasonName,
        UUID rulesetId,
        UUID patchVariantId,
        String patchCode,
        long rulesetOrdinal,
        Instant effectiveAt
) {
}
