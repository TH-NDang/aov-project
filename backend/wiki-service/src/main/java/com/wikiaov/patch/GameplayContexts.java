package com.wikiaov.patch;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public interface GameplayContexts {
    GameplayContext resolve(String region, Instant at);

    GameplayContext resolveCatalog(String region, Instant at, UUID seasonId, UUID patchVariantId);

    List<GameplayContext> active(Instant at);

    void requireRuleset(UUID rulesetId);

    PatchVariantReference variant(UUID variantId);

    /**
     * Where a variant stands in its ruleset; later patches have higher numbers and an observation without a patch is
     * 0. The four warehouse catalogs order their revisions with it (ADR-031).
     */
    static long rulesetOrdinal(GameplayContexts contexts, @Nullable UUID variantId) {
        return variantId == null ? 0 : contexts.variant(variantId).rulesetOrdinal();
    }

    String patchCode(UUID variantId);

    List<PatchVariantReference> catalogVariants(UUID seasonId);

    List<PatchVariantReference> rulesetVariants(UUID rulesetId);

    List<RulesetReference> rulesets();

    List<AuthoringContext> authoring(UUID regionId, UUID seasonId);

    AuthoringContext authoringContext(UUID releaseId);
}
