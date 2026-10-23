package com.wikiaov.enchantment.internal.catalog.application;

import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.enchantment.internal.metadata.persistence.EnchantmentBranchRepository;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogTranslations;
import java.util.ArrayList;
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
        CatalogTranslations.firstViolation(content.translations()).ifPresent(violation -> fail(violation.detail()));
        validateIcon(content.iconAssetId());
        if (content.notes() != null && content.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (content.tier() != null && (content.tier() < 1 || content.tier() > 3)
                || content.position() != null && content.position() < 0)
            fail("Invalid enchantment position.");
    }

    private void validateIcon(UUID id) {
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
