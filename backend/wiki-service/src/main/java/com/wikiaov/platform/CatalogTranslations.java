package com.wikiaov.platform;

import com.wikiaov.platform.CatalogText.Translation;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/** Shared localized-copy rules; each catalog retains ownership of its API error code. */
public final class CatalogTranslations {
    private static final int MAX_TRANSLATIONS = 50;
    private static final int MAX_NAME_LENGTH = 255;
    private static final int MAX_SUMMARY_LENGTH = 2000;
    private static final int MAX_DESCRIPTION_LENGTH = 32768;
    private static final Pattern LOCALE = Pattern.compile("[a-z]{2,3}(?:-[A-Z]{2})?");

    private CatalogTranslations() {
    }

    public enum Violation {
        TOO_MANY_TRANSLATIONS("Too many translations."),
        INVALID_OR_DUPLICATE_LOCALE("Invalid or duplicate translation locale."),
        INVALID_LOCALIZED_CONTENT("Invalid localized content.");

        private final String detail;

        Violation(String detail) {
            this.detail = detail;
        }

        public String detail() {
            return detail;
        }
    }

    public static Optional<Violation> firstViolation(List<Translation> translations) {
        if (translations.size() > MAX_TRANSLATIONS)
            return Optional.of(Violation.TOO_MANY_TRANSLATIONS);
        var locales = new HashSet<String>();
        for (var translation : translations) {
            if (translation.locale() == null || !LOCALE.matcher(translation.locale()).matches()
                    || !locales.add(translation.locale()))
                return Optional.of(Violation.INVALID_OR_DUPLICATE_LOCALE);
            if (translation.name() == null || translation.name().isBlank()
                    || translation.name().length() > MAX_NAME_LENGTH
                    || exceeds(translation.summary(), MAX_SUMMARY_LENGTH)
                    || exceeds(translation.description(), MAX_DESCRIPTION_LENGTH))
                return Optional.of(Violation.INVALID_LOCALIZED_CONTENT);
        }
        return Optional.empty();
    }

    private static boolean exceeds(String text, int maximumLength) {
        return text != null && text.length() > maximumLength;
    }
}
