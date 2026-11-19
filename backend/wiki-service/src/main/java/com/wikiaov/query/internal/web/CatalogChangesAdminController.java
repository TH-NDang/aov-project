package com.wikiaov.query.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.query.internal.application.CatalogChangeQueries;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/catalog-changes")
public class CatalogChangesAdminController implements CatalogChangesAdminApi {
    private final CatalogChangeQueries changes;

    public CatalogChangesAdminController(CatalogChangeQueries changes) {
        this.changes = changes;
    }

    @Override
    @GetMapping(version = "1")
    public List<CatalogChanges.Entry> list(@RequestParam UUID rulesetId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale, @RequestParam String domain,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "locale", "domain"));
        return changes.list(rulesetId, locale, domain);
    }
}
