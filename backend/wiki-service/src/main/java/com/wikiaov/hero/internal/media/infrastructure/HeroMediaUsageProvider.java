package com.wikiaov.hero.internal.media.infrastructure;

import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.media.persistence.HeroMediaUsageRepository;
import com.wikiaov.hero.internal.media.persistence.HeroMediaUsageRepository.OwnerName;
import com.wikiaov.hero.internal.media.persistence.HeroMediaUsageRepository.PartName;
import com.wikiaov.hero.internal.media.persistence.HeroMediaUsageRepository.Usage;
import com.wikiaov.media.*;
import java.time.Clock;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class HeroMediaUsageProvider implements MediaUsageProvider {
    private static final UUID ANY_ASSET = new UUID(0, 0);
    private static final String DISPLAY_LOCALE = "vi-VN";

    private final HeroMediaUsageRepository repository;
    private final HeroQueries queries;
    private final Clock clock;

    public HeroMediaUsageProvider(HeroMediaUsageRepository repository, HeroQueries queries, Clock clock) {
        this.repository = repository;
        this.queries = queries;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        var rows = repository.findUsages(assetId, false);
        return named(usages(rows, current(rows)));
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        var rows = repository.findUsages(ANY_ASSET, true);
        var current = current(rows);

        return rows.stream().collect(Collectors.groupingBy(Usage::getAssetId,
                Collectors.collectingAndThen(Collectors.toList(), asset -> usages(asset, current))));
    }

    private Set<UUID> current(List<Usage> rows) {
        var heroes = rows.stream().map(Usage::getHeroId).collect(Collectors.toSet());
        return heroes.isEmpty() ? Set.of() : queries.currentRevisionIds(heroes, clock.instant());
    }

    /** One entry per place in a revision; a main image also listed among the options stays shown. */
    private static List<MediaUsage> usages(List<Usage> rows, Set<UUID> current) {
        Map<String, MediaUsage> places = new LinkedHashMap<>();
        for (var row : rows) {
            var usage = new MediaUsage("HERO", "HERO", row.getHeroId(), row.getRevisionId(), row.getRole(),
                    "DRAFT".equals(row.getState())
                            ? MediaUsageScope.DRAFT
                            : current.contains(row.getRevisionId())
                                    ? MediaUsageScope.CURRENT
                                    : MediaUsageScope.HISTORICAL,
                    Boolean.TRUE.equals(row.getShown()), null, null);
            places.merge(row.getRevisionId() + ":" + row.getRole(), usage,
                    (first, second) -> first.shown() ? first : second);
        }

        return List.copyOf(places.values());
    }

    private List<MediaUsage> named(List<MediaUsage> usages) {
        if (usages.isEmpty())
            return usages;

        var revisions = usages.stream().map(MediaUsage::revisionId).collect(Collectors.toSet());
        var heroes = preferred(repository.heroNames(revisions), OwnerName::getRevisionId);
        var skins = preferred(repository.skinNames(revisions), HeroMediaUsageProvider::partId);
        var skills = preferred(repository.skillNames(revisions), HeroMediaUsageProvider::partId);

        return usages.stream().map(usage -> {
            var role = usage.propertyRole();
            int colon = role.indexOf(':');
            var key = usage.revisionId() + ":" + role.substring(colon + 1);
            return usage.named(heroes.get(usage.revisionId()),
                    colon < 0 ? null : role.startsWith("SKIN_") ? skins.get(key) : skills.get(key));
        }).toList();
    }

    private static String partId(PartName name) {
        return name.getRevisionId() + ":" + name.getPartKey();
    }

    /** Vietnamese first, then a stable choice, so a place keeps its name between requests. */
    private static <K, T extends OwnerName> Map<K, String> preferred(List<T> names, Function<T, K> key) {
        Comparator<OwnerName> order = Comparator.comparing((OwnerName name) -> !DISPLAY_LOCALE.equals(name.getLocale()))
                .thenComparing(OwnerName::getLocale);

        return names.stream().collect(Collectors.groupingBy(key,
                Collectors.collectingAndThen(Collectors.minBy(order), best -> best
                        .orElseThrow(() -> new IllegalStateException("A grouped place has no name.")).getName())));
    }
}
