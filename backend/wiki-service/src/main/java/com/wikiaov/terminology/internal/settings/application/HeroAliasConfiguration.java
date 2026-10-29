package com.wikiaov.terminology.internal.settings.application;

import com.wikiaov.terminology.internal.settings.persistence.ReferenceTranslationRepository;
import java.util.*;
import org.springframework.stereotype.Component;

/** Reads only hero identities, locales and aliases; saved text snapshots stay outside the authoring read model. */
@Component
public class HeroAliasConfiguration {
    private final ReferenceTranslationRepository translations;

    public HeroAliasConfiguration(ReferenceTranslationRepository translations) {
        this.translations = translations;
    }

    public Map<String, Map<String, List<String>>> read() {
        var result = new HashMap<String, Map<String, List<String>>>();
        for (var row : translations.heroAliases())
            result.computeIfAbsent(row.getReferenceKey(), ignored -> new HashMap<>())
                    .put(row.getLocale().toLowerCase(Locale.ROOT), row.getAliases());
        return result;
    }
}
