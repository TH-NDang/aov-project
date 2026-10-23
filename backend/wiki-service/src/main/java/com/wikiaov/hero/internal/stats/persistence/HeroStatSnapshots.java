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
        var references = sources.find(section(), id);
        return new Stats(stats.findByStatsRevisionIdIn(Collections.singletonList(id), Sort.by("statKey")).stream()
                .map(v -> new Stat(v.getStatKey(), v.getBaseValue(), v.getGrowthPerLevel(), v.getUnitCode())).toList(),
                references);
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
