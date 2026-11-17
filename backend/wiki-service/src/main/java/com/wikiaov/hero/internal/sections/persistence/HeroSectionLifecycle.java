package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class HeroSectionLifecycle {
    public <T extends SectionRevision> T create(SectionRevisionRepository<T> repository, T revision,
            UUID heroId, Actor actor, Instant at) {
        revision.setId(UUID.randomUUID());
        revision.setHeroId(heroId);
        revision.setState(RevisionState.DRAFT);
        revision.setCreatedAt(at);
        revision.setCreatedByIssuer(actor.issuer());
        revision.setCreatedBySubject(actor.subject());
        return repository.saveAndFlush(revision);
    }

    public void publish(SectionRevisionRepository<? extends SectionRevision> repository, UUID id, UUID heroId) {
        repository.flush();
        var revision = repository.lockById(id).orElse(null);
        if (revision == null || !revision.getHeroId().equals(heroId) || revision.getState() == RevisionState.DISCARDED)
            throw new IllegalStateException("Invalid section ownership or lifecycle.");
        if (revision.getState() == RevisionState.DRAFT)
            revision.setState(RevisionState.PUBLISHED);
        repository.flush();
    }
}
