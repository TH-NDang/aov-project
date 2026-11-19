package com.wikiaov.hero.internal.application.response;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record HeroImportPlan(
        String code,
        UUID heroId,
        UUID revisionId,
        Long version,
        Map<String, Object> before,
        Map<String, Object> after,
        boolean changed,
        String classification,
        boolean canApply,
        UUID sourcePatchVariantId,
        List<HeroImportWarning> warnings
) {
}
