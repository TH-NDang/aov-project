package com.wikiaov.patch;

import java.time.Instant;
import java.util.UUID;

/** Distinguishes a current catalog from a historical scope that may omit unscoped observations. */
public record CatalogReadScope(
        GameplayContext gameplay,
        boolean allowUnscoped
) {
    public static CatalogReadScope resolve(GameplayContexts contexts, String region, Instant at, UUID seasonId,
            UUID patchVariantId, boolean includeUnscoped) {
        boolean historical = seasonId != null || patchVariantId != null;
        var gameplay = historical
                ? contexts.resolveCatalog(region, at, seasonId, patchVariantId)
                : contexts.resolve(region, at);

        return new CatalogReadScope(gameplay, !historical || includeUnscoped);
    }
}
