package com.wikiaov.item.internal.web;
import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.application.service.ItemCatalog;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ROOT + "/items")
public class ItemPublicController implements ItemPublicApi {
    private final ItemCatalog catalog;
    public ItemPublicController(ItemCatalog catalog) {
        this.catalog = catalog;
    }
    @GetMapping(version = "1")
    public PageSlice<ItemView> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return catalog.published(region, locale, page, size);
    }
    @GetMapping(path = "/{id}", version = "1")
    public ItemView read(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return catalog.publishedOne(id, region, locale);
    }
}
