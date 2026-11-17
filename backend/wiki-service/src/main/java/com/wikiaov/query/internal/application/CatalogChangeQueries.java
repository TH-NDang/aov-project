package com.wikiaov.query.internal.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogChangeProvider;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PlatformErrorCode;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

/** Reads the change history of one catalog domain for the admin, through the provider that domain registers. */
@Service
public class CatalogChangeQueries {
    private final List<CatalogChangeProvider> providers;
    private final GameplayContexts contexts;

    public CatalogChangeQueries(List<CatalogChangeProvider> providers, GameplayContexts contexts) {
        this.providers = providers;
        this.contexts = contexts;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public List<CatalogChanges.Entry> list(UUID rulesetId, String locale, String domain) {
        if (!locale.matches(CatalogLocales.PATTERN)) {
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid locale.");
        }

        contexts.requireRuleset(rulesetId);
        var provider = providers.stream().filter(p -> p.domain().equals(domain)).findFirst()
                .orElseThrow(() -> new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                        "Unsupported change domain."));

        return provider.changes(rulesetId, locale);
    }
}
