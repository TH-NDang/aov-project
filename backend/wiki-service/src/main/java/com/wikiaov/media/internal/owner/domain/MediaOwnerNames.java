package com.wikiaov.media.internal.owner.domain;

import java.util.Locale;
import org.jspecify.annotations.Nullable;

/**
 * Owner name rules (ADR-017). Names that differ only in letter case or whitespace belong to the same owner. V040
 * applies the same rule to existing data, so both must change together.
 */
public final class MediaOwnerNames {

    private MediaOwnerNames() {
    }

    /** Trimmed with inner whitespace collapsed; {@code null} when nothing is left. */
    public static @Nullable String display(@Nullable String name) {
        if (name == null) {
            return null;
        }
        String display = name.replaceAll("^\\s+|\\s+$", "").replaceAll("\\s+", " ");
        return display.isEmpty() ? null : display;
    }

    /** The catalog key of a display name. */
    public static String key(String display) {
        return display.toLowerCase(Locale.ROOT);
    }
}
