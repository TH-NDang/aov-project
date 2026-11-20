package com.wikiaov.enchantment.internal.domain;

import com.wikiaov.platform.CatalogText;
import com.wikiaov.platform.CatalogText.Translation;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * An enchantment's gameplay and its translations. Besides its place in the branch it records how it is used: passive,
 * an active item the player triggers, or an upgrade of the equipped talent; its cooldown, which may grow with each use
 * and is then a range; how many times a match allows it; and the match time it becomes or stops being available.
 */
public record EnchantmentContent(
        UUID iconAssetId,
        String branchCode,
        Integer tier,
        Integer position,
        String activation,
        BigDecimal cooldownSeconds,
        BigDecimal cooldownMaxSeconds,
        Integer maxUses,
        Integer availableFromSeconds,
        Integer availableUntilSeconds,
        List<Translation> translations,
        String notes
) {
    public static final String UNKNOWN_ACTIVATION = "UNKNOWN";

    public static final Set<String> ACTIVATIONS = Set.of("PASSIVE", "ACTIVE", "TALENT_UPGRADE", UNKNOWN_ACTIVATION);

    public EnchantmentContent {
        translations = translations == null ? List.of() : List.copyOf(translations);
        activation = activation == null ? UNKNOWN_ACTIVATION : activation;
    }

    /** The gameplay fields alone, with numbers in comparable form, to tell a translation from a gameplay change. */
    public EnchantmentContent mechanics() {
        return new EnchantmentContent(iconAssetId, branchCode, tier, position, activation,
                CatalogText.comparable(cooldownSeconds), CatalogText.comparable(cooldownMaxSeconds), maxUses,
                availableFromSeconds, availableUntilSeconds, List.of(), null);
    }

    public EnchantmentContent publicCopy(String locale) {
        return new EnchantmentContent(iconAssetId, branchCode, tier, position, activation, cooldownSeconds,
                cooldownMaxSeconds, maxUses, availableFromSeconds, availableUntilSeconds,
                CatalogText.select(translations, locale), null);
    }

    public EnchantmentContent withTranslations(List<Translation> copy) {
        return new EnchantmentContent(iconAssetId, branchCode, tier, position, activation, cooldownSeconds,
                cooldownMaxSeconds, maxUses, availableFromSeconds, availableUntilSeconds, copy, notes);
    }

    /** The same gameplay at another place in its tier, without translations, as reordering stores it. */
    public EnchantmentContent atPosition(Integer index) {
        return new EnchantmentContent(iconAssetId, branchCode, tier, index, activation, cooldownSeconds,
                cooldownMaxSeconds, maxUses, availableFromSeconds, availableUntilSeconds, List.of(), notes);
    }

    /** A new entry that has only a name so far. */
    public static EnchantmentContent named(Translation translation) {
        return new EnchantmentContent(null, null, null, null, null, null, null, null, null, null,
                List.of(translation), null);
    }
}
