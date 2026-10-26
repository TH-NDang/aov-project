package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.PublicSkinCatalogView;
import com.wikiaov.hero.internal.skins.application.PublicSkinCatalog;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/skins")
public class PublicSkinCatalogController implements PublicSkinCatalogApi {
    private final PublicSkinCatalog catalog;

    public PublicSkinCatalogController(PublicSkinCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public ResponseEntity<PublicSkinCatalogView> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String hero, @RequestParam(required = false) String rarity,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "q", "hero", "rarity", "page", "size",
                "seasonId", "patchVariantId", "includeUnscoped"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(seasonId == null && patchVariantId == null
                        ? catalog.read(region, locale, q, hero, rarity, page, size)
                        : catalog.read(region, locale, q, hero, rarity, page, size, seasonId, patchVariantId,
                                includeUnscoped));
    }
}
