package com.wikiaov.platform;

import org.jspecify.annotations.Nullable;

/**
 * Reads a closed value that arrives as text, for a request field that keeps its own validation error instead of the
 * binding error an enum field would raise. The caller chooses the error for an unknown name.
 */
public final class EnumNames {
    private EnumNames() {
    }

    /** The constant of {@code type} named exactly {@code name}, or {@code null} when there is none. */
    public static <E extends Enum<E>> @Nullable E find(Class<E> type, @Nullable String name) {
        if (name == null) {
            return null;
        }

        for (E value : type.getEnumConstants()) {
            if (value.name().equals(name)) {
                return value;
            }
        }
        return null;
    }
}
