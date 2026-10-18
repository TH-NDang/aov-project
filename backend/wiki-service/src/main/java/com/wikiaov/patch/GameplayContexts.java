package com.wikiaov.patch;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface GameplayContexts {
    GameplayContext resolve(String region, Instant at);
    List<GameplayContext> active(Instant at);
    void requireRuleset(UUID rulesetId);
    PatchVariantReference variant(UUID variantId);
    List<PatchVariantReference> catalogVariants(UUID seasonId);
    List<AuthoringContext> authoring(UUID regionId, UUID seasonId);
    AuthoringContext authoringContext(UUID releaseId);
}
