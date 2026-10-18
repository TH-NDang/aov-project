package com.wikiaov.hero.internal.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.entity.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class HeroSections {
    private final EntityManager entities;

    public HeroSections(EntityManager entities) {
        this.entities = entities;
    }

    public UUID create(UUID heroId, HeroSection section, Object content, Actor actor, Instant at) {
        var revision = newRevision(section);
        UUID id = UUID.randomUUID();
        revision.setId(id);
        revision.setHeroId(heroId);
        revision.setState("DRAFT");
        revision.setCreatedAt(at);
        revision.setCreatedByIssuer(actor.issuer());
        revision.setCreatedBySubject(actor.subject());
        entities.persist(revision);
        entities.flush();
        if (content != null)
            switch (section) {
                case PROFILE -> {
                    var value = (Profile) content;
                    value.translations().forEach(t -> entities.persist(
                            new ProfileTranslationRow(id, t.locale(), t.name(), t.title(), t.summary(), t.lore())));
                    value.roles().forEach(role -> entities.persist(new ProfileRoleRow(id, role.name())));
                    sources(section, id, value.sources());
                }
                case OVERVIEW_RATINGS -> {
                    var value = (Ratings) content;
                    var rating = (RatingRevision) revision;
                    rating.setScaleCode(value.scaleCode());
                    rating.setSurvivability(value.survivability());
                    rating.setAttackDamage(value.attackDamage());
                    rating.setSkillEffects(value.skillEffects());
                    rating.setDifficulty(value.difficulty());
                    rating.setDerived(value.derived());
                    sources(section, id, value.sources());
                }
                case COMBAT_STATS -> {
                    var value = (Stats) content;
                    value.values().forEach(v -> entities
                            .persist(new StatRow(id, v.statKey(), v.baseValue(), v.growthPerLevel(), v.unit())));
                    sources(section, id, value.sources());
                }
                case SKILLS -> {
                    var value = (Skills) content;
                    for (var skill : value.skills()) {
                        if (entities.find(SkillIdentityRow.class,
                                new SkillIdentityRow.Key(heroId, skill.skillKey())) == null)
                            entities.persist(new SkillIdentityRow(heroId, skill.skillKey(), at));
                        entities.flush();
                        entities.persist(new SkillSnapshotRow(id, heroId, skill.skillKey(), skill.kind().name(),
                                skill.formKey(), skill.displayOrder(), skill.iconAssetId()));
                        entities.flush();
                        skill.translations().forEach(t -> entities.persist(
                                new SkillTranslationRow(id, skill.skillKey(), t.locale(), t.name(), t.description())));
                        for (int n = 0; n < skill.effects().size(); n++) {
                            var effect = skill.effects().get(n);
                            entities.persist(new SkillEffectRow(id, skill.skillKey(), n, effect.effectType(),
                                    effect.metadata()));
                        }
                    }
                    sources(section, id, value.sources());
                }
                case SKINS -> {
                    var value = (Skins) content;
                    for (var skin : value.skins()) {
                        if (entities.find(SkinIdentityRow.class,
                                new SkinIdentityRow.Key(heroId, skin.skinKey())) == null)
                            entities.persist(new SkinIdentityRow(heroId, skin.skinKey(), at));
                        entities.flush();
                        entities.persist(new SkinSnapshotRow(id, heroId, skin.skinKey(), skin.displayOrder(),
                                skin.artAssetId(), skin.rarityCode()));
                        entities.flush();
                        skin.translations().forEach(t -> entities.persist(new SkinTranslationRow(id, skin.skinKey(),
                                t.locale(), t.name(), t.description(), t.acquisitionNote())));
                    }
                    sources(section, id, value.sources());
                }
                case MEDIA_BINDINGS -> {
                    var value = (Bindings) content;
                    value.bindings()
                            .forEach((role, asset) -> entities.persist(new MediaBindingRow(id, role.name(), asset)));
                    sources(section, id, value.sources());
                }
            }
        entities.flush();
        return id;
    }

    private void sources(HeroSection section, UUID id, List<Source> sources) {
        for (int n = 0; n < sources.size(); n++) {
            var source = sources.get(n);
            entities.persist(new SourceReferenceRow(UUID.randomUUID(), section.name(), id, n, source.label(),
                    source.sourceUrl(), source.observedAt(), source.verificationState().name(), source.note()));
        }
    }

    public List<Source> sources(HeroSection section, UUID id) {
        return entities.createQuery(
                "select s from SourceReferenceRow s where s.ownerType = :type and s.ownerRevisionId = :id order by s.position",
                SourceReferenceRow.class)
                .setParameter("type", section.name()).setParameter("id", id).getResultList().stream()
                .map(s -> new Source(s.getLabel(), s.getSourceUrl(), s.getObservedAt(),
                        Verification.valueOf(s.getVerificationState()), s.getNote()))
                .toList();
    }

    public Object content(HeroSection section, UUID id) {
        var src = sources(section, id);
        return switch (section) {
            case PROFILE -> new Profile(rows(ProfileTranslationRow.class, "profileRevisionId", id, "locale").stream()
                    .map(t -> new ProfileTranslation(t.getLocale(), t.getName(), t.getTitle(), t.getSummary(),
                            t.getLore()))
                    .toList(),
                    new HashSet<>(rows(ProfileRoleRow.class, "profileRevisionId", id, "roleCode").stream()
                            .map(r -> Role.valueOf(r.getRoleCode())).toList()),
                    src);
            case OVERVIEW_RATINGS -> {
                var r = entities.find(RatingRevision.class, id);
                yield new Ratings(r.getScaleCode(), r.getSurvivability(), r.getAttackDamage(), r.getSkillEffects(),
                        r.getDifficulty(), r.isDerived(), src);
            }
            case COMBAT_STATS -> new Stats(rows(StatRow.class, "statsRevisionId", id, "statKey").stream()
                    .map(v -> new Stat(v.getStatKey(), v.getBaseValue(), v.getGrowthPerLevel(), v.getUnitCode()))
                    .toList(), src);
            case SKILLS -> new Skills(rows(SkillSnapshotRow.class, "skillSetRevisionId", id, "displayOrder").stream()
                    .map(s -> new Skill(s.getSkillKey(), SkillKind.valueOf(s.getKind()), s.getFormKey(),
                            s.getDisplayOrder(), s.getIconAssetId(),
                            rows(SkillTranslationRow.class, "skillSetRevisionId", id, "locale").stream()
                                    .filter(t -> t.getSkillKey().equals(s.getSkillKey()))
                                    .map(t -> new SkillTranslation(t.getLocale(), t.getName(), t.getDescription()))
                                    .toList(),
                            rows(SkillEffectRow.class, "skillSetRevisionId", id, "effectOrder").stream()
                                    .filter(e -> e.getSkillKey().equals(s.getSkillKey()))
                                    .map(e -> new Effect(e.getEffectType(), e.getMetadata())).toList()))
                    .toList(), src);
            case SKINS -> new Skins(
                    rows(SkinSnapshotRow.class, "skinSetRevisionId", id, "displayOrder").stream()
                            .map(s -> new Skin(s.getSkinKey(), s.getDisplayOrder(), s.getArtAssetId(),
                                    s.getRarityCode(),
                                    rows(SkinTranslationRow.class, "skinSetRevisionId", id, "locale").stream()
                                            .filter(t -> t.getSkinKey().equals(s.getSkinKey()))
                                            .map(t -> new SkinTranslation(t.getLocale(), t.getName(),
                                                    t.getDescription(), t.getAcquisitionNote()))
                                            .toList()))
                            .toList(),
                    src);
            case MEDIA_BINDINGS -> {
                Map<MediaRole, UUID> bindings = new EnumMap<>(MediaRole.class);
                rows(MediaBindingRow.class, "mediaBindingRevisionId", id, "mediaRole")
                        .forEach(b -> bindings.put(MediaRole.valueOf(b.getMediaRole()), b.getAssetId()));
                yield new Bindings(bindings, src);
            }
        };
    }

    public void publish(HeroSection section, UUID id, UUID heroId) {
        entities.flush();
        var revision = entities.find(type(section), id, LockModeType.PESSIMISTIC_WRITE);
        if (revision == null || !revision.getHeroId().equals(heroId) || "DISCARDED".equals(revision.getState()))
            throw new IllegalStateException("Invalid section ownership or lifecycle.");
        if ("DRAFT".equals(revision.getState()))
            revision.setState("PUBLISHED");
        entities.flush();
    }

    private <T> List<T> rows(Class<T> type, String owner, UUID id, String order) {
        return entities
                .createQuery(
                        "select e from " + type.getSimpleName() + " e where e." + owner + " = :id order by e." + order,
                        type)
                .setParameter("id", id).getResultList();
    }

    private static SectionRevision newRevision(HeroSection section) {
        return switch (section) {
            case PROFILE -> new ProfileRevision();
            case OVERVIEW_RATINGS -> new RatingRevision();
            case COMBAT_STATS -> new StatsRevision();
            case SKILLS -> new SkillsRevision();
            case SKINS -> new SkinsRevision();
            case MEDIA_BINDINGS -> new MediaRevision();
        };
    }

    private static Class<? extends SectionRevision> type(HeroSection section) {
        return switch (section) {
            case PROFILE -> ProfileRevision.class;
            case OVERVIEW_RATINGS -> RatingRevision.class;
            case COMBAT_STATS -> StatsRevision.class;
            case SKILLS -> SkillsRevision.class;
            case SKINS -> SkinsRevision.class;
            case MEDIA_BINDINGS -> MediaRevision.class;
        };
    }
}
