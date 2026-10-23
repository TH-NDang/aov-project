package com.wikiaov.spell.internal.web;

import com.wikiaov.platform.*;
import com.wikiaov.spell.internal.catalog.application.SpellCatalog;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/spell-removals")
public class SpellRemovalController implements SpellRemovalApi {
    private final SpellCatalog catalog;

    public SpellRemovalController(SpellCatalog catalog) {
        this.catalog = catalog;
    }

    @GetMapping(version = "1")
    public List<Map<String, Object>> forVariant(@RequestParam UUID patchVariantId,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("patchVariantId", "locale"));
        return catalog.authoringRemovals(patchVariantId, locale);
    }
}
