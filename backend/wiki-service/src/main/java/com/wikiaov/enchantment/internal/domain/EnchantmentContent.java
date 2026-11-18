package com.wikiaov.enchantment.internal.domain;

import com.wikiaov.platform.CatalogText;
import com.wikiaov.platform.CatalogText.Translation;
import java.util.List;
import java.util.UUID;

public record EnchantmentContent(
        UUID iconAssetId,
        String branchCode,
        Integer tier,
        Integer position,
        List<Translation> translations,
        String notes
) {
    public EnchantmentContent {
        translations = translations == null ? List.of() : List.copyOf(translations);

    }

    public EnchantmentContent mechanics() {
        return new EnchantmentContent(iconAssetId, branchCode, tier, position, List.of(), null);
    }

    public EnchantmentContent publicCopy(String locale) {
        return new EnchantmentContent(iconAssetId, branchCode, tier, position,
                CatalogText.select(translations, locale), null);
    }

    public EnchantmentContent withTranslations(List<Translation> copy) {
        return new EnchantmentContent(iconAssetId, branchCode, tier, position, copy, notes);
    }

}
