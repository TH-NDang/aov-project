package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.Source;
import com.wikiaov.hero.internal.domain.HeroSection;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Repository;

@Repository
public class HeroSections {
    private final Map<HeroSection, HeroSectionSnapshots> snapshots;
    private final HeroSectionSources sources;

    public HeroSections(List<HeroSectionSnapshots> snapshots, HeroSectionSources sources) {
        this.snapshots = snapshots.stream().collect(Collectors.toUnmodifiableMap(HeroSectionSnapshots::section,
                store -> store));
        this.sources = sources;
    }

    public UUID create(UUID heroId, HeroSection section, Object content, Actor actor, Instant at) {
        return snapshots.get(section).create(heroId, content, actor, at);
    }

    public List<Source> sources(HeroSection section, UUID id) {
        return sources.find(section, id);
    }

    public Object content(HeroSection section, UUID id) {
        return snapshots.get(section).content(id);
    }

    public void publish(HeroSection section, UUID id, UUID heroId) {
        snapshots.get(section).publish(id, heroId);
    }
}
