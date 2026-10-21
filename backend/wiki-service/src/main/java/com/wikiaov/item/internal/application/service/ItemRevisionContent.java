package com.wikiaov.item.internal.application.service;

import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.persistence.ItemRevisionRepository;
import com.wikiaov.item.internal.persistence.ItemTranslationRepository;
import com.wikiaov.item.internal.persistence.entity.ItemIdentity;
import com.wikiaov.item.internal.persistence.entity.ItemRevision;
import com.wikiaov.item.internal.persistence.entity.ItemTranslation;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Persists revision content and assembles its localized views. */
@Component
class ItemRevisionContent {
    private final ItemRevisionRepository revisions;
    private final ItemTranslationRepository translations;
    private final ItemContentRules contentRules;

    ItemRevisionContent(ItemRevisionRepository revisions, ItemTranslationRepository translations,
            ItemContentRules contentRules) {
        this.revisions = revisions;
        this.translations = translations;
        this.contentRules = contentRules;
    }

    void saveContent(ItemRevision revision, ItemContent content) {
        saveGameplay(revision, content);
        replaceTranslations(revision, content);
    }

    private void saveGameplay(ItemRevision revision, ItemContent content) {
        revision.setGameplay(content.withTranslations(List.of()));
        revision.setIconAssetId(content.iconAssetId());
        revisions.saveAndFlush(revision);
    }

    private void replaceTranslations(ItemRevision revision, ItemContent content) {
        translations.deleteByRevisionId(revision.getId());
        translations.flush();
        for (var translation : content.translations()) {
            var row = new ItemTranslation();
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

    ItemContent content(ItemRevision revision) {
        return revision.getGameplay().withTranslations(
                translations.findByRevisionIdOrderByLocale(revision.getId()).stream().map(ItemTranslation::content)
                        .toList());
    }

    ItemContent hydrate(ItemRevision revision, List<ItemTranslation> copy) {
        return revision.getGameplay().withTranslations(copy.stream().map(ItemTranslation::content).toList());
    }

    ItemView publicView(ItemIdentity owner, ItemRevision revision, String locale) {
        return new ItemView(owner.getId(), owner.getCode(), revisionView(owner, revision),
                content(revision).publicCopy(locale),
                List.of());
    }

    ItemView view(ItemIdentity owner, ItemRevision revision) {
        var content = content(revision);
        return new ItemView(owner.getId(), owner.getCode(), revisionView(owner, revision), content,
                contentRules.readiness(revision, content));
    }

    ItemView.Revision revisionView(ItemIdentity owner, ItemRevision revision) {
        return new ItemView.Revision(revision.getId(), owner.getId(), owner.getCode(), revision.getRulesetId(),
                revision.getRevisionNo(),
                revision.getState(), revision.getVersion(), revision.getPublicationSequence(),
                revision.getPublishedAt(), revision.getCause(),
                revision.getEffectiveFromPatchVariantId(), revision.getSourceRevisionId(), revision.getCreatedAt(),
                revision.getUpdatedAt());
    }
}
