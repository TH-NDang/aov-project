package com.wikiaov.community.tournament.internal.catalog.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.application.TournamentErrorCode;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.catalog.application.port.WikiCatalogSource;
import com.wikiaov.community.tournament.internal.catalog.application.port.WikiCatalogSource.Patch;
import com.wikiaov.community.tournament.internal.catalog.application.port.WikiCatalogSource.ReferenceScope;
import com.wikiaov.community.tournament.internal.catalog.application.port.WikiCatalogSource.Season;
import com.wikiaov.community.tournament.internal.domain.CatalogContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.CatalogContent.Reference;
import com.wikiaov.community.tournament.internal.domain.CatalogContent.ResolvedContext;
import com.wikiaov.community.tournament.internal.domain.CatalogLocales;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * The wiki references a game records, for one market, locale and patch. Answers are cached for a minute; the source
 * is reached through {@link WikiCatalogSource}.
 */
@Service
public class WikiCatalog {
    /** A catalog with more pages than this per reference list is refused rather than read without end. */
    private static final int MAX_REFERENCE_PAGES = 100;
    private static final int MAX_CACHED_CATALOGS = 128;
    private static final long CACHE_SECONDS = 60;

    private record Key(
            String region,
            String locale,
            UUID season,
            UUID patch,
            boolean unscoped
    ) {
        ReferenceScope scope() {
            return new ReferenceScope(region, locale, season, patch, unscoped);
        }
    }

    private record Cached(
            Catalog catalog,
            Instant expiresAt
    ) {
    }

    private final WikiCatalogSource source;
    private final Map<Key, Cached> cache = new ConcurrentHashMap<>();

    public WikiCatalog(WikiCatalogSource source) {
        this.source = source;
    }

    public Catalog read(String region, String locale, UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        if (region == null || !region.matches("[A-Z]{2,16}") || !CatalogLocales.supported(locale)) {
            throw TournamentErrors.invalid("Choose a valid region and supported locale.");
        }
        var key = new Key(region, locale, seasonId, patchVariantId, includeUnscoped);
        var cached = cache.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.catalog();
        }

        try {
            if (!marketAvailable(region)) {
                if (seasonId != null || patchVariantId != null) {
                    throw TournamentErrors.invalid(
                            "Historical wiki data is unavailable for this market. Record observed names without a linked patch.");
                }
                var unknown = new ResolvedContext(region, locale, null, null, null, null, null, null, true,
                        includeUnscoped);
                return remember(key, new Catalog(List.of(), List.of(), List.of(), List.of(), List.of(), unknown));
            }

            var context = context(key);
            var resolved = new Key(region, locale, context.seasonId(), context.patchVariantId(), includeUnscoped);
            return remember(key, new Catalog(references("heroes", resolved), references("items", resolved),
                    references("arcana", resolved), references("enchantments", resolved),
                    references("spells", resolved), context));
        } catch (WikiCatalogSource.Unavailable unavailable) {
            throw new ApiException(TournamentErrorCode.TOURNAMENT_WIKI_UNAVAILABLE,
                    "The published wiki catalog is unavailable. Retry before publishing.", unavailable);
        }
    }

    private Catalog remember(Key key, Catalog catalog) {
        if (cache.size() > MAX_CACHED_CATALOGS) {
            cache.clear();
        }
        cache.put(key, new Cached(catalog, Instant.now().plusSeconds(CACHE_SECONDS)));
        return catalog;
    }

    private boolean marketAvailable(String region) {
        return source.markets().stream().filter(market -> region.equals(market.code())).findFirst()
                .map(WikiCatalogSource.Market::available)
                .orElseThrow(() -> TournamentErrors.invalid("Choose a known game market."));
    }

    /** The season and patch the game names; with a season only, its latest patch. */
    private ResolvedContext context(Key key) {
        var data = source.context(key.region(), key.locale());
        Season selectedSeason = null;
        Patch selectedPatch = null;
        for (var season : data.seasons()) {
            for (var patch : season.patches()) {
                boolean selected = key.patch() != null
                        ? key.patch().equals(patch.id())
                        : key.season() != null && key.season().equals(season.id());
                if (selected && (selectedPatch == null || patch.ordinal() > selectedPatch.ordinal())) {
                    selectedSeason = season;
                    selectedPatch = patch;
                }
            }
        }

        if ((key.season() != null || key.patch() != null) && selectedPatch == null) {
            throw TournamentErrors.invalid("The selected season or patch is unavailable in this market.");
        }
        if (key.season() != null && !key.season().equals(selectedSeason.id())) {
            throw TournamentErrors.invalid("The selected patch does not belong to this season.");
        }

        if (selectedPatch == null) {
            return new ResolvedContext(key.region(), key.locale(), data.currentRulesetId(), null, null, null, null,
                    null, true, key.unscoped());
        }
        return new ResolvedContext(key.region(), key.locale(),
                selectedPatch.rulesetId() != null ? selectedPatch.rulesetId() : data.currentRulesetId(),
                selectedSeason.id(),
                selectedSeason.name(), selectedPatch.id(), selectedPatch.code(), selectedPatch.title(), false,
                key.unscoped());
    }

    private List<Reference> references(String kind, Key key) {
        var result = new ArrayList<Reference>();
        for (int page = 0; page < MAX_REFERENCE_PAGES; page++) {
            var data = source.references(kind, key.scope(), page);
            result.addAll(data.items());
            if (data.items().isEmpty() || result.size() >= data.totalElements()) {
                return List.copyOf(result);
            }
        }
        throw new ApiException(TournamentErrorCode.TOURNAMENT_CATALOG_LIMIT,
                "The wiki catalog exceeds the supported reference limit.");
    }
}
