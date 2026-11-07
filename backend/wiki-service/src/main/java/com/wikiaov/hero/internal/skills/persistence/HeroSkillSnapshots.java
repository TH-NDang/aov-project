package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillEffectRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillIdentityRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillSnapshotRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillTranslationRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillsRevision;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroSkillSnapshots implements HeroSectionSnapshots {
    private final SkillsRevisionRepository revisions;
    private final SkillIdentityRepository identities;
    private final SkillSnapshotRepository snapshots;
    private final SkillTranslationRepository translations;
    private final SkillEffectRepository effects;
    private final HeroSectionLifecycle lifecycle;
    private final HeroSectionSources sources;

    @Override
    public HeroSection section() {
        return HeroSection.SKILLS;
    }

    @Override
    public com.wikiaov.hero.internal.sections.persistence.SectionRevisionRepository<?> revisions() {
        return revisions;
    }

    @Override
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new SkillsRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Skills) content;
            value.skills().forEach(skill -> save(heroId, revision.getId(), skill, at));
            sources.save(section(), revision.getId(), value.sources());
        }
        revisions.flush();
        return revision.getId();
    }

    private void save(UUID heroId, UUID revisionId, Skill skill, Instant at) {
        if (identities.findById(new SkillIdentityRow.Key(heroId, skill.skillKey())).isEmpty())
            identities.save(new SkillIdentityRow(heroId, skill.skillKey(), at));
        identities.flush();
        snapshots.saveAndFlush(new SkillSnapshotRow(revisionId, heroId, skill.skillKey(), skill.kind().name(),
                skill.formKey(), skill.displayOrder(), skill.iconAssetId()));
        translations.saveAll(skill.translations().stream()
                .map(t -> new SkillTranslationRow(revisionId, skill.skillKey(), t.locale(), t.name(), t.description()))
                .toList());
        for (int n = 0; n < skill.effects().size(); n++) {
            var effect = skill.effects().get(n);
            effects.save(new SkillEffectRow(revisionId, skill.skillKey(), n, effect.effectType(), effect.metadata()));
        }
    }

    @Override
    public Skills content(UUID id) {
        return contents(Collections.singletonList(id)).get(id);
    }

    /** Reads many snapshots in a bounded number of queries, for lists that cover every hero. */
    public Map<UUID, Skills> contents(Collection<UUID> ids) {
        var references = sources.find(section(), ids);
        var skills = snapshots.findBySkillSetRevisionIdIn(ids, Sort.by("displayOrder")).stream()
                .collect(Collectors.groupingBy(SkillSnapshotRow::getSkillSetRevisionId));
        // Without a skill there are no child rows, so those tables need no query.
        Map<UUID, Map<String, List<SkillTranslationRow>>> texts = skills.isEmpty()
                ? Collections.emptyMap()
                : translations.findBySkillSetRevisionIdIn(ids, Sort.by("locale")).stream()
                        .collect(Collectors.groupingBy(SkillTranslationRow::getSkillSetRevisionId,
                                Collectors.groupingBy(SkillTranslationRow::getSkillKey)));
        Map<UUID, Map<String, List<SkillEffectRow>>> skillEffects = skills.isEmpty()
                ? Collections.emptyMap()
                : effects.findBySkillSetRevisionIdIn(ids, Sort.by("effectOrder")).stream()
                        .collect(Collectors.groupingBy(SkillEffectRow::getSkillSetRevisionId,
                                Collectors.groupingBy(SkillEffectRow::getSkillKey)));

        Map<UUID, Skills> result = new HashMap<>();
        for (UUID id : ids) {
            var skillTexts = texts.getOrDefault(id, Map.of());
            var effectRows = skillEffects.getOrDefault(id, Map.of());
            result.put(id, new Skills(skills.getOrDefault(id, List.of()).stream().map(skill -> new Skill(
                    skill.getSkillKey(), SkillKind.valueOf(skill.getKind()), skill.getFormKey(),
                    skill.getDisplayOrder(), skill.getIconAssetId(),
                    skillTexts.getOrDefault(skill.getSkillKey(), List.of()).stream()
                            .map(t -> new SkillTranslation(t.getLocale(), t.getName(), t.getDescription())).toList(),
                    effectRows.getOrDefault(skill.getSkillKey(), List.of()).stream()
                            .map(effect -> new Effect(effect.getEffectType(), effect.getMetadata())).toList()))
                    .toList(),
                    references.getOrDefault(id, List.of())));
        }
        return result;
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
