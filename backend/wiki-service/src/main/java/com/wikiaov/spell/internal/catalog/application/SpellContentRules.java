package com.wikiaov.spell.internal.catalog.application;

import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogObservation;
import com.wikiaov.platform.CatalogTranslations;
import com.wikiaov.spell.internal.application.SpellErrorCode;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision;
import com.wikiaov.spell.internal.domain.SpellContent;
import com.wikiaov.spell.internal.domain.SpellObservation;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Validates catalog content and explains publication readiness. */
@Component
class SpellContentRules {
    private final MediaAssets media;

    SpellContentRules(MediaAssets media) {
        this.media = media;
    }

    void validate(SpellContent content) {
        if (content == null)
            fail("Content is required.");
        CatalogTranslations.firstViolation(content.translations()).ifPresent(violation -> fail(violation.detail()));
        validateIcon(content.iconAssetId());
        if (content.notes() != null && content.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        validateNumericFields(content);
        if (!Set.of("AVAILABLE", "REMOVED", "UNKNOWN").contains(content.availability())
                || !Set.of("ACCOUNT_CREATION", "LEVEL", "UNKNOWN").contains(content.unlockType()))
            fail("Invalid spell availability or unlock type.");
        validateStates(content);
        content.referenceImages().forEach(owner -> validateIcon(owner.assetId()));
    }

    private void validateNumericFields(SpellContent content) {
        if (content.cooldownSeconds() != null && content.cooldownSeconds().signum() < 0
                || content.chargeRechargeSeconds() != null && content.chargeRechargeSeconds().signum() < 0
                || content.unlockLevel() != null && content.unlockLevel() < 1
                || content.maxCharges() != null && content.maxCharges() < 1
                || content.displayOrder() < 0)
            fail("Invalid spell numeric field.");
    }

    private void validateStates(SpellContent content) {
        if (content.states().stream().map(SpellContent.SpellState::key).distinct().count() != content.states().size())
            fail("Duplicate spell state.");
        for (var state : content.states()) {
            if (state.key() == null || !state.key().matches("[a-z0-9]+(?:-[a-z0-9]+)*"))
                fail("Invalid spell state key.");
            validateIcon(state.iconAssetId());
            CatalogTranslations.firstViolation(state.translations()).ifPresent(violation -> fail(violation.detail()));
        }
        if (content.defaultStateKey() != null
                && content.states().stream().noneMatch(s -> s.key().equals(content.defaultStateKey())))
            fail("The default spell state must exist.");
    }

    private void validateIcon(UUID id) {
        if (id != null
                && media.find(id)
                        .filter(asset -> asset.usable() && asset.semanticType() == MediaSemanticType.SPELL_ICON)
                        .isEmpty())
            fail("The icon must be an active uploaded spell icon.");
    }

    List<UUID> assets(SpellContent content) {
        var result = new ArrayList<UUID>();
        if (content.iconAssetId() != null)
            result.add(content.iconAssetId());
        content.states().forEach(s -> {
            if (s.iconAssetId() != null)
                result.add(s.iconAssetId());
        });
        content.referenceImages().forEach(owner -> {
            if (owner.assetId() != null)
                result.add(owner.assetId());
        });
        return result;
    }

    List<String> readiness(SpellRevision revision, SpellContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null && !archived(revision, content)
                && !CatalogObservation.isUnscopedBaseline(revision.getCause(), revision.getSourceRevisionId(),
                        revision.getEffectiveFromPatchVariantId()))
            result.add("effectiveFromPatchVariantId");
        return result;
    }

    boolean archived(SpellRevision revision, SpellContent content) {
        return SpellObservation.archived(revision.getCause(), revision.getEffectiveFromPatchVariantId(), content);
    }

    List<String> missing(SpellContent content) {
        var missing = new ArrayList<String>();
        if (content.iconAssetId() == null)
            missing.add("iconAssetId");
        if (content.translations().isEmpty())
            missing.add("translations");
        for (var translation : content.translations())
            if (translation.description() == null || translation.description().isBlank())
                missing.add("translations." + translation.locale() + ".description");
        if (content.cooldownSeconds() == null)
            missing.add("cooldownSeconds");
        if (content.availability().equals("UNKNOWN"))
            missing.add("availability");
        if (content.unlockType().equals("UNKNOWN")
                || content.unlockType().equals("LEVEL") && content.unlockLevel() == null)
            missing.add("unlockType");
        return missing;
    }

    private static void fail(String message) {
        throw new ApiException(SpellErrorCode.SPELL_INVALID_CONTENT, message);
    }
}
