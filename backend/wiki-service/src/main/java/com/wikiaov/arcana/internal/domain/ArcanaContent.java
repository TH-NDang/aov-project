package com.wikiaov.arcana.internal.domain;
import com.wikiaov.platform.CatalogText.*;
import java.util.*;

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
    public ArcanaContent mechanics() {
        return new ArcanaContent(iconAssetId, color, tier, stats, List.of(), null);
    }
    public ArcanaContent publicCopy(String locale) {
        return new ArcanaContent(iconAssetId, color, tier, stats,
                com.wikiaov.platform.CatalogText.select(translations, locale), null);
    }
    public ArcanaContent withTranslations(List<Translation> copy) {
        return new ArcanaContent(iconAssetId, color, tier, stats, copy, notes);
    }

}
