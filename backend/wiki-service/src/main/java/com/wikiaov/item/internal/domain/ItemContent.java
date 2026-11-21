package com.wikiaov.item.internal.domain;

import com.wikiaov.platform.CatalogText;
import com.wikiaov.platform.CatalogText.Stat;
import com.wikiaov.platform.CatalogText.Translation;
import java.math.BigDecimal;
import java.util.BitSet;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * An item's gameplay and its translations. {@code stats} are the fixed stats, the "+N" lines of the description;
 * {@code effects} hold the gameplay of each effect the description writes, in its order, with the stats it grants
 * (ADR-033).
 */
public record ItemContent(
        UUID iconAssetId,
        Integer tier,
        Integer price,
        String categoryCode,
        List<ShopPosition> shopPositions,
        String recipeStatus,
        List<Component> components,
        List<Stat> stats,
        List<Effect> effects,
        List<Translation> translations,
        String notes
) {
    public ItemContent {
        translations = translations == null ? List.of() : List.copyOf(translations);
        shopPositions = shopPositions == null ? List.of() : List.copyOf(shopPositions);
        components = components == null ? List.of() : List.copyOf(components);
        stats = stats == null ? List.of() : List.copyOf(stats);
        effects = effects == null ? List.of() : List.copyOf(effects);
        recipeStatus = recipeStatus == null ? "UNKNOWN" : recipeStatus;
    }

    /** The gameplay fields alone, with numbers in comparable form, to tell a translation from a gameplay change. */
    public ItemContent mechanics() {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components,
                CatalogText.comparable(stats), effects.stream().map(Effect::comparable).toList(), List.of(), null);
    }

    public ItemContent publicCopy(String locale) {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components, stats,
                effects, CatalogText.select(translations, locale), null);
    }

    public ItemContent withTranslations(List<Translation> copy) {
        return new ItemContent(iconAssetId, tier, price, categoryCode, shopPositions, recipeStatus, components, stats,
                effects, copy, notes);
    }

    /**
     * Removes the quotes the spreadsheet import left in descriptions: the one opening the whole text, whether or not it
     * is closed at the end, and any quote that pairs with nothing. A quoted name inside the text keeps both of its
     * quotes. Published rows keep their stored text, so readers rely on this rather than on a data migration.
     */
    public static String unwrapDescription(String description) {
        if (description == null || description.indexOf('"') < 0) {
            return description;
        }

        String value = description.strip();
        if (value.startsWith("\"")) {
            value = value.substring(1);
        }
        return withoutUnpairedQuotes(value);
    }

    private static String withoutUnpairedQuotes(String text) {
        var unpaired = new BitSet(text.length());
        int open = -1;
        for (int index = text.indexOf('"'); index >= 0; index = text.indexOf('"', index + 1)) {
            if (opensQuote(text, index)) {
                if (open >= 0) {
                    unpaired.set(open);
                }
                open = index;
            } else if (open >= 0) {
                open = -1;
            } else {
                unpaired.set(index);
            }
        }
        if (open >= 0) {
            unpaired.set(open);
        }

        var result = new StringBuilder(text.length());
        for (int index = 0; index < text.length(); index++) {
            if (!unpaired.get(index)) {
                result.append(text.charAt(index));
            }
        }
        return result.toString().strip();
    }

    private static boolean opensQuote(String text, int index) {
        if (index == 0) {
            return true;
        }
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

    /** How an effect is used: always on while the item is held, or triggered by the player. */
    public enum Activation {
        PASSIVE,
        ACTIVE
    }

    /** How a grant's amount grows: by hero level from its value to its maximum, or by stack. */
    public enum Growth {
        LEVEL,
        STACK
    }

    /** Who receives a grant: the holder alone, or the holder and nearby allies. */
    public enum Target {
        SELF,
        TEAM
    }

    /** The stat a scaling part follows. Bonus stats are those above the hero's base. */
    public enum ScalingSource {
        MAX_HEALTH,
        BONUS_HEALTH,
        PHYSICAL_ATTACK,
        BONUS_PHYSICAL_ATTACK,
        MAGIC_ATTACK,
        HERO_LEVEL
    }

    /**
     * The gameplay of one effect. Its name and words stay in the description of each translation; {@code key} is the
     * code of its Vietnamese name, the same for the same mechanic across items.
     */
    public record Effect(
            String key,
            Activation activation,
            boolean unique,
            @Nullable BigDecimal cooldownSeconds,
            @Nullable Integer maxStacks,
            List<Grant> grants
    ) {
        public Effect {
            activation = activation == null ? Activation.PASSIVE : activation;
            grants = grants == null ? List.of() : List.copyOf(grants);
        }

        Effect comparable() {
            return new Effect(key, activation, unique, CatalogText.comparable(cooldownSeconds), maxStacks,
                    grants.stream().map(Grant::comparable).toList());
        }
    }

    /**
     * A stat an effect grants. {@code value} alone is a fixed amount; with {@code maxValue} it is a range, which grows
     * by hero level under {@link Growth#LEVEL}; under {@link Growth#STACK} it is the amount of each stack. A grant may
     * also follow another stat, have a cap, last a few seconds or reach the team nearby.
     */
    public record Grant(
            String stat,
            @Nullable BigDecimal value,
            @Nullable BigDecimal maxValue,
            @Nullable String unit,
            @Nullable Growth growth,
            List<Scaling> scalings,
            @Nullable BigDecimal cap,
            @Nullable BigDecimal durationSeconds,
            Target target
    ) {
        public Grant {
            scalings = scalings == null ? List.of() : List.copyOf(scalings);
            target = target == null ? Target.SELF : target;
        }

        Grant comparable() {
            return new Grant(stat, CatalogText.comparable(value), CatalogText.comparable(maxValue), unit, growth,
                    scalings.stream().map(Scaling::comparable).toList(), CatalogText.comparable(cap),
                    CatalogText.comparable(durationSeconds), target);
        }
    }

    /** A part of a grant that follows another stat, such as 3% of bonus health or 40 per hero level. */
    public record Scaling(
            ScalingSource source,
            BigDecimal value,
            @Nullable String unit
    ) {
        Scaling comparable() {
            return new Scaling(source, CatalogText.comparable(value), unit);
        }
    }
}
