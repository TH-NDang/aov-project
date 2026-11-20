package com.wikiaov.item.internal.catalog.application;

import com.wikiaov.item.internal.application.ItemErrorCode;
import com.wikiaov.item.internal.catalog.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemRevision;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.domain.ItemContent.Effect;
import com.wikiaov.item.internal.domain.ItemContent.Grant;
import com.wikiaov.item.internal.domain.ItemContent.Growth;
import com.wikiaov.item.internal.metadata.persistence.ItemCategoryRepository;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogCodes;
import com.wikiaov.platform.CatalogObservation;
import com.wikiaov.platform.CatalogStats;
import com.wikiaov.platform.CatalogText.Stat;
import com.wikiaov.platform.CatalogTranslations;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/** Validates catalog content and explains publication readiness. */
@Component
class ItemContentRules {
    private static final int MAX_EFFECTS = 20;

    private static final int MAX_GRANTS = 10;

    private static final int MAX_SCALINGS = 5;

    private final ItemIdentityRepository identities;
    private final MediaAssets media;
    private final ItemCategoryRepository metadata;

    ItemContentRules(ItemIdentityRepository identities, MediaAssets media, ItemCategoryRepository metadata) {
        this.identities = identities;
        this.media = media;
        this.metadata = metadata;
    }

    void validate(ItemContent content) {
        if (content == null) {
            fail("Content is required.");
        }
        validateCategories(content);

        CatalogTranslations.firstViolation(content.translations()).ifPresent(violation -> fail(violation.detail()));
        validateIcon(content.iconAssetId());
        if (content.notes() != null && content.notes().length() > 32768) {
            fail("Notes exceed the maximum length.");
        }
        if (content.tier() != null && (content.tier() < 1 || content.tier() > 3)
                || content.price() != null && content.price() < 0) {
            fail("Invalid tier or price.");
        }
        validateRecipe(content);
        validateShopPositions(content);
        validateStats(content.stats());
        validateEffects(content.effects());
    }

    private void validateCategories(ItemContent content) {
        if (content.categoryCode() != null && !metadata.existsById(content.categoryCode())) {
            fail("Unknown item category.");
        }
        for (var position : content.shopPositions()) {
            if (position.categoryCode() == null || !metadata.existsById(position.categoryCode())) {
                fail("Unknown shop category.");
            }
        }
    }

    private void validateRecipe(ItemContent content) {
        if (!Set.of("UNKNOWN", "NONE", "VERIFIED").contains(content.recipeStatus())) {
            fail("Unknown recipe status.");
        }
        if (!content.recipeStatus().equals("VERIFIED") && !content.components().isEmpty()) {
            fail("Only verified recipes may have confirmed components.");
        }
        if (content.components().stream().map(ItemContent.Component::itemId).distinct().count() != content.components()
                .size()) {
            fail("Duplicate recipe component.");
        }

        for (var component : content.components()) {
            if (component.itemId() == null || component.quantity() < 1 || component.quantity() > 100
                    || !identities.existsById(component.itemId())) {
                fail("Invalid recipe component.");
            }
        }
    }

    private void validateShopPositions(ItemContent content) {
        for (var p : content.shopPositions()) {
            if (p.categoryCode() == null || p.row() != null && p.row() < 0 || p.column() != null && p.column() < 0) {
                fail("Invalid shop position.");
            }
        }
    }

    private void validateStats(List<Stat> stats) {
        var keys = new HashSet<String>();
        for (var stat : stats) {
            if (!CatalogStats.isKey(stat.key()) || !CatalogStats.isUnit(stat.unit()) || stat.value() == null
                    || !keys.add(stat.key())) {
                fail("Invalid or duplicate numeric stat.");
            }
        }
    }

    private void validateEffects(List<Effect> effects) {
        if (effects.size() > MAX_EFFECTS) {
            fail("Too many effects.");
        }

        var keys = new HashSet<String>();
        for (var effect : effects) {
            if (effect.key() == null || !effect.key().matches(CatalogCodes.PATTERN) || !keys.add(effect.key())) {
                fail("Invalid or duplicate effect key.");
            }
            if (!absentOrPositive(effect.cooldownSeconds()) || effect.maxStacks() != null && effect.maxStacks() < 1) {
                fail("Invalid effect cooldown or stacks.");
            }
            if (effect.grants().size() > MAX_GRANTS) {
                fail("Too many stat grants.");
            }
            for (var grant : effect.grants()) {
                validateGrant(effect, grant);
            }
        }
    }

    private void validateGrant(Effect effect, Grant grant) {
        if (!CatalogStats.isKey(grant.stat()) || !CatalogStats.isUnit(grant.unit())) {
            fail("Invalid stat grant.");
        }
        if (grant.value() == null && grant.scalings().isEmpty() || negative(grant.value())
                || grant.maxValue() != null
                        && (grant.value() == null || grant.maxValue().compareTo(grant.value()) < 0)) {
            fail("Invalid stat grant amount.");
        }
        if (grant.growth() == Growth.LEVEL && grant.maxValue() == null
                || grant.growth() == Growth.STACK && effect.maxStacks() == null) {
            fail("Invalid stat grant growth.");
        }
        if (!absentOrPositive(grant.cap()) || !absentOrPositive(grant.durationSeconds())) {
            fail("Invalid stat grant cap or duration.");
        }

        if (grant.scalings().size() > MAX_SCALINGS) {
            fail("Too many grant scalings.");
        }
        for (var scaling : grant.scalings()) {
            if (scaling.source() == null || scaling.value() == null || scaling.value().signum() <= 0
                    || !CatalogStats.isUnit(scaling.unit())) {
                fail("Invalid grant scaling.");
            }
        }
    }

    /** True when the value is absent or above zero. */
    private static boolean absentOrPositive(@Nullable BigDecimal value) {
        return value == null || value.signum() > 0;
    }

    private static boolean negative(@Nullable BigDecimal value) {
        return value != null && value.signum() < 0;
    }

    private void validateIcon(UUID id) {
        if (id != null
                && media.find(id).filter(asset -> asset.usable() && asset.semanticType() == MediaSemanticType.ITEM_ICON)
                        .isEmpty()) {
            fail("The icon must be an active uploaded item icon.");
        }
    }

    List<UUID> assets(ItemContent content) {
        var result = new ArrayList<UUID>();
        if (content.iconAssetId() != null) {
            result.add(content.iconAssetId());
        }

        return result;
    }

    List<String> readiness(ItemRevision revision, ItemContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null && !CatalogObservation.isUnscopedBaseline(
                revision.getCause(), revision.getSourceRevisionId(), revision.getEffectiveFromPatchVariantId())) {
            result.add("effectiveFromPatchVariantId");
        }
        return result;
    }

    List<String> missing(ItemContent content) {
        var missing = new ArrayList<String>();
        if (content.iconAssetId() == null) {
            missing.add("iconAssetId");
        }
        if (content.translations().isEmpty()) {
            missing.add("translations");
        }
        for (var translation : content.translations()) {
            if (translation.description() == null || translation.description().isBlank()) {
                missing.add("translations." + translation.locale() + ".description");
            }
        }
        if (content.tier() == null) {
            missing.add("tier");
        }
        if (content.price() == null) {
            missing.add("price");
        }
        if (content.categoryCode() == null) {
            missing.add("categoryCode");
        }
        if (content.recipeStatus().equals("UNKNOWN")) {
            missing.add("recipeStatus");
        }

        return missing;
    }

    private static void fail(String message) {
        throw new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT, message);
    }
}
