package com.wikiaov.hero.internal.profile.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfilePositionRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileRevision;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileRoleRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import com.wikiaov.hero.internal.sections.persistence.SectionRevisionRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
    public SectionRevisionRepository<?> revisions() {
        return revisions;
    }

    @Override
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new ProfileRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Profile) content;
            translations.saveAll(value.translations().stream()
                    .map(t -> new ProfileTranslationRow(revision.getId(), t.locale(), t.name(), t.title(),
                            t.summary(), t.lore(), t.strengths(), t.weaknesses(), t.counterTips()))
                    .toList());
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
        return contents(Collections.singletonList(id)).get(id);
    }

    /** Reads many snapshots in a bounded number of queries, for lists that cover every hero. */
    public Map<UUID, Profile> contents(Collection<UUID> ids) {
        var references = sources.find(section(), ids);
        var texts = translations.findByProfileRevisionIdIn(ids, Sort.by("locale")).stream()
                .collect(Collectors.groupingBy(ProfileTranslationRow::getProfileRevisionId,
                        Collectors.mapping(t -> new ProfileTranslation(t.getLocale(), t.getName(), t.getTitle(),
                                t.getSummary(), t.getLore(), t.getStrengths(), t.getWeaknesses(), t.getCounterTips()),
                                Collectors.toList())));
        // An enum's hash changes between JVM runs, so only keeping the query's order gives clients a stable answer.
        var selectedRoles = roles.findByProfileRevisionIdIn(ids, Sort.by("roleCode")).stream()
                .collect(Collectors.groupingBy(ProfileRoleRow::getProfileRevisionId,
                        Collectors.mapping(row -> Role.valueOf(row.getRoleCode()),
                                Collectors.toCollection(LinkedHashSet::new))));
        var selectedPositions = positions.findByProfileRevisionIdIn(ids, Sort.by("positionCode")).stream()
                .collect(Collectors.groupingBy(ProfilePositionRow::getProfileRevisionId,
                        Collectors.mapping(row -> Position.valueOf(row.getPositionCode()),
                                Collectors.toCollection(LinkedHashSet::new))));

        Map<UUID, Profile> result = new HashMap<>();
        for (UUID id : ids) {
            result.put(id, new Profile(texts.getOrDefault(id, List.of()),
                    selectedRoles.getOrDefault(id, new LinkedHashSet<>()),
                    selectedPositions.getOrDefault(id, new LinkedHashSet<>()), references.getOrDefault(id, List.of())));
        }
        return result;
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
