package com.wikiaov.platform;

import java.util.regex.Pattern;

/** Locale rules shared by the catalogs: the default content locale and the shape of a catalog locale tag. */
public final class CatalogLocales {
    /** The locale content is written in first and falls back to. */
    public static final String DEFAULT = "vi-VN";

    /** A catalog locale: a language, optionally followed by a region, such as {@code vi} or {@code vi-VN}. */
    public static final String PATTERN = "[a-z]{2,3}(?:-[A-Z]{2})?";

    private static final Pattern COMPILED = Pattern.compile(PATTERN);

    private CatalogLocales() {
    }

    public static boolean isValid(String locale) {
        return locale != null && COMPILED.matcher(locale).matches();
    }
}
