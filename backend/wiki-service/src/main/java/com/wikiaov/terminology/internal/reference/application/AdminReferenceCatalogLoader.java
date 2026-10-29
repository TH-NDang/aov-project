package com.wikiaov.terminology.internal.reference.application;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.terminology.AdminReferenceProvider;
import com.wikiaov.terminology.internal.application.response.AdminReferenceCatalogView;
import com.wikiaov.terminology.internal.domain.HeroReferenceAliases;
import com.wikiaov.terminology.internal.settings.application.HeroAliasConfiguration;
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
    private final HeroAliasConfiguration aliases;

    public AdminReferenceCatalogLoader(GameplayContexts contexts, List<AdminReferenceProvider> providers,
            HeroAliasConfiguration aliases) {
        this.contexts = contexts;
        this.providers = providers;
        this.aliases = aliases;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AdminReferenceCatalogView read(UUID rulesetId) {
        var ordinals = contexts.rulesetVariants(rulesetId).stream()
                .collect(Collectors.toMap(v -> v.id(), v -> v.rulesetOrdinal()));
        var supplemental = aliases.read();
        var items = providers.stream().flatMap(p -> p.references(rulesetId, ordinals).stream())
                .map(candidate -> overlay(candidate, supplemental))
                .sorted(Comparator.comparing(AdminReferenceProvider.Candidate::kind)
                        .thenComparing(c -> c.id().toString()))
                .toList();
        return new AdminReferenceCatalogView(rulesetId, items);
    }

    private static AdminReferenceProvider.Candidate overlay(AdminReferenceProvider.Candidate candidate,
            Map<String, Map<String, List<String>>> supplemental) {
        if (!candidate.kind().equals("hero"))
            return candidate;
        var localized = supplemental.getOrDefault(candidate.id().toString(), Map.of());
        var translations = candidate.translations().stream()
                .map(text -> new AdminReferenceProvider.Translation(text.locale(), text.name(),
                        HeroReferenceAliases.merge(text.aliases(),
                                localized.getOrDefault(text.locale().toLowerCase(Locale.ROOT), List.of())),
                        text.description()))
                .toList();
        return new AdminReferenceProvider.Candidate(candidate.id(), candidate.kind(), translations,
                candidate.iconAssetId(), candidate.autoMatch(), candidate.destinations());
    }
}
