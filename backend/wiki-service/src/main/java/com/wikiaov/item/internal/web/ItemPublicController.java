package com.wikiaov.item.internal.web;

import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.catalog.application.ItemCatalog;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/items")
public class ItemPublicController implements ItemPublicApi {
    private final ItemCatalog catalog;

    public ItemPublicController(ItemCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public PageSlice<ItemView> list(@RequestParam(defaultValue = "VN") String region,
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

    @GetMapping(path = "/{id}", version = "1")
    public ItemView read(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
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
}
