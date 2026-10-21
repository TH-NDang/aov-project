package com.wikiaov.spell.internal.application.service;

import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import com.wikiaov.spell.internal.application.SpellErrorCode;
import com.wikiaov.spell.internal.domain.SpellContent;
import com.wikiaov.spell.internal.persistence.entity.SpellRevision;
import java.util.ArrayList;
import java.util.HashSet;
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
        texts(content.translations());
        asset(content.iconAssetId());
        if (content.notes() != null && content.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (content.cooldownSeconds() != null && content.cooldownSeconds().signum() < 0
                || content.chargeRechargeSeconds() != null && content.chargeRechargeSeconds().signum() < 0
                || content.unlockLevel() != null && content.unlockLevel() < 1
                || content.maxCharges() != null && content.maxCharges() < 1
                || content.displayOrder() < 0)
            fail("Invalid spell numeric field.");
        if (!Set.of("AVAILABLE", "REMOVED", "UNKNOWN").contains(content.availability())
                || !Set.of("ACCOUNT_CREATION", "LEVEL", "UNKNOWN").contains(content.unlockType()))
            fail("Invalid spell availability or unlock type.");
        if (content.states().stream().map(SpellContent.SpellState::key).distinct().count() != content.states().size())
            fail("Duplicate spell state.");
        for (var state : content.states()) {
            if (state.key() == null || !state.key().matches("[a-z0-9]+(?:-[a-z0-9]+)*"))
                fail("Invalid spell state key.");
            asset(state.iconAssetId());
            texts(state.translations());
        }
        if (content.defaultStateKey() != null
                && content.states().stream().noneMatch(s -> s.key().equals(content.defaultStateKey())))
            fail("The default spell state must exist.");
        content.referenceImages().forEach(owner -> asset(owner.assetId()));
    }

    private void texts(List<Translation> copy) {
        if (copy.size() > 50)
            fail("Too many translations.");
        var seen = new HashSet<String>();
        for (var translation : copy) {
            if (translation.locale() == null || !translation.locale().matches("[a-z]{2,3}(?:-[A-Z]{2})?")
                    || !seen.add(translation.locale()))
                fail("Invalid or duplicate translation locale.");
            if (translation.name() == null || translation.name().isBlank() || translation.name().length() > 255
                    || translation.summary() != null && translation.summary().length() > 2000
                    || translation.description() != null && translation.description().length() > 32768)
                fail("Invalid localized content.");
        }
    }

    private void asset(UUID id) {
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
        if (revision.getEffectiveFromPatchVariantId() == null && !archived(revision, content))
            result.add("effectiveFromPatchVariantId");
        return result;
    }

    boolean archived(SpellRevision revision, SpellContent content) {
        return revision.getEffectiveFromPatchVariantId() == null && !revision.getCause().equals("GAME_PATCH")
                && content.legacy() && content.availability().equals("REMOVED");
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
