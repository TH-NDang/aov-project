package com.wikiaov.item.internal.web;

import com.wikiaov.item.internal.application.response.PublicItemCategoryView;
import com.wikiaov.item.internal.metadata.application.PublicItemCategoryCatalog;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/item-categories")
public class ItemCategoryPublicController implements ItemCategoryPublicApi {
    private final PublicItemCategoryCatalog catalog;

    public ItemCategoryPublicController(PublicItemCategoryCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public List<PublicItemCategoryView> list(@RequestParam(defaultValue = "vi-VN") String locale,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return catalog.read(locale);
    }
}
