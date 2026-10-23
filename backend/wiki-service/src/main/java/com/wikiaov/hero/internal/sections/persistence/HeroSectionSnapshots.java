package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroSection;
import java.time.Instant;
import java.util.UUID;

public interface HeroSectionSnapshots {
    HeroSection section();

    UUID create(UUID heroId, Object content, Actor actor, Instant at);

    Object content(UUID id);

    void publish(UUID id, UUID heroId);
}
