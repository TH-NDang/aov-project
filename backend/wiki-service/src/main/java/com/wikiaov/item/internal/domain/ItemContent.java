package com.wikiaov.item.internal.domain;
import com.wikiaov.platform.CatalogText.*;
import java.util.*;

public record ItemContent(
        UUID iconAssetId,
        Integer tier,
        Integer price,
        String categoryCode,
        List<ShopPosition> shopPositions,
        String recipeStatus,
        List<Component> components,
        List<Stat> stats,
        List<Translation> translations,
        String notes
) {
    public ItemContent {
        translations = translations == null ? List.of() : List.copyOf(translations);
        shopPositions = shopPositions == null ? List.of() : List.copyOf(shopPositions);
        components = components == null ? List.of() : List.copyOf(components);
        stats = stats == null ? List.of() : List.copyOf(stats);
        recipeStatus = recipeStatus == null ? "UNKNOWN" : recipeStatus;
    }
    public ItemContent mechanics() {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components, stats,
                List.of(), null);
    }
    public ItemContent publicCopy(String locale) {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components, stats,
                com.wikiaov.platform.CatalogText.select(translations, locale), null);
    }
    public ItemContent withTranslations(List<Translation> copy) {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components, stats,
                copy, notes);
    }
    public record ShopPosition(
            String categoryCode,
            Integer row,
            Integer column,
            String variant
    ) {
    }
    public record Component(
            UUID itemId,
            int quantity
    ) {
    }
}
