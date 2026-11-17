package com.wikiaov.enchantment.internal.web;

import com.wikiaov.enchantment.internal.application.EnchantmentBranchCommand;
import com.wikiaov.enchantment.internal.application.EnchantmentOrdering;
import com.wikiaov.enchantment.internal.application.response.EnchantmentBranchView;
import com.wikiaov.enchantment.internal.metadata.application.EnchantmentBranchCatalog;
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
@RequestMapping(ApiPaths.ADMIN + "/enchantment-branches")
public class EnchantmentBranchController implements EnchantmentBranchApi {
    private final EnchantmentBranchCatalog catalog;

    public EnchantmentBranchController(EnchantmentBranchCatalog catalog) {
        this.catalog = catalog;
    }

    @Override
    @GetMapping(version = "1")
    public List<EnchantmentBranchView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.list();
    }

    @Override
    @PutMapping(path = "/{code}", version = "1")
    public EnchantmentBranchView save(@PathVariable String code, @RequestBody EnchantmentBranchCommand input) {
        return catalog.save(code, input);
    }

    @Override
    @PutMapping(path = "/order", version = "1")
    public List<EnchantmentBranchView> reorder(@RequestBody EnchantmentOrdering.Branches input) {
        return catalog.reorder(input);
    }
}
