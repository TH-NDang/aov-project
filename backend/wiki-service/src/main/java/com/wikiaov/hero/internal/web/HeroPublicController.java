package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.catalog.application.HeroSectionPages;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
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

    public HeroPublicController(HeroQueries queries, HeroSectionPages sectionPages, JsonMapper json) {
        this.queries = queries;
        this.sectionPages = sectionPages;
        this.json = json;
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
        return cached(queries.list(region, locale, page, size, q, role, sort, seasonId, patchVariantId,
                includeUnscoped, playable), web, false);
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
        String tag;
        try {
            tag = "\"" + HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(body))) + "\"";
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        var cache = immutable
                ? CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable()
                : CacheControl.maxAge(Duration.ZERO).cachePublic().mustRevalidate();
        if (request.checkNotModified(tag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(tag).cacheControl(cache).build();
        }
        return ResponseEntity.ok().eTag(tag).cacheControl(cache).body(body);
    }
}
