package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroSection;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Repository;

@Repository
public class HeroSections {
    private final Map<HeroSection, HeroSectionSnapshots> snapshots;

    public HeroSections(List<HeroSectionSnapshots> snapshots) {
        this.snapshots = snapshots.stream().collect(Collectors.toUnmodifiableMap(HeroSectionSnapshots::section,
                store -> store));
    }

    public UUID create(UUID heroId, HeroSection section, Object content, Actor actor, Instant at) {
        return snapshots.get(section).create(heroId, content, actor, at);
    }

    public Object content(HeroSection section, UUID id) {
        return snapshots.get(section).content(id);
    }

    /** Many snapshots of one section in a bounded number of queries, keyed by snapshot id. */
    public Map<UUID, ?> contents(HeroSection section, Collection<UUID> ids) {
        return ids.isEmpty() ? Map.of() : snapshots.get(section).contents(ids);
    }

    public Optional<UUID> lastSavedBetween(HeroSection section, UUID heroId, Instant from, Instant to) {
        return snapshots.get(section).lastSavedBetween(heroId, from, to);
    }

    public void publish(HeroSection section, UUID id, UUID heroId) {
        snapshots.get(section).publish(id, heroId);
    }
}
