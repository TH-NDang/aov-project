package com.wikiaov.community.tournament.internal.domain;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Set;

public final class SourceUrls {
    private SourceUrls() {
    }

    public static boolean valid(String value) {
        if (value == null || value.isBlank())
            return true;
        if (value.length() > 2048 || !value.equals(value.trim())
                || value.chars().anyMatch(character -> character <= 32 || character == 127 || character == '\\'))
            return false;

        try {
            var uri = new URI(value);
            return uri.getScheme() != null
                    && Set.of("https", "http").contains(uri.getScheme().toLowerCase(java.util.Locale.ROOT))
                    && uri.getHost() != null && !uri.getHost().isBlank() && uri.getRawUserInfo() == null;
        } catch (URISyntaxException error) {
            return false;
        }
    }
}
