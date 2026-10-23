package com.wikiaov.terminology.internal.domain;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.terminology.internal.domain.ReferenceSettings.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class ReferenceSettingsTest {
    private Entry term(String icon, List<Translation> translations) {
        return new Entry("slow", "term", translations, icon, true, null, null);
    }

    private final Translation text = new Translation("vi-VN", "Slow", List.of("Chậm"), "Description");

    @Test
    void rejectsDuplicateKeysLocalesAndUnsafeUrls() {
        assertThatThrownBy(() -> new ReferenceSettings(1, true, "vi-VN",
                List.of(term(null, List.of(text)), term(null, List.of(text)))).validate())
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(
                () -> new ReferenceSettings(1, true, "vi-VN", List.of(term(null, List.of(text, text)))).validate())
                .isInstanceOf(IllegalArgumentException.class);
        for (String url : List.of("javascript:alert(1)", "//evil.test/a.png", "/%252fexample.test/x", "/a%0Ab"))
            assertThatThrownBy(
                    () -> new ReferenceSettings(1, true, "vi-VN", List.of(term(url, List.of(text)))).validate())
                    .isInstanceOf(IllegalArgumentException.class);
        new ReferenceSettings(1, true, "vi-VN", List.of(term("https://example.test/icon.png", List.of(text))))
                .validate();
    }
}
