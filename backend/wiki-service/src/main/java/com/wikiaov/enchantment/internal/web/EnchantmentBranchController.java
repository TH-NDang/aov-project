package com.wikiaov.enchantment.internal.web;
import com.wikiaov.enchantment.internal.application.EnchantmentBranchCommand;
import com.wikiaov.enchantment.internal.application.EnchantmentOrdering;
import com.wikiaov.enchantment.internal.application.response.EnchantmentBranchView;
import com.wikiaov.enchantment.internal.application.service.EnchantmentBranchCatalog;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ADMIN + "/enchantment-branches")
public class EnchantmentBranchController implements EnchantmentBranchApi {
    private final EnchantmentBranchCatalog catalog;
    public EnchantmentBranchController(EnchantmentBranchCatalog catalog) {
        this.catalog = catalog;
    }
    @GetMapping(version = "1")
    public List<EnchantmentBranchView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.list();
    }
    @PutMapping(path = "/{code}", version = "1")
    public EnchantmentBranchView save(@PathVariable String code, @RequestBody EnchantmentBranchCommand input) {
        return catalog.save(code, input);
    }
    @PutMapping(path = "/order", version = "1")
    public List<EnchantmentBranchView> reorder(@RequestBody EnchantmentOrdering.Branches input) {
        return catalog.reorder(input);
    }
}
