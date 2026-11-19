package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroListView;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What readers see of published heroes, read in one transaction: the current revision of a hero, one hero's page
 * ({@link HeroDetails}) and the hero list ({@link HeroListing}).
 */
@Service
@Transactional(readOnly = true)
public class HeroQueries {
    private final HeroStore store;
    private final GameplayContexts contexts;
    private final Clock clock;
    private final HeroReadMoments moments;
    private final HeroReaderSelection selection;
    private final HeroDetails details;
    private final HeroListing listing;

    public HeroQueries(HeroStore store, GameplayContexts contexts, Clock clock, HeroReadMoments moments,
            HeroReaderSelection selection, HeroDetails details, HeroListing listing) {
        this.store = store;
        this.contexts = contexts;
        this.clock = clock;
        this.moments = moments;
        this.selection = selection;
        this.details = details;
        this.listing = listing;
    }

    public Optional<HeroRevisionView> current(UUID heroId, GameplayContext context, Instant at) {
        return current(heroId, context, at, true);
    }

    public Optional<HeroRevisionView> current(UUID heroId, GameplayContext context, Instant at, boolean allowUnscoped) {
        return select(store.revisions(heroId), context, at, allowUnscoped, new HashMap<>());
    }

    /** The revisions readers see at {@code at}, in any active context, for many heroes with one read of each. */
    public Set<UUID> currentRevisionIds(Collection<UUID> heroIds, Instant at) {
        var byHero = store.revisions(heroIds).stream().collect(Collectors.groupingBy(HeroRevisionView::heroId));
        Map<UUID, Long> ordinals = new HashMap<>();
        Set<UUID> current = new HashSet<>();

        for (var context : contexts.active(at)) {
            for (var revisions : byHero.values()) {
                select(revisions, context, at, true, ordinals).ifPresent(revision -> current.add(revision.id()));
            }
        }

        return current;
    }

    private Optional<HeroRevisionView> select(List<HeroRevisionView> revisions, GameplayContext context, Instant at,
            boolean allowUnscoped, Map<UUID, Long> ordinals) {
        return revisions.stream()
                .filter(r -> r.state() == RevisionState.PUBLISHED && r.rulesetId().equals(context.rulesetId())
                        && !r.publishedAt().isAfter(at))
                .filter(r -> allowUnscoped || r.effectiveFromPatchVariantId() != null)
                .filter(r -> ordinal(r, ordinals) <= context.rulesetOrdinal())
                .max(Comparator.<HeroRevisionView>comparingLong(r -> ordinal(r, ordinals))
                        .thenComparingLong(HeroRevisionView::publicationSequence));
    }

    private long ordinal(HeroRevisionView rev, Map<UUID, Long> cache) {
        return rev.effectiveFromPatchVariantId() == null
                ? 0
                : cache.computeIfAbsent(rev.effectiveFromPatchVariantId(), id -> contexts.variant(id).rulesetOrdinal());
    }

    public Map<String, Object> detail(UUID heroId, String region, String locale, boolean manifest) {
        return detail(heroId, region, locale, manifest, null, null, false);
    }

    public Map<String, Object> detail(UUID heroId, String region, String locale, boolean manifest,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        HeroValidation.locale(locale);

        Instant at = clock.instant();
        var moment = moments.resolve(region, at, seasonId, patchVariantId, includeUnscoped);
        var choice = selection.choose(heroId, moment, at).orElseThrow(() -> new ApiException(
                HeroErrorCode.HERO_NOT_FOUND, "No published hero is available in this context."));

        return details.page(heroId, choice, moment, at, locale, manifest);
    }

    /** The hero list; see {@link HeroListing} for what it holds with and without {@code playable}. */
    public HeroListView list(String region, String locale, int page, int size, String q, String role,
            String sort, UUID seasonId, UUID patchVariantId, boolean includeUnscoped, boolean playable) {
        return listing.list(region, locale, page, size, q, role, sort, seasonId, patchVariantId, includeUnscoped,
                playable);
    }

    /** The published revision readers see today of every hero in a market, keyed by hero, in code order. */
    public Map<HeroIdentity, HeroRevisionView> published(String region) {
        Instant at = clock.instant();
        var moment = moments.resolve(region, at, null, null, false);

        var heroes = store.heroes(false);
        var revisions = store.revisions(heroes.stream().map(HeroIdentity::getId).toList()).stream()
                .collect(Collectors.groupingBy(HeroRevisionView::heroId));

        Map<HeroIdentity, HeroRevisionView> result = new LinkedHashMap<>();
        for (var hero : heroes) {
            selection.choose(hero.getId(), revisions.getOrDefault(hero.getId(), List.of()), moment, at)
                    .ifPresent(choice -> result.put(hero, choice.revision()));
        }
        return result;
    }
}
