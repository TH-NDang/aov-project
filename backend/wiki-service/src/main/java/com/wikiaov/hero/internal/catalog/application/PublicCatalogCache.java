package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ReadModelCache;
import java.time.Clock;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * Keeps the public hero list and skin library as built for the patch in effect (ADR-012, 2026-11-26). Only reads of
 * the current published catalog go through it: a read that names a season, a variant or unscoped revisions is built
 * every time, so a permission checked by the loader is never skipped by a cached answer.
 */
@Component
public class PublicCatalogCache {
    private final ReadModelCache cache;
    private final GameplayContexts contexts;
    private final Clock clock;

    public PublicCatalogCache(ReadModelCache cache, GameplayContexts contexts, Clock clock) {
        this.cache = cache;
        this.contexts = contexts;
        this.clock = clock;
    }

    /**
     * The value for {@code query} in the region's current catalog, built by {@code loader} when it is not kept yet.
     *
     * @param name  what is built, such as {@code heroes}; part of the key
     * @param query every request parameter that changes the answer, already normalized
     */
    public <T> T current(String name, String region, String query, Class<T> type, Supplier<T> loader) {
        var context = contexts.find(region, clock.instant());
        if (context.isEmpty()) {
            return loader.get();
        }

        // The key names the patch in effect, so a release that comes due is read afresh without waiting for the TTL.
        String key = name + ":" + region + ":" + context.get().rulesetId() + ":" + context.get().patchVariantId() + ":"
                + query;
        return cache.read(ReadModelCache.Area.PUBLIC_CATALOGS, key, type, loader);
    }
}
