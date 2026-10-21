package com.wikiaov.spell.internal.application.service;

import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.domain.SpellContent;
import com.wikiaov.spell.internal.persistence.SpellRevisionRepository;
import com.wikiaov.spell.internal.persistence.SpellTranslationRepository;
import com.wikiaov.spell.internal.persistence.entity.SpellIdentity;
import com.wikiaov.spell.internal.persistence.entity.SpellRevision;
import com.wikiaov.spell.internal.persistence.entity.SpellTranslation;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Persists revision content and assembles its localized views. */
@Component
class SpellRevisionContent {
    private final SpellRevisionRepository revisions;
    private final SpellTranslationRepository translations;
    private final SpellContentRules contentRules;

    SpellRevisionContent(SpellRevisionRepository revisions, SpellTranslationRepository translations,
            SpellContentRules contentRules) {
        this.revisions = revisions;
        this.translations = translations;
        this.contentRules = contentRules;
    }

    void saveContent(SpellRevision revision, SpellContent content) {
        saveGameplay(revision, content);
        replaceTranslations(revision, content);
    }

    private void saveGameplay(SpellRevision revision, SpellContent content) {
        var cleanStates = content.states().stream()
                .map(state -> new SpellContent.SpellState(state.key(), state.iconAssetId(), List.of())).toList();
        var clean = new SpellContent(content.iconAssetId(), content.cooldownSeconds(), content.unlockLevel(),
                content.unlockType(), content.availability(), content.legacy(), content.displayOrder(),
                content.chargeRechargeSeconds(), content.maxCharges(), content.defaultStateKey(), cleanStates,
                content.referenceImages(), List.of(), content.notes());
        revision.setGameplay(clean);
        revision.setIconAssetId(content.iconAssetId());
        revisions.saveAndFlush(revision);
    }

    private void replaceTranslations(SpellRevision revision, SpellContent content) {
        translations.deleteByRevisionId(revision.getId());
        translations.flush();
        for (var translation : content.translations()) {
            var row = new SpellTranslation();
            row.setId(UUID.randomUUID());
            row.setRevisionId(revision.getId());
            row.setLocale(translation.locale());
            row.setTargetKey("");
            row.setName(translation.name());
            row.setSummary(translation.summary());
            row.setDescription(translation.description());
            row.setStatLabels(translation.statLabels());
            row.setEffects(translation.effects());
            row.setVariantLabels(translation.variantLabels());
            translations.save(row);
        }
        for (var state : content.states())
            for (var translation : state.translations()) {
                var row = new SpellTranslation();
                row.setId(UUID.randomUUID());
                row.setRevisionId(revision.getId());
                row.setTargetKey(state.key());
                row.setLocale(translation.locale());
                row.setName(translation.name());
                row.setSummary(translation.summary());
                row.setDescription(translation.description());
                row.setStatLabels(translation.statLabels());
                row.setEffects(translation.effects());
                row.setVariantLabels(translation.variantLabels());
                translations.save(row);
            }
        translations.flush();
    }

    SpellContent content(SpellRevision revision) {
        return hydrate(revision, translations.findByRevisionIdOrderByLocale(revision.getId()));
    }

    SpellContent hydrate(SpellRevision revision, List<SpellTranslation> copy) {
        var content = revision.getGameplay();
        var states = content.states().stream()
                .map(state -> new SpellContent.SpellState(state.key(), state.iconAssetId(), copy.stream()
                        .filter(translation -> translation.getTargetKey().equals(state.key()))
                        .map(SpellTranslation::content).toList()))
                .toList();
        return new SpellContent(content.iconAssetId(), content.cooldownSeconds(), content.unlockLevel(),
                content.unlockType(), content.availability(),
                content.legacy(), content.displayOrder(), content.chargeRechargeSeconds(), content.maxCharges(),
                content.defaultStateKey(), states,
                content.referenceImages(),
                copy.stream().filter(translation -> translation.getTargetKey().isEmpty()).map(SpellTranslation::content)
                        .toList(),
                content.notes());
    }

    SpellView publicView(SpellIdentity owner, SpellRevision revision, String locale) {
        return new SpellView(owner.getId(), owner.getCode(), revisionView(owner, revision),
                content(revision).publicCopy(locale),
                List.of());
    }

    SpellView view(SpellIdentity owner, SpellRevision revision) {
        var content = content(revision);
        return new SpellView(owner.getId(), owner.getCode(), revisionView(owner, revision), content,
                contentRules.readiness(revision, content));
    }

    SpellView.Revision revisionView(SpellIdentity owner, SpellRevision revision) {
        return new SpellView.Revision(revision.getId(), owner.getId(), owner.getCode(), revision.getRulesetId(),
                revision.getRevisionNo(),
                revision.getState(), revision.getVersion(), revision.getPublicationSequence(),
                revision.getPublishedAt(), revision.getCause(),
                revision.getEffectiveFromPatchVariantId(), revision.getSourceRevisionId(), revision.getCreatedAt(),
                revision.getUpdatedAt());
    }
}
