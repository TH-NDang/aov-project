package com.wikiaov.terminology.internal.reference.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.terminology.AdminReferenceProvider;
import com.wikiaov.terminology.internal.application.response.AdminReferenceCatalogView;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** A consistent database snapshot is complete before cache I/O begins. */
@Service
public class AdminReferenceCatalogLoader {
    private final GameplayContexts contexts;
    private final List<AdminReferenceProvider> providers;

    public AdminReferenceCatalogLoader(GameplayContexts contexts, List<AdminReferenceProvider> providers) {
        this.contexts = contexts;
        this.providers = providers;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AdminReferenceCatalogView read(UUID rulesetId) {
        var ordinals = contexts.rulesetVariants(rulesetId).stream()
                .collect(Collectors.toMap(v -> v.id(), v -> v.rulesetOrdinal()));
        var items = providers.stream().flatMap(p -> p.references(rulesetId, ordinals).stream())
                .sorted(Comparator.comparing(AdminReferenceProvider.Candidate::kind)
                        .thenComparing(c -> c.id().toString()))
                .toList();
        return new AdminReferenceCatalogView(rulesetId, items);
    }
}
