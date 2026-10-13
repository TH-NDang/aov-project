package com.wikiaov.user.internal.domain;

import java.time.ZoneId;
import java.util.Locale;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Validated profile content; never contains identity or privileges supplied by the client. */
public record ProfileInput(
        String displayName,
        String biography,
        String locale,
        String timeZone,
        @Nullable UUID avatarAssetId,
        long expectedVersion
) {
    public ProfileInput {
        displayName = displayName == null ? "" : displayName.strip();
        biography = biography == null ? "" : biography.strip();
        if (displayName.isBlank() || displayName.length() > 80 || biography.length() > 1000
                || expectedVersion < 0 || locale == null || locale.length() > 35
                || timeZone == null || timeZone.length() > 64) {
            throw new IllegalArgumentException("Invalid profile fields.");
        }
        Locale parsed;
        try {
            parsed = new Locale.Builder().setLanguageTag(locale).build();
        } catch (java.util.IllformedLocaleException ex) {
            throw new IllegalArgumentException("Invalid language tag.", ex);
        }
        if (parsed.getLanguage().isEmpty()
                || !java.util.Set.of(Locale.getISOLanguages()).contains(parsed.getLanguage())) {
            throw new IllegalArgumentException("Unsupported profile language.");
        }
        locale = parsed.toLanguageTag();
        if (!ZoneId.getAvailableZoneIds().contains(timeZone)) {
            throw new IllegalArgumentException("Unknown IANA time zone.");
        }
    }
}
