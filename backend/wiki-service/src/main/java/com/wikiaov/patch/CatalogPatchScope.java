package com.wikiaov.patch;

import com.wikiaov.patch.internal.application.CatalogPatchScopeResolver;
import java.util.Set;
import java.util.UUID;

/** Patch identities selected by a catalog filter and the published history preceding them. */
public record CatalogPatchScope(
        Set<UUID> selectedPatchIds,
        Set<UUID> applicablePatchIds
) {
    public static CatalogPatchScope resolve(GameplayContexts contexts, UUID rulesetId, UUID seasonId,
            UUID patchVariantId, boolean includeUnchanged) {
        return CatalogPatchScopeResolver.resolve(contexts, rulesetId, seasonId, patchVariantId, includeUnchanged);
    }
}
