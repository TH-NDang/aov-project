package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroListView;
import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.catalog.application.HeroSectionPages;
import com.wikiaov.hero.internal.catalog.application.PublicCatalogCache;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PublicResponses;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class HeroPublicController implements HeroPublicApi {
    private final HeroQueries queries;
    private final HeroSectionPages sectionPages;
    private final JsonMapper json;
    private final PublicCatalogCache catalogs;

    public HeroPublicController(HeroQueries queries, HeroSectionPages sectionPages, JsonMapper json,
            PublicCatalogCache catalogs) {
        this.queries = queries;
        this.sectionPages = sectionPages;
        this.json = json;
        this.catalogs = catalogs;
    }

    @Override
    @GetMapping(path = "/heroes", version = "1")
    public ResponseEntity<?> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String role, @RequestParam(defaultValue = "code,asc") String sort,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            @RequestParam(defaultValue = "false") boolean playable, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size", "q", "role", "sort", "seasonId",
                "patchVariantId", "includeUnscoped", "playable"));
        Supplier<HeroListView> read = () -> queries.list(region, locale, page, size, q, role, sort, seasonId,
                patchVariantId, includeUnscoped, playable);
        return cached(seasonId == null && patchVariantId == null && !includeUnscoped
                ? catalogs.current("heroes", region, String.join("|", locale, String.valueOf(page),
                        String.valueOf(size), String.valueOf(role), sort, String.valueOf(playable), q),
                        HeroListView.class, read)
                : read.get(), web, false);
    }

    @Override
    @GetMapping(path = "/heroes/{heroId}", version = "1")
    public ResponseEntity<?> detail(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return cached(seasonId == null && patchVariantId == null
                ? queries.detail(heroId, region, locale, false)
                : queries.detail(heroId, region, locale, false, seasonId, patchVariantId, includeUnscoped), web, false);
    }

    @Override
    @GetMapping(path = "/heroes/{heroId}/manifest", version = "1")
    public ResponseEntity<?> manifest(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return cached(seasonId == null && patchVariantId == null
                ? queries.detail(heroId, region, locale, true)
                : queries.detail(heroId, region, locale, true, seasonId, patchVariantId, includeUnscoped), web, false);
    }

    @Override
    @GetMapping(path = "/hero-profile-revisions/{id}", version = "1")
    public ResponseEntity<HeroSectionPages.ProfilePage> sectionPROFILE(@PathVariable UUID id,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(sectionPages.profile(id, locale), web, true);
    }

    @Override
    @GetMapping(path = "/hero-overview-rating-revisions/{id}", version = "1")
    public ResponseEntity<HeroSectionPages.RatingsPage> sectionOVERVIEW_RATINGS(@PathVariable UUID id,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale, HttpServletRequest request,
            WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(sectionPages.ratings(id, locale), web, true);
    }

    @Override
    @GetMapping(path = "/hero-stats-revisions/{id}", version = "1")
    public ResponseEntity<HeroSectionPages.StatsPage> sectionCOMBAT_STATS(@PathVariable UUID id,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(sectionPages.stats(id, locale), web, true);
    }

    @Override
    @GetMapping(path = "/hero-skills-revisions/{id}", version = "1")
    public ResponseEntity<HeroSectionPages.SkillsPage> sectionSKILLS(@PathVariable UUID id,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(sectionPages.skills(id, locale), web, true);
    }

    @Override
    @GetMapping(path = "/hero-skins-revisions/{id}", version = "1")
    public ResponseEntity<HeroSectionPages.SkinsPage> sectionSKINS(@PathVariable UUID id,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(sectionPages.skins(id, locale), web, true);
    }

    @Override
    @GetMapping(path = "/hero-media-binding-revisions/{id}", version = "1")
    public ResponseEntity<HeroSectionPages.BindingsPage> sectionMEDIA_BINDINGS(@PathVariable UUID id,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(sectionPages.bindings(id, locale), web, true);
    }

    private <T> ResponseEntity<T> cached(T body, WebRequest request, boolean immutable) {
        return PublicResponses.tagged(body, request, json, immutable
                ? CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable()
                : PublicResponses.current());
    }
}
