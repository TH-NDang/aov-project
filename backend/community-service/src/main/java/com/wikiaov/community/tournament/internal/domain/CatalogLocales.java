package com.wikiaov.community.tournament.internal.domain;

import java.util.Set;

/**
 * Locales the wiki catalog can be read in. A game names one of them so that its heroes, spells and items can always
 * be resolved; the catalog client and the game rules share this one list.
 */
public final class CatalogLocales {
    private static final Set<String> SUPPORTED = Set.of("vi-VN", "en-US");

    private CatalogLocales() {
    }

    public static boolean supported(String locale) {
        return locale != null && SUPPORTED.contains(locale);
    }
}
