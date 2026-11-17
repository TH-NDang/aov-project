package com.wikiaov.item.internal.web;

import com.wikiaov.item.internal.application.ItemCategoryCommand;
import com.wikiaov.item.internal.application.response.ItemCategoryView;
import com.wikiaov.item.internal.metadata.application.ItemCategoryCatalog;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/item-categories")
public class ItemCategoryController implements ItemCategoryApi {
    private final ItemCategoryCatalog catalog;

    public ItemCategoryController(ItemCategoryCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public List<ItemCategoryView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.list();
    }

    @PutMapping(path = "/{code}", version = "1")
    public ItemCategoryView save(@PathVariable String code, @RequestBody ItemCategoryCommand input) {
        return catalog.save(code, input);
    }
}
