package com.wikiaov.query.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.query.internal.application.PatchChangesPage;
import com.wikiaov.query.internal.application.PatchPages;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/patches")
public class PatchPageController implements PatchPageApi {
    private final PatchPages pages;

    public PatchPageController(PatchPages pages) {
        this.pages = pages;
    }

    @Override
    @GetMapping(version = "1")
    public ResponseEntity<PageSlice<Map<String, Object>>> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(pages.list(region, locale, page, size));
    }

    @Override
    @GetMapping(path = "/{id}", version = "1")
    public ResponseEntity<Map<String, Object>> detail(@PathVariable UUID id,
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(pages.detail(id, region, locale));
    }

    @Override
    @GetMapping(path = "/{id}/changes", version = "1")
    public ResponseEntity<PatchChangesPage> changes(@PathVariable UUID id,
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "HERO") String domain, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "domain", "patchVariantId", "page", "size"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(pages.changes(id, region, locale, domain, patchVariantId, page, size));
    }
}
