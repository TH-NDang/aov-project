package com.wikiaov.community.tournament.internal.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;

public final class ReferenceLabels {
    private ReferenceLabels() {
    }

    public static boolean validAliases(List<String> aliases) {
        if (aliases == null || aliases.size() > 20)
            return false;

        var names = new HashSet<String>();
        for (var alias : aliases)
            if (alias == null || alias.isBlank() || alias.length() > 100
                    || !names.add(alias.toLowerCase(Locale.ROOT)))
                return false;
        return true;
    }

    public static String literalSearch(String query) {
        return query.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
