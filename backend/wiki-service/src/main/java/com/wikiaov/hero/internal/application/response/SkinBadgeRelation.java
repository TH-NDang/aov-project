package com.wikiaov.hero.internal.application.response;

import java.util.UUID;

public record SkinBadgeRelation(
        UUID heroId,
        String heroCode,
        String heroName,
        String skinKey,
        String skinName,
        UUID revisionId,
        UUID artAssetId
) {
}
