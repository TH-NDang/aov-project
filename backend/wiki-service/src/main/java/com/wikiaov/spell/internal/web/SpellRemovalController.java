package com.wikiaov.spell.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/spell-removals")
public class SpellRemovalController implements SpellRemovalApi {
    private final SpellCatalog catalog;

    public SpellRemovalController(SpellCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public List<Map<String, Object>> forVariant(@RequestParam UUID patchVariantId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("patchVariantId", "locale"));
        return catalog.authoringRemovals(patchVariantId, locale);
    }
}
