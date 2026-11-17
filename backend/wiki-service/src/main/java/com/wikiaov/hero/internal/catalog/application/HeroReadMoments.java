package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory;
import com.wikiaov.patch.CatalogReadScope;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.ToLongFunction;
import org.springframework.stereotype.Component;

/**
 * Decides which published revision a public catalog shows of each hero at the moment a reader selected (ADR-016,
 * 2026-11-11 addendum).
 */
@Component
public class HeroReadMoments {
    private final GameplayContexts contexts;
    private final HeroPatchHistory history;

    public HeroReadMoments(GameplayContexts contexts, HeroPatchHistory history) {
        this.contexts = contexts;
        this.history = history;
    }

    public Moment resolve(String region, Instant at, UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        var scope = CatalogReadScope.resolve(contexts, region, at, seasonId, patchVariantId, includeUnscoped);
        var context = scope.gameplay();
        boolean historical = seasonId != null || patchVariantId != null;

        Map<UUID, Long> ordinals = new HashMap<>();
        for (var variant : contexts.rulesetVariants(context.rulesetId()))
            ordinals.put(variant.id(), variant.rulesetOrdinal());
        if (!historical)
            return new Moment(context, scope.allowUnscoped(), false, context.rulesetOrdinal(), Map.of(), ordinals);

        // A later observation may come from any patch the market has already reached, never from a scheduled one.
        var current = contexts.resolve(region, at);
        long newest = current.rulesetId().equals(context.rulesetId())
                ? current.rulesetOrdinal()
                : context.rulesetOrdinal();
        Map<UUID, Long> introducedAt = new HashMap<>();
        history.introductions().forEach((heroId, variantId) -> {
            var ordinal = ordinals.get(variantId);
            if (ordinal != null)
                introducedAt.put(heroId, ordinal);
        });

        return new Moment(context, scope.allowUnscoped(), true, newest, introducedAt, ordinals);
    }

    /**
     * One reader's moment. A hero shows its latest published revision at or before the selected patch. At a historical
     * patch, a hero without one shows its earliest later observation, unless a later patch introduced the hero.
     *
     * @param newestOrdinal the market's current patch; later observations never pass it
     * @param introducedAt  ordinal of the patch that introduced each hero that has one
     * @param ordinals      ordinal of every patch variant of the ruleset
     */
    public record Moment(
            GameplayContext context,
            boolean allowUnscoped,
            boolean historical,
            long newestOrdinal,
            Map<UUID, Long> introducedAt,
            Map<UUID, Long> ordinals
    ) {
        /**
         * Chooses among one hero's published revisions of the context's ruleset, already limited to those published by
         * the time of reading.
         *
         * @param variantOf     the patch variant of a revision, or {@code null} for an unscoped observation
         * @param publicationOf the publication sequence that orders revisions of the same patch
         */
        public <T> Optional<Choice<T>> choose(UUID heroId, Collection<T> revisions, Function<T, UUID> variantOf,
                ToLongFunction<T> publicationOf) {
            ToLongFunction<T> ordinal = revision -> {
                var variant = variantOf.apply(revision);
                return variant == null ? 0 : ordinals.getOrDefault(variant, 0L);
            };
            long target = context.rulesetOrdinal();

            var observed = revisions.stream()
                    .filter(revision -> allowUnscoped || variantOf.apply(revision) != null)
                    .filter(revision -> ordinal.applyAsLong(revision) <= target)
                    .max(Comparator.comparingLong(ordinal).thenComparingLong(publicationOf));
            if (observed.isPresent())
                return observed.map(revision -> new Choice<>(revision, null));
            if (!historical || introducedAt.getOrDefault(heroId, 0L) > target)
                return Optional.empty();

            return revisions.stream().filter(revision -> variantOf.apply(revision) != null)
                    .filter(revision -> ordinal.applyAsLong(revision) > target
                            && ordinal.applyAsLong(revision) <= newestOrdinal)
                    .min(Comparator.comparingLong(ordinal)
                            .thenComparing(Comparator.comparingLong(publicationOf).reversed()))
                    .map(revision -> new Choice<>(revision, variantOf.apply(revision)));
        }
    }

    /** The chosen revision, and the later patch it was observed at when it does not belong to the selected one. */
    public record Choice<T>(
            T revision,
            UUID laterVariantId
    ) {
    }
}
