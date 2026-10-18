package com.wikiaov.patch;

import java.util.UUID;

public record PatchVariantReference(
        UUID id,
        UUID patchId,
        UUID rulesetId,
        UUID seasonId,
        long rulesetOrdinal,
        boolean published
) {
}
