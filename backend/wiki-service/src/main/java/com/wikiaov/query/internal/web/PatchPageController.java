package com.wikiaov.query.internal.web;

import com.wikiaov.patch.PublishedPatch;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PublicResponses;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.query.internal.application.PatchChangesPage;
import com.wikiaov.query.internal.application.PatchPages;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.ServletWebRequest;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping(ApiPaths.ROOT + "/patches")
public class PatchPageController implements PatchPageApi {
    private final PatchPages pages;
    private final JsonMapper json;

    public PatchPageController(PatchPages pages, JsonMapper json) {
        this.pages = pages;
        this.json = json;
    }

    @Override
    @GetMapping(version = "1")
    public ResponseEntity<PageSlice<PublishedPatch>> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return current(pages.list(region, locale, page, size), request);
    }

    @Override
    @GetMapping(path = "/{id}", version = "1")
    public ResponseEntity<PublishedPatch> detail(@PathVariable UUID id,
            @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return current(pages.detail(id, region, locale), request);
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
        return current(pages.changes(id, region, locale, domain, patchVariantId, page, size), request);
    }

    private <T> ResponseEntity<T> current(T body, HttpServletRequest request) {
        return PublicResponses.current(body, new ServletWebRequest(request), json);
    }
}
