package com.wikiaov.user.internal.domain;

import java.time.ZoneId;
import java.util.Currency;
import java.util.IllformedLocaleException;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Validated profile content; never contains identity or privileges supplied by the client. A null date format,
 * currency or auto-translate choice keeps the one already saved, so a client that does not know the field cannot erase
 * it.
 */
public record ProfileInput(
        String displayName,
        String biography,
        String locale,
        String timeZone,
        @Nullable String dateFormat,
        @Nullable UUID avatarAssetId,
        long expectedVersion,
        @Nullable String currency,
        @Nullable Boolean autoTranslate
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
        } catch (IllformedLocaleException ex) {
            throw new IllegalArgumentException("Invalid language tag.", ex);
        }
        if (parsed.getLanguage().isEmpty()
                || !Set.of(Locale.getISOLanguages()).contains(parsed.getLanguage())) {
            throw new IllegalArgumentException("Unsupported profile language.");
        }
        if (dateFormat != null && !Set.of("AUTO", "DMY", "MDY", "YMD").contains(dateFormat)) {
            throw new IllegalArgumentException("Unknown date format.");
        }
        locale = parsed.toLanguageTag();
        if (!ZoneId.getAvailableZoneIds().contains(timeZone)) {
            throw new IllegalArgumentException("Unknown IANA time zone.");
        }
        if (currency != null && Currency.getAvailableCurrencies().stream()
                .noneMatch(known -> known.getCurrencyCode().equals(currency))) {
            throw new IllegalArgumentException("Unknown ISO currency.");
        }
    }
}
