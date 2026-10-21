package com.wikiaov.patch.internal.application;

import com.wikiaov.patch.CatalogPatchScope;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public final class CatalogPatchScopeResolver {
    private CatalogPatchScopeResolver() {
    }

    public static CatalogPatchScope resolve(GameplayContexts contexts, UUID rulesetId, UUID seasonId,
            UUID patchVariantId, boolean includeUnchanged) {
        var variants = contexts.catalogVariants(seasonId);
        if (patchVariantId != null) {
            var target = contexts.variant(patchVariantId);
            if (rulesetId != null && !rulesetId.equals(target.rulesetId())
                    || seasonId != null && !seasonId.equals(target.seasonId())) {
                throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                        "The patch must belong to the selected season and ruleset.");
            }
        }
        var selected = variants.stream()
                .filter(variant -> (rulesetId == null || rulesetId.equals(variant.rulesetId()))
                        && (patchVariantId == null || patchVariantId.equals(variant.id())))
                .map(PatchVariantReference::id).collect(Collectors.toSet());
        if (!includeUnchanged) {
            return new CatalogPatchScope(selected, Set.of());
        }
        Map<UUID, Long> cutoffs = new HashMap<>();
        variants.stream().filter(variant -> selected.contains(variant.id()))
                .forEach(variant -> cutoffs.merge(variant.rulesetId(), variant.rulesetOrdinal(), Math::max));
        var applicable = contexts.catalogVariants(null).stream()
                .filter(variant -> variant.published()
                        && variant.rulesetOrdinal() <= cutoffs.getOrDefault(variant.rulesetId(), -1L))
                .map(PatchVariantReference::id).collect(Collectors.toSet());
        return new CatalogPatchScope(selected, applicable);
    }
}
