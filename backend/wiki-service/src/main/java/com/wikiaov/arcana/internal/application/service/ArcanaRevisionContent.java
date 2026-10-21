package com.wikiaov.arcana.internal.application.service;

import com.wikiaov.arcana.internal.application.response.ArcanaView;
import com.wikiaov.arcana.internal.domain.ArcanaContent;
import com.wikiaov.arcana.internal.persistence.ArcanaRevisionRepository;
import com.wikiaov.arcana.internal.persistence.ArcanaTranslationRepository;
import com.wikiaov.arcana.internal.persistence.entity.ArcanaIdentity;
import com.wikiaov.arcana.internal.persistence.entity.ArcanaRevision;
import com.wikiaov.arcana.internal.persistence.entity.ArcanaTranslation;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Persists revision content and assembles its localized views. */
@Component
class ArcanaRevisionContent {
    private final ArcanaRevisionRepository revisions;
    private final ArcanaTranslationRepository translations;
    private final ArcanaContentRules contentRules;

    ArcanaRevisionContent(ArcanaRevisionRepository revisions, ArcanaTranslationRepository translations,
            ArcanaContentRules contentRules) {
        this.revisions = revisions;
        this.translations = translations;
        this.contentRules = contentRules;
    }

    void saveContent(ArcanaRevision revision, ArcanaContent content) {
        saveGameplay(revision, content);
        replaceTranslations(revision, content);
    }

    private void saveGameplay(ArcanaRevision revision, ArcanaContent content) {
        revision.setGameplay(content.withTranslations(List.of()));
        revision.setIconAssetId(content.iconAssetId());
        revisions.saveAndFlush(revision);
    }

    private void replaceTranslations(ArcanaRevision revision, ArcanaContent content) {
        translations.deleteByRevisionId(revision.getId());
        translations.flush();
        for (var translation : content.translations()) {
            var row = new ArcanaTranslation();
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

    ArcanaContent content(ArcanaRevision revision) {
        return hydrate(revision, translations.findByRevisionIdOrderByLocale(revision.getId()));
    }

    ArcanaContent hydrate(ArcanaRevision revision, List<ArcanaTranslation> copy) {
        return revision.getGameplay().withTranslations(copy.stream().map(ArcanaTranslation::content).toList());
    }

    ArcanaView publicView(ArcanaIdentity owner, ArcanaRevision revision, String locale) {
        return new ArcanaView(owner.getId(), owner.getCode(), revisionView(owner, revision),
                content(revision).publicCopy(locale),
                List.of());
    }

    ArcanaView view(ArcanaIdentity owner, ArcanaRevision revision) {
        var content = content(revision);
        return new ArcanaView(owner.getId(), owner.getCode(), revisionView(owner, revision), content,
                contentRules.readiness(revision, content));
    }

    ArcanaView.Revision revisionView(ArcanaIdentity owner, ArcanaRevision revision) {
        return new ArcanaView.Revision(revision.getId(), owner.getId(), owner.getCode(), revision.getRulesetId(),
                revision.getRevisionNo(),
                revision.getState(), revision.getVersion(), revision.getPublicationSequence(),
                revision.getPublishedAt(), revision.getCause(),
                revision.getEffectiveFromPatchVariantId(), revision.getSourceRevisionId(), revision.getCreatedAt(),
                revision.getUpdatedAt());
    }
}
