package com.wikiaov.enchantment.internal.web;

import com.wikiaov.enchantment.internal.application.response.PublicEnchantmentBranchView;
import com.wikiaov.enchantment.internal.metadata.application.PublicEnchantmentBranchCatalog;
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
@RequestMapping(ApiPaths.ROOT + "/enchantment-branches")
public class EnchantmentBranchPublicController implements EnchantmentBranchPublicApi {
    private final PublicEnchantmentBranchCatalog catalog;

    public EnchantmentBranchPublicController(PublicEnchantmentBranchCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public List<PublicEnchantmentBranchView> list(@RequestParam(defaultValue = "vi-VN") String locale,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return catalog.read(locale);
    }
}
