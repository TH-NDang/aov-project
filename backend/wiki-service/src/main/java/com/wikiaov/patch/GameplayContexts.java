package com.wikiaov.patch;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface GameplayContexts {
    GameplayContext resolve(String region, Instant at);

    GameplayContext resolveCatalog(String region, Instant at, UUID seasonId, UUID patchVariantId);

    List<GameplayContext> active(Instant at);

    void requireRuleset(UUID rulesetId);

    PatchVariantReference variant(UUID variantId);

    List<PatchVariantReference> catalogVariants(UUID seasonId);

    List<PatchVariantReference> rulesetVariants(UUID rulesetId);

    List<RulesetReference> rulesets();

    List<AuthoringContext> authoring(UUID regionId, UUID seasonId);

    AuthoringContext authoringContext(UUID releaseId);
}
