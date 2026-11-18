package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

class CatalogLocalesTest {
    @Test
    void fallbackOrderTriesTheRequestedLocaleThenEnglishThenVietnamese() {
        assertThat(CatalogLocales.fallbackOrder("th-TH")).containsExactly("th-TH", "en-US", "vi-VN");
    }

    @Test
    void fallbackOrderListsARequestedEnglishOrVietnameseOnce() {
        assertThat(CatalogLocales.fallbackOrder("en-US")).containsExactly("en-US", "vi-VN");
        assertThat(CatalogLocales.fallbackOrder("vi-VN")).containsExactly("vi-VN", "en-US");
    }

    @Test
    void fallbackOrderWithoutARequestedLocaleStartsWithEnglish() {
        assertThat(CatalogLocales.fallbackOrder(null)).containsExactly("en-US", "vi-VN");
    }

    @Test
    void pickReturnsTheRequestedTranslationWhenItExists() {
        assertThat(pick(List.of("vi-VN", "en-US", "th-TH"), "th-TH")).isEqualTo("th-TH");
    }

    @Test
    void pickFallsBackToEnglishBeforeVietnamese() {
        assertThat(pick(List.of("vi-VN", "en-US", "th-TH"), "id-ID")).isEqualTo("en-US");
    }

    @Test
    void pickFallsBackToVietnameseWhenThereIsNoEnglish() {
        assertThat(pick(List.of("th-TH", "vi-VN"), "id-ID")).isEqualTo("vi-VN");
    }

    @Test
    void pickTakesTheFirstRemainingLocaleTagWhateverTheReadOrder() {
        assertThat(pick(List.of("zh-TW", "de-DE", "th-TH"), "id-ID")).isEqualTo("de-DE");
        assertThat(pick(List.of("th-TH", "zh-TW", "de-DE"), "id-ID")).isEqualTo("de-DE");
    }

    @Test
    void pickKeepsTheReadOrderBetweenRowsOfTheSameLocale() {
        record Row(
                String locale,
                String name
        ) {
        }

        var rows = List.of(new Row("th-TH", "newest"), new Row("en-US", "newer"), new Row("en-US", "older"));

        assertThat(CatalogLocales.pick(rows, "id-ID", Row::locale)).isEqualTo(rows.get(1));
    }

    @Test
    void pickPutsRowsWithoutALocaleLast() {
        record Row(
                String locale
        ) {
        }

        var rows = List.of(new Row(null), new Row("th-TH"));

        assertThat(CatalogLocales.pick(rows, "id-ID", Row::locale)).isEqualTo(rows.get(1));
    }

    @Test
    void pickReturnsNullWithoutTranslations() {
        assertThat(pick(List.of(), "vi-VN")).isNull();
    }

    @Test
    void preferenceSortsTranslationsBestFirst() {
        var sorted = List.of("de-DE", "vi-VN", "th-TH", "en-US").stream()
                .sorted(CatalogLocales.preference("th-TH", Function.identity())).toList();

        assertThat(sorted).containsExactly("th-TH", "en-US", "vi-VN", "de-DE");
    }

    private static String pick(List<String> locales, String requested) {
        return CatalogLocales.pick(locales, requested, Function.identity());
    }
}
