package com.wikiaov.spell.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/spells")
public class SpellPublicController implements SpellPublicApi {
    private final SpellCatalog catalog;

    public SpellPublicController(SpellCatalog catalog) {
        this.catalog = catalog;
    }

    @Override
    @GetMapping(version = "1")
    public PageSlice<SpellView> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "page", "size", "seasonId", "patchVariantId", "includeUnscoped"));
        if (seasonId == null && patchVariantId == null) {
            return catalog.published(region, locale, page, size);
        }
        return catalog.published(region, locale, page, size, seasonId, patchVariantId, includeUnscoped);
    }

    @Override
    @GetMapping(path = "/{id}", version = "1")
    public SpellView read(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        if (seasonId == null && patchVariantId == null) {
            return catalog.publishedOne(id, region, locale);
        }
        return catalog.publishedOne(id, region, locale, seasonId, patchVariantId, includeUnscoped);
    }

    @Override
    @GetMapping(path = "/archived", version = "1")
    public PageSlice<SpellView> archived(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "page", "size", "seasonId", "patchVariantId", "includeUnscoped"));
        if (seasonId == null && patchVariantId == null) {
            return catalog.archives(region, locale, page, size);
        }
        return catalog.archives(region, locale, page, size, seasonId, patchVariantId, includeUnscoped);
    }
}
