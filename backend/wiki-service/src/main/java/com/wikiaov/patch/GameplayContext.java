package com.wikiaov.patch;
import java.time.Instant;
import java.util.UUID;
public record GameplayContext(
        UUID regionId,
        String regionCode,
        UUID rulesetId,
        String rulesetCode,
        UUID patchId,
        String patchCode,
        UUID patchVariantId,
        long rulesetOrdinal,
        Instant effectiveAt
) {
}
