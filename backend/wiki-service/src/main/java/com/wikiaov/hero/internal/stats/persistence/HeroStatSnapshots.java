package com.wikiaov.hero.internal.stats.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import com.wikiaov.hero.internal.stats.persistence.entity.StatRow;
import com.wikiaov.hero.internal.stats.persistence.entity.StatsRevision;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroStatSnapshots implements HeroSectionSnapshots {
    private final StatsRevisionRepository revisions;
    private final StatRepository stats;
    private final HeroSectionLifecycle lifecycle;
    private final HeroSectionSources sources;

    @Override
    public HeroSection section() {
        return HeroSection.COMBAT_STATS;
    }

    @Override
    public com.wikiaov.hero.internal.sections.persistence.SectionRevisionRepository<?> revisions() {
        return revisions;
    }

    @Override
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new StatsRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Stats) content;
            stats.saveAll(value.values().stream().map(v -> new StatRow(revision.getId(), v.statKey(),
                    v.baseValue(), v.growthPerLevel(), v.unit())).toList());
            sources.save(section(), revision.getId(), value.sources());
        }
        revisions.flush();
        return revision.getId();
    }

    @Override
    public Stats content(UUID id) {
        return contents(Collections.singletonList(id)).get(id);
    }

    /** Reads many snapshots in a bounded number of queries, for lists that cover every hero. */
    public Map<UUID, Stats> contents(Collection<UUID> ids) {
        var references = sources.find(section(), ids);
        var values = stats.findByStatsRevisionIdIn(ids, Sort.by("statKey")).stream()
                .collect(Collectors.groupingBy(StatRow::getStatsRevisionId,
                        Collectors.mapping(v -> new Stat(v.getStatKey(), v.getBaseValue(), v.getGrowthPerLevel(),
                                v.getUnitCode()), Collectors.toList())));

        Map<UUID, Stats> result = new HashMap<>();
        for (UUID id : ids)
            result.put(id, new Stats(values.getOrDefault(id, List.of()), references.getOrDefault(id, List.of())));
        return result;
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
