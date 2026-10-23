package com.wikiaov.patch.internal.authoring.persistence;

import java.util.UUID;

public record SeasonVariant(
        UUID id,
        long rulesetOrdinal,
        Long seasonOrdinal
) {
}
