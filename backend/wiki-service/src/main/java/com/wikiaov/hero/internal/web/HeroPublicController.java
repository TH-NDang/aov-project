package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.security.*;
import java.time.Duration;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class HeroPublicController implements HeroPublicApi {
    private final HeroQueries queries;
    private final JsonMapper json;

    public HeroPublicController(HeroQueries queries, JsonMapper json) {
        this.queries = queries;
        this.json = json;
    }

    @GetMapping(path = "/heroes", version = "1")
    public ResponseEntity<?> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String role, @RequestParam(defaultValue = "code,asc") String sort,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size", "q", "role", "sort", "seasonId",
                "patchVariantId", "includeUnscoped"));
        return cached(seasonId == null && patchVariantId == null
                ? queries.list(region, locale, page, size, q, role, sort)
                : queries.list(region, locale, page, size, q, role, sort, seasonId, patchVariantId, includeUnscoped),
                web, false);
    }

    @GetMapping(path = "/heroes/{heroId}", version = "1")
    public ResponseEntity<?> detail(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return cached(seasonId == null && patchVariantId == null
                ? queries.detail(heroId, region, locale, false)
                : queries.detail(heroId, region, locale, false, seasonId, patchVariantId, includeUnscoped), web, false);
    }

    @GetMapping(path = "/heroes/{heroId}/manifest", version = "1")
    public ResponseEntity<?> manifest(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return cached(seasonId == null && patchVariantId == null
                ? queries.detail(heroId, region, locale, true)
                : queries.detail(heroId, region, locale, true, seasonId, patchVariantId, includeUnscoped), web, false);
    }

    @GetMapping(path = "/hero-profile-revisions/{id}", version = "1")
    public ResponseEntity<?> sectionPROFILE(@PathVariable UUID id, @RequestParam(defaultValue = "vi-VN") String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(queries.section(HeroSection.PROFILE, id, locale), web, true);
    }

    @GetMapping(path = "/hero-overview-rating-revisions/{id}", version = "1")
    public ResponseEntity<?> sectionOVERVIEW_RATINGS(@PathVariable UUID id,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(queries.section(HeroSection.OVERVIEW_RATINGS, id, locale), web, true);
    }

    @GetMapping(path = "/hero-stats-revisions/{id}", version = "1")
    public ResponseEntity<?> sectionCOMBAT_STATS(@PathVariable UUID id,
            @RequestParam(defaultValue = "vi-VN") String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(queries.section(HeroSection.COMBAT_STATS, id, locale), web, true);
    }

    @GetMapping(path = "/hero-skills-revisions/{id}", version = "1")
    public ResponseEntity<?> sectionSKILLS(@PathVariable UUID id, @RequestParam(defaultValue = "vi-VN") String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(queries.section(HeroSection.SKILLS, id, locale), web, true);
    }

    @GetMapping(path = "/hero-skins-revisions/{id}", version = "1")
    public ResponseEntity<?> sectionSKINS(@PathVariable UUID id, @RequestParam(defaultValue = "vi-VN") String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(queries.section(HeroSection.SKINS, id, locale), web, true);
    }

    @GetMapping(path = "/hero-media-binding-revisions/{id}", version = "1")
    public ResponseEntity<?> sectionMEDIA_BINDINGS(@PathVariable UUID id,
            @RequestParam(defaultValue = "vi-VN") String locale,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return cached(queries.section(HeroSection.MEDIA_BINDINGS, id, locale), web, true);
    }

    private ResponseEntity<?> cached(Object body, WebRequest request, boolean immutable) {
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
        if (request.checkNotModified(tag))
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(tag).cacheControl(cache).build();
        return ResponseEntity.ok().eTag(tag).cacheControl(cache).body(body);
    }
}
