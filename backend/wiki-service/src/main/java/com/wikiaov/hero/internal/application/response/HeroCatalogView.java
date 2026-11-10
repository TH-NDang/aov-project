package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroChanges.*;

import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * {@code holderId} and {@code formKey} are set when the hero is a form of another hero; {@code formIds} lists the forms
 * of a hero that holds forms, in switcher order (ADR-024).
 */
public record HeroCatalogView(
        UUID id,
        String code,
        List<HeroRevisionView> revisions,
        Instant lastEditedAt,
        List<GameplayChange> gameplayChanges,
        UUID holderId,
        String formKey,
        List<UUID> formIds
) {
    public record GameplayChange(
            UUID id,
            UUID rulesetId,
            UUID seasonId,
            UUID patchVariantId,
            UUID fromHeroRevisionId,
            UUID toHeroRevisionId,
            ChangeSource sourceKind,
            List<Kind> changeKinds,
            Kind overallKind,
            Instant recordedAt,
            String summary,
            String actualLocale
    ) {
    }
}
