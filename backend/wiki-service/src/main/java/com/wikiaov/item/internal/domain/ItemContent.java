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

    /** The gameplay fields alone, with numbers in comparable form, to tell a translation from a gameplay change. */
    public ItemContent mechanics() {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components,
                com.wikiaov.platform.CatalogText.comparable(stats), List.of(), null);
    }

    public ItemContent publicCopy(String locale) {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components, stats,
                com.wikiaov.platform.CatalogText.select(translations, locale), null);
    }

    public ItemContent withTranslations(List<Translation> copy) {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components, stats,
                copy, notes);
    }

    /**
     * Removes the quotes the spreadsheet import left in descriptions: the one opening the whole text, whether or not it
     * is closed at the end, and any quote that pairs with nothing. A quoted name inside the text keeps both of its
     * quotes. Published rows keep their stored text, so readers rely on this rather than on a data migration.
     */
    public static String unwrapDescription(String description) {
        if (description == null || description.indexOf('"') < 0)
            return description;

        String value = description.strip();
        if (value.startsWith("\""))
            value = value.substring(1);
        return withoutUnpairedQuotes(value);
    }

    private static String withoutUnpairedQuotes(String text) {
        var unpaired = new BitSet(text.length());
        int open = -1;
        for (int index = text.indexOf('"'); index >= 0; index = text.indexOf('"', index + 1)) {
            if (opensQuote(text, index)) {
                if (open >= 0)
                    unpaired.set(open);
                open = index;
            } else if (open >= 0) {
                open = -1;
            } else {
                unpaired.set(index);
            }
        }
        if (open >= 0)
            unpaired.set(open);

        var result = new StringBuilder(text.length());
        for (int index = 0; index < text.length(); index++)
            if (!unpaired.get(index))
                result.append(text.charAt(index));
        return result.toString().strip();
    }

    private static boolean opensQuote(String text, int index) {
        if (index == 0)
            return true;
        char before = text.charAt(index - 1);
        return Character.isWhitespace(before) || before == '(' || before == '[';
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
