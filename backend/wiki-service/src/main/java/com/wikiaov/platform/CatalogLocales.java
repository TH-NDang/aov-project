package com.wikiaov.platform;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * Locale rules shared by the catalogs: the default content locale, the order a reader falls back in when a translation
 * is missing, and the shape of a catalog locale tag.
 */
public final class CatalogLocales {
    /** The locale a request reads when it names none, and the language content is written in first. */
    public static final String DEFAULT = "vi-VN";

    /** English, the first locale tried after the requested one. */
    public static final String ENGLISH = "en-US";

    /** A catalog locale: a language, optionally followed by a region, such as {@code vi} or {@code vi-VN}. */
    public static final String PATTERN = "[a-z]{2,3}(?:-[A-Z]{2})?";

    private static final Pattern COMPILED = Pattern.compile(PATTERN);

    private CatalogLocales() {
    }

    public static boolean isValid(String locale) {
        return locale != null && COMPILED.matcher(locale).matches();
    }

    /**
     * The locales a reader falls back through, best first: the requested locale, then English, then Vietnamese. A
     * translation in none of them comes after these, the first by locale tag.
     */
    public static List<String> fallbackOrder(@Nullable String requested) {
        var order = new ArrayList<String>(3);
        if (requested != null) {
            order.add(requested);
        }
        for (String locale : List.of(ENGLISH, DEFAULT)) {
            if (!order.contains(locale)) {
                order.add(locale);
            }
        }
        return List.copyOf(order);
    }

    /**
     * Orders translations best first for the requested locale, as {@link #fallbackOrder} lists them; the remaining
     * translations follow by locale tag, so the choice does not depend on the order rows were read in.
     */
    public static <T> Comparator<T> preference(@Nullable String requested,
            Function<? super T, @Nullable String> locale) {
        var order = fallbackOrder(requested);
        return Comparator.<T>comparingInt(value -> rank(order, locale.apply(value)))
                .thenComparing(locale, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    /** The translation a reader of the requested locale sees, or {@code null} when there is no translation. */
    public static <T> @Nullable T pick(Collection<? extends T> translations, @Nullable String requested,
            Function<? super T, @Nullable String> locale) {
        return translations.stream().min(preference(requested, locale)).orElse(null);
    }

    private static int rank(List<String> order, @Nullable String locale) {
        int index = locale == null ? -1 : order.indexOf(locale);
        return index < 0 ? order.size() : index;
    }
}
