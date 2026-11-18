package com.wikiaov.platform;

import java.util.Locale;
import org.jspecify.annotations.Nullable;

/**
 * Builds the pattern of a case-insensitive "contains" search for a JPQL {@code lower(x) like :pattern escape '\'}.
 * The search text is matched literally: its {@code %}, {@code _} and backslashes are escaped.
 */
public final class LikePatterns {
    /** The escape character the patterns use; queries name it in their {@code escape} clause. */
    public static final char ESCAPE = '\\';

    private LikePatterns() {
    }

    /** A pattern matching every value that contains {@code text}, or every value when the text is blank. */
    public static String contains(@Nullable String text) {
        if (text == null || text.isBlank()) {
            return "%";
        }
        return "%" + escape(text.strip().toLowerCase(Locale.ROOT)) + "%";
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
