package com.wikiaov.enchantment.internal.application.service;

import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.enchantment.internal.persistence.EnchantmentBranchRepository;
import com.wikiaov.enchantment.internal.persistence.entity.EnchantmentRevision;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Validates catalog content and explains publication readiness. */
@Component
class EnchantmentContentRules {
    private final MediaAssets media;
    private final EnchantmentBranchRepository metadata;

    EnchantmentContentRules(MediaAssets media, EnchantmentBranchRepository metadata) {
        this.media = media;
        this.metadata = metadata;
    }

    void validate(EnchantmentContent content) {
        if (content == null)
            fail("Content is required.");
        if (content.branchCode() != null && !metadata.existsById(content.branchCode()))
            fail("Unknown enchantment branch.");
        texts(content.translations());
        asset(content.iconAssetId());
        if (content.notes() != null && content.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (content.tier() != null && (content.tier() < 1 || content.tier() > 3)
                || content.position() != null && content.position() < 0)
            fail("Invalid enchantment position.");
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
        if (id != null && media.find(id)
                .filter(asset -> asset.usable() && asset.semanticType() == MediaSemanticType.ENCHANTMENT_ICON)
                .isEmpty())
            fail("The icon must be an active uploaded enchantment icon.");
    }

    List<UUID> assets(EnchantmentContent content) {
        var result = new ArrayList<UUID>();
        if (content.iconAssetId() != null)
            result.add(content.iconAssetId());

        return result;
    }

    List<String> readiness(EnchantmentRevision revision, EnchantmentContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null)
            result.add("effectiveFromPatchVariantId");
        return result;
    }

    List<String> missing(EnchantmentContent content) {
        var missing = new ArrayList<String>();
        if (content.iconAssetId() == null)
            missing.add("iconAssetId");
        if (content.translations().isEmpty())
            missing.add("translations");
        for (var translation : content.translations())
            if (translation.description() == null || translation.description().isBlank())
                missing.add("translations." + translation.locale() + ".description");
        if (content.branchCode() == null)
            missing.add("branchCode");
        if (content.tier() == null)
            missing.add("tier");
        if (content.position() == null)
            missing.add("position");
        return missing;
    }

    private static void fail(String message) {
        throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT, message);
    }
}
