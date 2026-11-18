package com.wikiaov.community.tournament.internal.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;

public final class ReferenceLabels {
    public static final int MAX_ALIASES = 20;
    /** Aliases, short names and other one-word labels of a team or player. */
    public static final int MAX_LABEL = 100;

    private ReferenceLabels() {
    }

    public static boolean validAliases(List<String> aliases) {
        if (aliases == null || aliases.size() > MAX_ALIASES) {
            return false;
        }

        var names = new HashSet<String>();
        for (var alias : aliases) {
            if (alias == null || alias.isBlank() || alias.length() > MAX_LABEL
                    || !names.add(alias.toLowerCase(Locale.ROOT))) {
                return false;
            }
        }
        return true;
    }

    public static String literalSearch(String query) {
        return query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
