package com.wikiaov.query.internal.application;

import java.util.List;
import java.util.UUID;

/**
 * The published variants of a market's catalog whose patch changed one domain (03, Patch APIs, section 11.1).
 *
 * @param variantIds the changed variants, newest first in the ruleset
 */
public record PatchChangedVariants(
        String domain,
        List<UUID> variantIds
) {
}
