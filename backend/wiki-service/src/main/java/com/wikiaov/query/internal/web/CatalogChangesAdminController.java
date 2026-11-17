package com.wikiaov.query.internal.web;

import com.wikiaov.platform.*;
import com.wikiaov.query.internal.application.CatalogChangeQueries;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/catalog-changes")
public class CatalogChangesAdminController implements CatalogChangesAdminApi {
    private final CatalogChangeQueries changes;

    public CatalogChangesAdminController(CatalogChangeQueries changes) {
        this.changes = changes;
    }

    @GetMapping(version = "1")
    public List<CatalogChanges.Entry> list(@RequestParam UUID rulesetId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale, @RequestParam String domain,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "locale", "domain"));
        return changes.list(rulesetId, locale, domain);
    }
}
