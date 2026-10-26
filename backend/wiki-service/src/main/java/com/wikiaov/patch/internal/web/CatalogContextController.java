package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.response.CatalogContextView;
import com.wikiaov.patch.internal.context.application.CatalogContexts;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/catalog-context")
public class CatalogContextController implements CatalogContextApi {
    private final CatalogContexts contexts;

    public CatalogContextController(CatalogContexts contexts) {
        this.contexts = contexts;
    }

    @GetMapping(version = "1")
    public ResponseEntity<CatalogContextView> read(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(contexts.read(region, locale));
    }
}
