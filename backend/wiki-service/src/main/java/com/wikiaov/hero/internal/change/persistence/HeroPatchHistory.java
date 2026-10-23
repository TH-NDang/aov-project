package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.change.persistence.HeroPatchChangeSetRepository.Header;
import com.wikiaov.hero.internal.change.persistence.entity.HeroChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchAssessment;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.OtherChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.RoleChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.VisualChangeClassification;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.hero.internal.domain.HeroChanges.Change;
import com.wikiaov.hero.internal.domain.HeroChanges.MechanicChange;
import com.wikiaov.hero.internal.domain.HeroChanges.OtherChange;
import com.wikiaov.hero.internal.domain.HeroChanges.RoleChange;
import com.wikiaov.hero.internal.domain.HeroChanges.SkillChange;
import com.wikiaov.hero.internal.domain.HeroChanges.StatChange;
import com.wikiaov.hero.internal.domain.HeroChanges.Summary;
import com.wikiaov.hero.internal.domain.HeroChanges.VisualChange;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Repository;

/** Owns append-only patch facts and batches the localized history read. */
@Repository
public class HeroPatchHistory {
    private final HeroPatchChangeSetRepository changeSets;
    private final HeroPatchChangeTranslationRepository translations;
    private final HeroChangeClassificationRepository changes;
    private final HeroPatchAssessmentRepository assessments;

    public HeroPatchHistory(HeroPatchChangeSetRepository changeSets, HeroPatchChangeTranslationRepository translations,
            HeroChangeClassificationRepository changes, HeroPatchAssessmentRepository assessments) {
        this.changeSets = changeSets;
        this.translations = translations;
        this.changes = changes;
        this.assessments = assessments;
    }

    public void create(UUID id, UUID variantId, com.wikiaov.hero.internal.domain.HeroChanges.Record input,
            Instant createdAt, Actor actor) {
        var value = new HeroPatchChangeSet();
        value.setId(id);
        value.setPatchVariantId(variantId);
        value.setHeroId(input.heroId());
        value.setFromHeroRevisionId(input.fromHeroRevisionId());
        value.setToHeroRevisionId(input.toHeroRevisionId());
        value.setCreatedAt(createdAt);
        value.setCreatedByIssuer(actor.issuer());
        value.setCreatedBySubject(actor.subject());

        changeSets.saveAndFlush(value);
    }

    public void appendTranslation(UUID changeSetId, Summary summary) {
        var value = new HeroPatchChangeTranslation();
        value.setChangeSetId(changeSetId);
        value.setLocale(summary.locale());
        value.setSummary(summary.summary());

        translations.save(value);
    }

    public void appendChange(UUID changeSetId, int order, Change change) {
        HeroChangeClassification value = switch (change) {
            case StatChange input -> stat(input);
            case SkillChange input -> skill(input);
            case RoleChange input -> role(input);
            case VisualChange input -> visual(input);
            case MechanicChange input -> mechanic(input);
            case OtherChange input -> other(input);
        };

        value.setId(UUID.randomUUID());
        value.setChangeSetId(changeSetId);
        value.setChangeKind(change.changeKind().name());
        value.setSortOrder(order);

        changes.save(value);
    }

    public Optional<UUID> heroId(UUID changeSetId) {
        return changeSets.findHeroId(changeSetId);
    }

    public Optional<HeroPatchAssessment> assessment(UUID changeSetId) {
        return assessments.findById(changeSetId);
    }

    public void saveAssessment(HeroPatchAssessment assessment) {
        assessments.saveAndFlush(assessment);
    }

    public List<Entry> forVariant(UUID variantId, String locale) {
        return entries(changeSets.historyForVariant(variantId), locale);
    }

    public List<Entry> forHero(UUID heroId, String locale) {
        return entries(changeSets.historyForHero(heroId), locale);
    }

    private List<Entry> entries(List<Header> headers, String locale) {
        if (headers.isEmpty())
            return List.of();

        var ids = headers.stream().map(Header::getId).toList();
        var assessmentById = assessments.findAllById(ids).stream()
                .collect(Collectors.toMap(HeroPatchAssessment::getChangeSetId, Function.identity()));
        var copyById = translations.findByChangeSetIdIn(ids).stream()
                .collect(Collectors.groupingBy(HeroPatchChangeTranslation::getChangeSetId));
        var changesById = changes.findByChangeSetIdIn(ids).stream()
                .collect(Collectors.groupingBy(HeroChangeClassification::getChangeSetId));

        var preferred = Comparator.comparing((HeroPatchChangeTranslation t) -> !t.getLocale().equals(locale))
                .thenComparing(t -> !t.getLocale().equals("vi-VN"))
                .thenComparing(HeroPatchChangeTranslation::getLocale);

        return headers.stream().map(header -> new Entry(header, assessmentById.get(header.getId()),
                copyById.getOrDefault(header.getId(), List.of()).stream().min(preferred).orElse(null),
                changesById.getOrDefault(header.getId(), List.of()))).toList();
    }

    public record Entry(
            Header header,
            HeroPatchAssessment assessment,
            HeroPatchChangeTranslation translation,
            List<HeroChangeClassification> changes
    ) {
    }

    private static StatChangeClassification stat(StatChange input) {
        var value = new StatChangeClassification();
        value.setStatKey(input.statKey());
        value.setOldValue(input.oldValue());
        value.setNewValue(input.newValue());
        value.setUnitCode(input.unit());

        return value;
    }

    private static SkillChangeClassification skill(SkillChange input) {
        var value = new SkillChangeClassification();
        value.setSkillKey(input.skillKey());
        value.setFieldKey(input.fieldKey());
        value.setOldValue(input.oldValue());
        value.setNewValue(input.newValue());

        return value;
    }

    private static RoleChangeClassification role(RoleChange input) {
        var value = new RoleChangeClassification();
        value.setRoleCode(input.roleCode().name());
        value.setAdded(input.added());

        return value;
    }

    private static VisualChangeClassification visual(VisualChange input) {
        var value = new VisualChangeClassification();
        value.setMediaRole(input.mediaRole().name());
        value.setOldAssetId(input.oldAssetId());
        value.setNewAssetId(input.newAssetId());

        return value;
    }

    private static MechanicChangeClassification mechanic(MechanicChange input) {
        var value = new MechanicChangeClassification();
        value.setMechanicKey(input.mechanicKey());
        value.setDescription(input.description());

        return value;
    }

    private static OtherChangeClassification other(OtherChange input) {
        var value = new OtherChangeClassification();
        value.setDescription(input.description());

        return value;
    }
}
