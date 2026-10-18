package com.wikiaov.patch;

import java.time.Instant;
import java.util.UUID;

public record PatchReleaseReference(
        UUID patchId,
        UUID variantId,
        UUID rulesetId,
        Instant effectiveAt
) {
}
