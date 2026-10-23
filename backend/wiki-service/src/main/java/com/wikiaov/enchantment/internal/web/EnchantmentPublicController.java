package com.wikiaov.enchantment.internal.web;

import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.enchantment.internal.catalog.application.EnchantmentCatalog;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ROOT + "/enchantments")
public class EnchantmentPublicController implements EnchantmentPublicApi {
    private final EnchantmentCatalog catalog;

    public EnchantmentPublicController(EnchantmentCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public PageSlice<EnchantmentView> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return catalog.published(region, locale, page, size);
    }

    @GetMapping(path = "/{id}", version = "1")
    public EnchantmentView read(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return catalog.publishedOne(id, region, locale);
    }
}
