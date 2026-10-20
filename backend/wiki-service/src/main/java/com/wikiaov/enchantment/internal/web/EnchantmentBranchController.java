package com.wikiaov.enchantment.internal.web;
import com.wikiaov.enchantment.internal.application.EnchantmentBranchCommand;
import com.wikiaov.enchantment.internal.application.EnchantmentOrdering;
import com.wikiaov.enchantment.internal.application.response.EnchantmentBranchView;
import com.wikiaov.enchantment.internal.application.service.EnchantmentBranchCatalog;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ADMIN + "/enchantment-branches")
public class EnchantmentBranchController {
    private final EnchantmentBranchCatalog catalog;
    public EnchantmentBranchController(EnchantmentBranchCatalog catalog) {
        this.catalog = catalog;
    }
    @GetMapping(version = "1")
    List<EnchantmentBranchView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.list();
    }
    @PutMapping(path = "/{code}", version = "1")
    EnchantmentBranchView save(@PathVariable String code, @Valid @RequestBody EnchantmentBranchCommand input) {
        return catalog.save(code, input);
    }
    @PutMapping(path = "/order", version = "1")
    List<EnchantmentBranchView> reorder(@Valid @RequestBody EnchantmentOrdering.Branches input) {
        return catalog.reorder(input);
    }
}
