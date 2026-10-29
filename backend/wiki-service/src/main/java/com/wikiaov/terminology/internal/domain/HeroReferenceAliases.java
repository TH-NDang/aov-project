package com.wikiaov.terminology.internal.domain;

import com.wikiaov.terminology.internal.domain.ReferenceSettings.Translation;
import java.text.Normalizer;
import java.util.*;

/** Supplemental hero aliases never replace canonical localized names or descriptions. */
public final class HeroReferenceAliases {
    private HeroReferenceAliases() {
    }

    public static List<String> merge(List<String> canonical, List<String> supplemental) {
        var unique = new LinkedHashMap<String, String>();
        for (var source : List.of(canonical, supplemental))
            for (var alias : source) {
                var value = alias.strip();
                if (!value.isEmpty())
                    unique.putIfAbsent(Normalizer.normalize(value, Normalizer.Form.NFC).toLowerCase(Locale.ROOT),
                            value);
            }
        return List.copyOf(unique.values());
    }

    public static List<Translation> overlay(List<Translation> canonical, List<Translation> supplemental) {
        var aliases = new HashMap<String, List<String>>();
        supplemental.forEach(text -> aliases.put(text.locale().toLowerCase(Locale.ROOT), text.aliases()));
        return canonical.stream().map(text -> new Translation(text.locale(), text.name(),
                merge(text.aliases(), aliases.getOrDefault(text.locale().toLowerCase(Locale.ROOT), List.of())),
                text.description())).toList();
    }
}
