package com.wikiaov.arcana.internal.domain;

import com.wikiaov.platform.CatalogText;
import com.wikiaov.platform.CatalogText.Stat;
import com.wikiaov.platform.CatalogText.Translation;
import java.util.List;
import java.util.UUID;

public record ArcanaContent(
        UUID iconAssetId,
        String color,
        Integer tier,
        List<Stat> stats,
        List<Translation> translations,
        String notes
) {
    public ArcanaContent {
        translations = translations == null ? List.of() : List.copyOf(translations);
        stats = stats == null ? List.of() : List.copyOf(stats);
    }

    /** The gameplay fields alone, with numbers in comparable form, to tell a translation from a gameplay change. */
    public ArcanaContent mechanics() {
        return new ArcanaContent(iconAssetId, color, tier, CatalogText.comparable(stats), List.of(), null);
    }

    public ArcanaContent publicCopy(String locale) {
        return new ArcanaContent(iconAssetId, color, tier, stats,
                com.wikiaov.platform.CatalogText.select(translations, locale), null);
    }

    public ArcanaContent withTranslations(List<Translation> copy) {
        return new ArcanaContent(iconAssetId, color, tier, stats, copy, notes);
    }

}
