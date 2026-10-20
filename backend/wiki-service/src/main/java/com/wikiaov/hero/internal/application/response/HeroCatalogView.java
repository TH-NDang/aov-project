package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record HeroCatalogView(
        UUID id,
        String code,
        List<HeroRevisionView> revisions,
        Instant lastEditedAt,
        List<GameplayChange> gameplayChanges
) {
    public record GameplayChange(
            UUID id,
            UUID rulesetId,
            UUID seasonId,
            UUID patchVariantId,
            UUID fromHeroRevisionId,
            UUID toHeroRevisionId,
            List<Kind> changeKinds,
            Kind overallKind,
            Instant recordedAt,
            String summary,
            String actualLocale
    ) {
    }
}
