package com.wikiaov.spell.internal.web;

import com.wikiaov.platform.*;
import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ROOT + "/spells")
public class SpellPublicController implements SpellPublicApi {
    private final SpellCatalog catalog;

    public SpellPublicController(SpellCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public PageSlice<SpellView> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "page", "size", "seasonId", "patchVariantId", "includeUnscoped"));
        if (seasonId == null && patchVariantId == null)
            return catalog.published(region, locale, page, size);
        return catalog.published(region, locale, page, size, seasonId, patchVariantId, includeUnscoped);
    }

    @GetMapping(path = "/{id}", version = "1")
    public SpellView read(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        if (seasonId == null && patchVariantId == null)
            return catalog.publishedOne(id, region, locale);
        return catalog.publishedOne(id, region, locale, seasonId, patchVariantId, includeUnscoped);
    }

    @GetMapping(path = "/archived", version = "1")
    public PageSlice<SpellView> archived(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "page", "size", "seasonId", "patchVariantId", "includeUnscoped"));
        if (seasonId == null && patchVariantId == null)
            return catalog.archives(region, locale, page, size);
        return catalog.archives(region, locale, page, size, seasonId, patchVariantId, includeUnscoped);
    }
}
