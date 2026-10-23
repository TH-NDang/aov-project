package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.platform.CatalogText.Translation;
import com.wikiaov.platform.CatalogTranslations.Violation;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class CatalogTranslationsTest {
    @Test
    void acceptsAnEmptyDraftAndExactlyFiftyDistinctLocales() {
        assertThat(CatalogTranslations.firstViolation(List.of())).isEmpty();
        var translations = IntStream.range(0, 50)
                .mapToObj(index -> text("x" + (char) ('a' + index / 26) + (char) ('a' + index % 26), "Name"))
                .toList();
        assertThat(CatalogTranslations.firstViolation(translations)).isEmpty();
    }

    @Test
    void reportsTheCollectionLimitBeforeInspectingIndividualRows() {
        var invalid = text("INVALID", "");
        assertThat(CatalogTranslations.firstViolation(java.util.Collections.nCopies(51, invalid)))
                .contains(Violation.TOO_MANY_TRANSLATIONS);
        assertThat(Violation.TOO_MANY_TRANSLATIONS.detail()).isEqualTo("Too many translations.");
    }

    @ParameterizedTest
    @ValueSource(strings = {"en", "vi-VN", "de", "fr-FR", "eng"})
    void acceptsTheExistingLocaleSyntax(String locale) {
        assertThat(CatalogTranslations.firstViolation(List.of(text(locale, "Name")))).isEmpty();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "EN", "en-us", "e", "english", "en_US", "en-123", " vi-VN"})
    void rejectsMalformedLocalesBeforeTheSameRowsMissingName(String locale) {
        assertThat(CatalogTranslations.firstViolation(List.of(text(locale, ""))))
                .contains(Violation.INVALID_OR_DUPLICATE_LOCALE);
    }

    @Test
    void rejectsDuplicateLocalesBeforeTheDuplicateRowsInvalidContent() {
        var translations = List.of(text("vi-VN", "Name"), text("vi-VN", ""));
        assertThat(CatalogTranslations.firstViolation(translations))
                .contains(Violation.INVALID_OR_DUPLICATE_LOCALE);
        assertThat(Violation.INVALID_OR_DUPLICATE_LOCALE.detail())
                .isEqualTo("Invalid or duplicate translation locale.");
    }

    @Test
    void retainsRowOrderInsteadOfValidatingEveryLocaleBeforeContent() {
        var translations = List.of(text("vi-VN", ""), text("INVALID", "Name"));
        assertThat(CatalogTranslations.firstViolation(translations)).contains(Violation.INVALID_LOCALIZED_CONTENT);
    }

    @Test
    void acceptsTextAtEachExistingMaximumAndNullableOptionalFields() {
        var maximum = new Translation("vi-VN", "n".repeat(255), "s".repeat(2000), "d".repeat(32768), null, null);
        assertThat(CatalogTranslations.firstViolation(List.of(maximum))).isEmpty();
        assertThat(CatalogTranslations.firstViolation(List.of(text("en", "Name")))).isEmpty();
    }

    @ParameterizedTest
    @MethodSource("invalidContent")
    void rejectsMissingNamesAndTextBeyondTheExistingBounds(Translation translation) {
        assertThat(CatalogTranslations.firstViolation(List.of(translation)))
                .contains(Violation.INVALID_LOCALIZED_CONTENT);
        assertThat(Violation.INVALID_LOCALIZED_CONTENT.detail()).isEqualTo("Invalid localized content.");
    }

    static Stream<Translation> invalidContent() {
        return Stream.of(
                text("vi-VN", null),
                text("vi-VN", ""),
                text("vi-VN", " \t\n"),
                text("vi-VN", "n".repeat(256)),
                new Translation("vi-VN", "Name", "s".repeat(2001), null, null, null),
                new Translation("vi-VN", "Name", null, "d".repeat(32769), null, null));
    }

    private static Translation text(String locale, String name) {
        return new Translation(locale, name, null, null, null, null);
    }
}
