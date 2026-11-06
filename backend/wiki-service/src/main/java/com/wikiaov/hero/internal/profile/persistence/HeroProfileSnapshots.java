package com.wikiaov.hero.internal.profile.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfilePositionRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileRevision;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileRoleRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroProfileSnapshots implements HeroSectionSnapshots {
    private final ProfileRevisionRepository revisions;
    private final ProfileTranslationRepository translations;
    private final ProfileRoleRepository roles;
    private final ProfilePositionRepository positions;
    private final HeroSectionLifecycle lifecycle;
    private final HeroSectionSources sources;

    @Override
    public HeroSection section() {
        return HeroSection.PROFILE;
    }

    @Override
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new ProfileRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Profile) content;
            translations.saveAll(value.translations().stream().map(t -> new ProfileTranslationRow(revision.getId(),
                    t.locale(), t.name(), t.title(), t.summary(), t.lore())).toList());
            roles.saveAll(
                    value.roles().stream().map(role -> new ProfileRoleRow(revision.getId(), role.name())).toList());
            positions.saveAll(value.positions().stream()
                    .map(position -> new ProfilePositionRow(revision.getId(), position.name())).toList());
            sources.save(section(), revision.getId(), value.sources());
        }
        revisions.flush();
        return revision.getId();
    }

    @Override
    public Profile content(UUID id) {
        var references = sources.find(section(), id);
        var ids = Collections.singletonList(id);
        var texts = translations.findByProfileRevisionIdIn(ids, Sort.by("locale")).stream()
                .map(t -> new ProfileTranslation(t.getLocale(), t.getName(), t.getTitle(), t.getSummary(), t.getLore()))
                .toList();
        // An enum's hash changes between JVM runs, so only keeping the query's order gives clients a stable answer.
        var selectedRoles = roles.findByProfileRevisionIdIn(ids, Sort.by("roleCode")).stream()
                .map(row -> Role.valueOf(row.getRoleCode())).collect(Collectors.toCollection(LinkedHashSet::new));
        var selectedPositions = positions.findByProfileRevisionIdIn(ids, Sort.by("positionCode")).stream()
                .map(row -> Position.valueOf(row.getPositionCode()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return new Profile(texts, selectedRoles, selectedPositions, references);
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
