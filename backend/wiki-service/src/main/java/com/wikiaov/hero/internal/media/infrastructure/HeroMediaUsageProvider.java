package com.wikiaov.hero.internal.media.infrastructure;

import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.media.persistence.HeroMediaUsageRepository;
import com.wikiaov.media.*;
import com.wikiaov.patch.GameplayContexts;
import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class HeroMediaUsageProvider implements MediaUsageProvider {
    private final HeroMediaUsageRepository repository;
    private final HeroQueries queries;
    private final GameplayContexts contexts;
    private final Clock clock;

    public HeroMediaUsageProvider(HeroMediaUsageRepository repository, HeroQueries queries, GameplayContexts contexts,
            Clock clock) {
        this.repository = repository;
        this.queries = queries;
        this.contexts = contexts;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        var rows = repository.findUsages(assetId);
        var at = clock.instant();
        var active = contexts.active(at);
        Set<UUID> current = new HashSet<>();
        for (var row : rows) {
            UUID hero = row.getHeroId();
            for (var ctx : active)
                queries.current(hero, ctx, at).ifPresent(r -> current.add(r.id()));
        }
        return rows.stream().map(row -> {
            UUID id = row.getRevisionId();
            return new MediaUsage("HERO", "HERO", row.getHeroId(), id, row.getRole(),
                    "DRAFT".equals(row.getState())
                            ? MediaUsageScope.DRAFT
                            : current.contains(id) ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
        }).toList();
    }
}
