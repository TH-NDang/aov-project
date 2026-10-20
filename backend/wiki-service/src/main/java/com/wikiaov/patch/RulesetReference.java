package com.wikiaov.patch;

import java.util.UUID;

/** Active authoring ruleset identity without its internal persistence representation. */
public record RulesetReference(
        UUID id,
        String code
) {
}
