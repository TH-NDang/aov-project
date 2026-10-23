package com.wikiaov.terminology.internal.reference.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.RulesetReference;
import com.wikiaov.platform.ReadModelCache;
import com.wikiaov.platform.ReadModelCache.Area;
import com.wikiaov.terminology.internal.application.response.AdminReferenceCatalogView;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

@Service
public class AdminReferenceCatalog {
    private final GameplayContexts contexts;
    private final AdminReferenceCatalogLoader loader;
    private final ReadModelCache cache;

    public AdminReferenceCatalog(GameplayContexts contexts, AdminReferenceCatalogLoader loader, ReadModelCache cache) {
        this.contexts = contexts;
        this.loader = loader;
        this.cache = cache;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public AdminReferenceCatalogView read(UUID requestedRulesetId) {
        var rulesets = contexts.rulesets();
        var selected = rulesets.stream().filter(r -> r.id().equals(requestedRulesetId)).findFirst()
                .or(() -> rulesets.stream().filter(r -> r.code().equals("aov-standard")).findFirst())
                .or(() -> rulesets.stream().findFirst()).map(RulesetReference::id).orElse(null);
        if (selected == null)
            return new AdminReferenceCatalogView(null, List.of());
        return cache.read(Area.ADMIN_REFERENCES, selected.toString(), AdminReferenceCatalogView.class,
                () -> loader.read(selected));
    }
}
