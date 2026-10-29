package com.wikiaov.terminology.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.terminology.internal.domain.ReferenceSettings.Translation;
import java.util.List;
import org.junit.jupiter.api.Test;

class HeroReferenceAliasesTest {
    @Test
    void supplementalAliasesPreserveCanonicalTextAndLocaleWithoutInventingTranslations() {
        var canonical = List.of(new Translation("vi-VN", "Florentino", List.of("Tay kiếm"), "Current description"),
                new Translation("en-US", "Florentino", List.of(), "Current English description"));
        var custom = List.of(new Translation("VI-vn", "Outdated name", List.of(" Flo ", "flo", "TAY KIẾM"),
                "Outdated description"),
                new Translation("th-TH", "Unpublished translation", List.of("Missing locale alias"), "Private text"));
        var result = HeroReferenceAliases.overlay(canonical, custom);

        assertThat(result).hasSize(2);
        assertThat(result.getFirst()).isEqualTo(new Translation("vi-VN", "Florentino",
                List.of("Tay kiếm", "Flo"), "Current description"));
        assertThat(result.getLast()).isEqualTo(canonical.getLast());
    }

    @Test
    void aliasUnionPreservesOrderAndUnicodeWhileKeepingDistinctAccents() {
        assertThat(HeroReferenceAliases.merge(List.of("Florentino", "Lữ Bố"),
                List.of("florentino", " Lữ Bố ", " Lu Bo ", "")))
                .containsExactly("Florentino", "Lữ Bố", "Lu Bo");
    }
}
