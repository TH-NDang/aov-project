package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public interface HeroSectionSnapshots {
    HeroSection section();

    SectionRevisionRepository<?> revisions();

    /** Every save keeps its own snapshot, so the version a section had at a past moment can be read back. */
    default Optional<UUID> lastSavedBetween(UUID heroId, Instant from, Instant to) {
        return revisions().findFirstByHeroIdAndCreatedAtBetweenOrderByCreatedAtDesc(heroId, from, to)
                .map(SectionRevision::getId);
    }

    UUID create(UUID heroId, Object content, Actor actor, Instant at);

    Object content(UUID id);

    /**
     * Many snapshots at once, for reads that cover every hero. A section whose store has no bounded read falls back to
     * one read per snapshot.
     */
    default Map<UUID, ?> contents(Collection<UUID> ids) {
        Map<UUID, Object> result = new HashMap<>();
        for (UUID id : ids) {
            result.put(id, content(id));
        }
        return result;
    }

    void publish(UUID id, UUID heroId);
}
