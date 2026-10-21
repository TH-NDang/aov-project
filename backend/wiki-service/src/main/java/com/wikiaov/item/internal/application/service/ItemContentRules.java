package com.wikiaov.item.internal.application.service;

import com.wikiaov.item.internal.application.ItemErrorCode;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.persistence.ItemCategoryRepository;
import com.wikiaov.item.internal.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.persistence.entity.ItemRevision;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Stat;
import com.wikiaov.platform.CatalogText.Translation;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Validates catalog content and explains publication readiness. */
@Component
class ItemContentRules {
    private final ItemIdentityRepository identities;
    private final MediaAssets media;
    private final ItemCategoryRepository metadata;

    ItemContentRules(ItemIdentityRepository identities, MediaAssets media, ItemCategoryRepository metadata) {
        this.identities = identities;
        this.media = media;
        this.metadata = metadata;
    }

    void validate(ItemContent content) {
        if (content == null)
            fail("Content is required.");
        if (content.categoryCode() != null && !metadata.existsById(content.categoryCode()))
            fail("Unknown item category.");
        for (var position : content.shopPositions())
            if (position.categoryCode() == null || !metadata.existsById(position.categoryCode()))
                fail("Unknown shop category.");
        texts(content.translations());
        asset(content.iconAssetId());
        if (content.notes() != null && content.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (content.tier() != null && (content.tier() < 1 || content.tier() > 3)
                || content.price() != null && content.price() < 0)
            fail("Invalid tier or price.");
        if (!Set.of("UNKNOWN", "NONE", "VERIFIED").contains(content.recipeStatus()))
            fail("Unknown recipe status.");
        if (!content.recipeStatus().equals("VERIFIED") && !content.components().isEmpty())
            fail("Only verified recipes may have confirmed components.");
        if (content.components().stream().map(ItemContent.Component::itemId).distinct().count() != content.components()
                .size())
            fail("Duplicate recipe component.");
        for (var component : content.components()) {
            if (component.itemId() == null || component.quantity() < 1 || component.quantity() > 100
                    || !identities.existsById(component.itemId()))
                fail("Invalid recipe component.");
        }
        for (var p : content.shopPositions())
            if (p.categoryCode() == null || p.row() != null && p.row() < 0 || p.column() != null && p.column() < 0)
                fail("Invalid shop position.");
        stats(content.stats());
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

    private void stats(List<Stat> stats) {
        var keys = new HashSet<String>();
        for (var stat : stats)
            if (stat.key() == null || !stat.key().matches("[a-z0-9]+(?:-[a-z0-9]+)*") || stat.value() == null
                    || !keys.add(stat.key()))
                fail("Invalid or duplicate numeric stat.");
    }

    private void asset(UUID id) {
        if (id != null
                && media.find(id).filter(asset -> asset.usable() && asset.semanticType() == MediaSemanticType.ITEM_ICON)
                        .isEmpty())
            fail("The icon must be an active uploaded item icon.");
    }

    List<UUID> assets(ItemContent content) {
        var result = new ArrayList<UUID>();
        if (content.iconAssetId() != null)
            result.add(content.iconAssetId());

        return result;
    }

    List<String> readiness(ItemRevision revision, ItemContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null)
            result.add("effectiveFromPatchVariantId");
        return result;
    }

    List<String> missing(ItemContent content) {
        var missing = new ArrayList<String>();
        if (content.iconAssetId() == null)
            missing.add("iconAssetId");
        if (content.translations().isEmpty())
            missing.add("translations");
        for (var translation : content.translations())
            if (translation.description() == null || translation.description().isBlank())
                missing.add("translations." + translation.locale() + ".description");
        if (content.tier() == null)
            missing.add("tier");
        if (content.price() == null)
            missing.add("price");
        if (content.categoryCode() == null)
            missing.add("categoryCode");
        if (content.recipeStatus().equals("UNKNOWN"))
            missing.add("recipeStatus");
        return missing;
    }

    private static void fail(String message) {
        throw new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT, message);
    }
}
