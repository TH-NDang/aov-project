package com.wikiaov.platform;

import java.math.BigDecimal;
import java.util.*;

/** Localized catalog copy and numeric modifiers shared by the small catalog APIs. */
public final class CatalogText {
    private CatalogText() {
    }

    public static List<Translation> select(List<Translation> translations, String locale) {
        for (String candidate : List.of(locale, CatalogLocales.DEFAULT, "en-US")) {
            var found = translations.stream().filter(text -> text.locale().equals(candidate)).findFirst();
            if (found.isPresent())
                return List.of(found.get());
        }
        return translations.stream().sorted(Comparator.comparing(Translation::locale)).findFirst()
                .map(List::of).orElseGet(List::of);
    }

    /**
     * A decimal in the form used to compare gameplay values: stored numbers keep their scale ({@code 9.0}) while JSON
     * clients send them back as {@code 9}, and {@link BigDecimal#equals} would tell the two apart.
     */
    public static BigDecimal comparable(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros();
    }

    public static List<Stat> comparable(List<Stat> stats) {
        return stats.stream().map(stat -> new Stat(stat.key(), comparable(stat.value()), stat.unit())).toList();
    }

    public record Effect(
            String key,
            String name,
            String description,
            String type
    ) {
    }

    public record Translation(
            String locale,
            String name,
            String summary,
            String description,
            Map<String, String> statLabels,
            List<Effect> effects,
            Map<String, String> variantLabels
    ) {
        public Translation {
            statLabels = statLabels == null ? Map.of() : Map.copyOf(statLabels);
            effects = effects == null ? List.of() : List.copyOf(effects);
            variantLabels = variantLabels == null ? Map.of() : Map.copyOf(variantLabels);
        }

        public Translation(String locale, String name, String summary, String description,
                Map<String, String> statLabels, List<Effect> effects) {
            this(locale, name, summary, description, statLabels, effects, Map.of());
        }
    }

    public record Stat(
            String key,
            BigDecimal value,
            String unit
    ) {
    }

    public record MetadataTranslation(
            String locale,
            String name,
            String description,
            String suitability
    ) {
    }
}
