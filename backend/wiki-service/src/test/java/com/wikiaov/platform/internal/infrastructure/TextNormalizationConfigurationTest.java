package com.wikiaov.platform.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.text.Normalizer;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

class TextNormalizationConfigurationTest {
    private static final String NAME = "Thủy thủ hồ ly";

    private static final String DECOMPOSED = Normalizer.normalize(NAME, Normalizer.Form.NFD);

    private final JsonMapper json = JsonMapper.builder()
            .addModule(new TextNormalizationConfiguration().nfcTextModule()).build();

    record Skin(
            String skinKey,
            String name,
            List<String> aliases,
            Map<String, String> labels
    ) {
    }

    @Test
    void decomposedTextInRecordsListsAndMapsIsReadPrecomposed() {
        assertThat(DECOMPOSED).isNotEqualTo(NAME);
        String body = """
                {"skinKey": "liliana-thuy-thu-ho-ly-1", "name": "%1$s", "aliases": ["%1$s"],
                 "labels": {"vi-VN": "%1$s"}}
                """.formatted(DECOMPOSED);

        Skin skin = json.readValue(body, Skin.class);

        assertThat(skin.name()).isEqualTo(NAME);
        assertThat(skin.aliases()).containsExactly(NAME);
        assertThat(skin.labels()).containsEntry("vi-VN", NAME);
        assertThat(skin.skinKey()).isEqualTo("liliana-thuy-thu-ho-ly-1");
    }

    @Test
    void stringsInsideUntypedImportValuesArePrecomposed() {
        String body = """
                {"name": "%1$s", "skills": [{"title": "%1$s", "level": 2}], "missing": null}
                """.formatted(DECOMPOSED);

        Map<String, Object> values = json.readValue(body, new TypeReference<>() {
        });

        assertThat(values.get("name")).isEqualTo(NAME);
        assertThat(values.get("skills")).isEqualTo(List.of(Map.of("title", NAME, "level", 2)));
        assertThat(values).containsEntry("missing", null);
    }

    @Test
    void precomposedAndPlainTextIsReturnedUnchanged() {
        assertThat(TextNormalizationConfiguration.nfc(NAME)).isSameAs(NAME);
        assertThat(TextNormalizationConfiguration.nfc("armor-penetration")).isEqualTo("armor-penetration");
        assertThat(TextNormalizationConfiguration.nfc(null)).isNull();
        assertThat(json.readValue("\"\"", String.class)).isEmpty();
    }
}
