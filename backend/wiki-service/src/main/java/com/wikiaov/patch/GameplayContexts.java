package com.wikiaov.patch;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GameplayContexts {
    /**
     * Finds the verified context of an open region, or nothing when the region has none at that moment. Callers that
     * can answer without a context use this instead of catching PATCH_CONTEXT_UNAVAILABLE from {@link #resolve}: an
     * exception that leaves this transactional bean marks the caller's transaction rollback-only, and its commit then
     * fails even though the exception was caught.
     *
     * @throws com.wikiaov.platform.ApiException UNSUPPORTED_REGION when the region is unknown or not open
     */
    Optional<GameplayContext> find(String region, Instant at);

    /**
     * Same as {@link #find}, but a region without a verified context fails with PATCH_CONTEXT_UNAVAILABLE.
     */
    GameplayContext resolve(String region, Instant at);

    GameplayContext resolveCatalog(String region, Instant at, UUID seasonId, UUID patchVariantId);

    List<GameplayContext> active(Instant at);

    void requireRuleset(UUID rulesetId);

    PatchVariantReference variant(UUID variantId);

    String patchCode(UUID variantId);

    List<PatchVariantReference> catalogVariants(UUID seasonId);

    List<PatchVariantReference> rulesetVariants(UUID rulesetId);

    List<RulesetReference> rulesets();

    List<AuthoringContext> authoring(UUID regionId, UUID seasonId);

    AuthoringContext authoringContext(UUID releaseId);
}
