package com.wikiaov.query.internal.web;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/catalog-changes")
public class CatalogChangesAdminController implements CatalogChangesAdminApi {
    private final List<CatalogChangeProvider> providers;
    private final GameplayContexts contexts;

    public CatalogChangesAdminController(List<CatalogChangeProvider> providers, GameplayContexts contexts) {
        this.providers = providers;
        this.contexts = contexts;
    }

    @GetMapping(version = "1")
    @PreAuthorize("hasAuthority('catalog:read')")
    public List<CatalogChanges.Entry> list(@RequestParam UUID rulesetId,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam String domain,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "locale", "domain"));
        if (!locale.matches("[a-z]{2,3}(?:-[A-Z]{2})?"))
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid locale.");
        contexts.requireRuleset(rulesetId);
        var provider = providers.stream().filter(p -> p.domain().equals(domain)).findFirst()
                .orElseThrow(() -> new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                        "Unsupported change domain."));
        return provider.changes(rulesetId, locale);
    }
}
