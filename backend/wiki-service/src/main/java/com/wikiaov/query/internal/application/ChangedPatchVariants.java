package com.wikiaov.query.internal.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ReadModelCache;
import java.time.Clock;
import java.util.Comparator;
import org.springframework.stereotype.Service;

/**
 * Which patches of a market's catalog changed a domain, in one read. The Wiki's version menu lists only those patches;
 * it used to learn this by reading the change list of every patch (03, Patch APIs, section 11.1; ADR-012).
 */
@Service
public class ChangedPatchVariants {
    private final PatchPages pages;
    private final GameplayContexts contexts;
    private final ReadModelCache cache;
    private final Clock clock;

    public ChangedPatchVariants(PatchPages pages, GameplayContexts contexts, ReadModelCache cache, Clock clock) {
        this.pages = pages;
        this.contexts = contexts;
        this.cache = cache;
        this.clock = clock;
    }

    public PatchChangedVariants read(String region, String domain) {
        pages.requireDomain(domain);
        var context = contexts.resolve(region, clock.instant());

        // The key names the patch in effect, so a release that comes due is read afresh without waiting for the TTL.
        String key = "changed-variants:" + region + ":" + domain + ":" + context.rulesetId() + ":"
                + context.patchVariantId();
        return cache.read(ReadModelCache.Area.PUBLIC_CATALOGS, key, PatchChangedVariants.class,
                () -> new PatchChangedVariants(domain, contexts.rulesetVariants(context.rulesetId()).stream()
                        .filter(variant -> variant.published()
                                && variant.rulesetOrdinal() <= context.rulesetOrdinal())
                        .sorted(Comparator.comparingLong(PatchVariantReference::rulesetOrdinal).reversed())
                        .filter(variant -> pages.changed(domain, variant.rulesetId(), variant.id()))
                        .map(PatchVariantReference::id).toList()));
    }
}
