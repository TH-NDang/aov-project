package com.wikiaov.arcana.internal.web;
import com.wikiaov.arcana.internal.application.response.ArcanaView;
import com.wikiaov.arcana.internal.application.service.ArcanaCatalog;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ROOT + "/arcana")
public class ArcanaPublicController {
    private final ArcanaCatalog catalog;
    public ArcanaPublicController(ArcanaCatalog catalog) {
        this.catalog = catalog;
    }
    @GetMapping(version = "1")
    PageSlice<ArcanaView> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return catalog.published(region, locale, page, size);
    }
    @GetMapping(path = "/{id}", version = "1")
    ArcanaView read(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return catalog.publishedOne(id, region, locale);
    }
}
