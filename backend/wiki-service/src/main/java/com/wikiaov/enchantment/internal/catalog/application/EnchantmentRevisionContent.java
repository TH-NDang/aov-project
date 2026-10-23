package com.wikiaov.enchantment.internal.catalog.application;

import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentRevisionRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentTranslationRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentIdentity;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentTranslation;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Persists revision content and assembles its localized views. */
@Component
class EnchantmentRevisionContent {
    private final EnchantmentRevisionRepository revisions;
    private final EnchantmentTranslationRepository translations;
    private final EnchantmentContentRules contentRules;

    EnchantmentRevisionContent(EnchantmentRevisionRepository revisions, EnchantmentTranslationRepository translations,
            EnchantmentContentRules contentRules) {
        this.revisions = revisions;
        this.translations = translations;
        this.contentRules = contentRules;
    }

    void saveContent(EnchantmentRevision revision, EnchantmentContent content) {
        saveGameplay(revision, content);
        replaceTranslations(revision, content);
    }

    private void saveGameplay(EnchantmentRevision revision, EnchantmentContent content) {
        revision.setGameplay(content.withTranslations(List.of()));
        revision.setIconAssetId(content.iconAssetId());
        revisions.saveAndFlush(revision);
    }

    private void replaceTranslations(EnchantmentRevision revision, EnchantmentContent content) {
        translations.deleteByRevisionId(revision.getId());
        translations.flush();
        for (var translation : content.translations()) {
            var row = new EnchantmentTranslation();
            row.setId(UUID.randomUUID());
            row.setRevisionId(revision.getId());
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

    EnchantmentContent content(EnchantmentRevision revision) {
        return hydrate(revision, translations.findByRevisionIdOrderByLocale(revision.getId()));
    }

    EnchantmentContent hydrate(EnchantmentRevision revision, List<EnchantmentTranslation> copy) {
        return revision.getGameplay().withTranslations(copy.stream().map(EnchantmentTranslation::content).toList());
    }

    EnchantmentView publicView(EnchantmentIdentity owner, EnchantmentRevision revision, String locale) {
        return new EnchantmentView(owner.getId(), owner.getCode(), revisionView(owner, revision),
                content(revision).publicCopy(locale), List.of());
    }

    EnchantmentView view(EnchantmentIdentity owner, EnchantmentRevision revision) {
        var content = content(revision);
        return new EnchantmentView(owner.getId(), owner.getCode(), revisionView(owner, revision), content,
                contentRules.readiness(revision, content));
    }

    EnchantmentView.Revision revisionView(EnchantmentIdentity owner, EnchantmentRevision revision) {
        return new EnchantmentView.Revision(revision.getId(), owner.getId(), owner.getCode(), revision.getRulesetId(),
                revision.getRevisionNo(),
                revision.getState(), revision.getVersion(), revision.getPublicationSequence(),
                revision.getPublishedAt(), revision.getCause(),
                revision.getEffectiveFromPatchVariantId(), revision.getSourceRevisionId(), revision.getCreatedAt(),
                revision.getUpdatedAt());
    }
}
