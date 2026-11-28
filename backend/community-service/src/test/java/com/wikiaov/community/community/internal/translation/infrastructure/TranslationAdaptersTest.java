package com.wikiaov.community.community.internal.translation.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.community.community.internal.translation.application.port.PostTranslator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TranslationAdaptersTest {
    @Test
    @SuppressWarnings("unchecked")
    void theSchemaLocksTheTargetLanguageAndClosesEveryObject() {
        var schema = ClaudePostTranslator.schemaMap("en-US");
        var properties = (Map<String, Object>) schema.get("properties");
        var images = (Map<String, Object>) ((Map<String, Object>) properties.get("images")).get("items");

        assertThat(schema).containsEntry("type", "object").containsEntry("additionalProperties", false);
        assertThat(properties.get("targetLanguage")).isEqualTo(Map.of("type", "string", "enum", List.of("en-US")));
        assertThat(images).containsEntry("additionalProperties", false);
        assertThat((List<String>) images.get("required")).containsExactly("index", "hasText", "language",
                "translatedText");
        assertThat(ClaudePostTranslator.schema("en-US")._additionalProperties()).containsKeys("type", "properties");
    }

    @Test
    void anAnswerIsReadInTheSchemaShape() {
        var post = ClaudePostTranslator.parse("""
                {"sourceLanguage":"vi-VN","targetLanguage":"en-US","title":null,"body":"Hello",
                 "images":[{"index":1,"hasText":true,"language":"vi-VN","translatedText":"A shop screen"}]}
                """, "en-US");

        assertThat(post.body()).isEqualTo("Hello");
        assertThat(post.images()).singleElement().satisfies(image -> {
            assertThat(image.index()).isZero();
            assertThat(image.text()).isEqualTo("A shop screen");
        });
    }

    @Test
    void anAnswerInAnotherTargetOrNotJsonIsRefused() {
        assertThatThrownBy(() -> ClaudePostTranslator.parse("""
                {"sourceLanguage":"vi-VN","targetLanguage":"vi-VN","title":null,"body":"Xin chào","images":[]}
                """, "en-US")).isInstanceOf(PostTranslator.Failed.class);
        assertThatThrownBy(() -> ClaudePostTranslator.parse("Hello", "en-US"))
                .isInstanceOf(PostTranslator.Failed.class);
    }

    @Test
    void imagesComeOnlyFromTheSiteHostsOverHttps() {
        var hosts = List.of("img.athahub.com", "localhost");

        assertThat(PostImageClient.allowed("https://img.athahub.com/assets/a/b.webp", hosts)).isNotNull();
        assertThat(PostImageClient.allowed("http://img.athahub.com/assets/a/b.webp", hosts)).isNull();
        assertThat(PostImageClient.allowed("https://evil.example/a.png", hosts)).isNull();
        assertThat(PostImageClient.allowed("https://user@img.athahub.com/a.png", hosts)).isNull();
        assertThat(PostImageClient.allowed("http://localhost:8080/media/a.png", hosts)).isNotNull();
        assertThat(PostImageClient.allowed("not a url", hosts)).isNull();
    }

    @Test
    void theImageTypeIsReadFromItsFirstBytes() {
        assertThat(PostImageClient.mediaType(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0})).isEqualTo(
                "image/jpeg");
        assertThat(PostImageClient.mediaType(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0})).isEqualTo("image/png");
        assertThat(PostImageClient.mediaType("RIFF0000WEBPVP8 ".getBytes())).isEqualTo("image/webp");
        assertThat(PostImageClient.mediaType("<svg>".getBytes())).isNull();
    }

    @Test
    void theGlossaryJoinsTheNamesOfEveryLanguageAndKeepsHeroNames() {
        var vietnamese = List.<Map<String, Object>>of(
                Map.of("id", "1", "kind", "spell", "translations",
                        List.of(Map.of("locale", "vi-VN", "name", "Trừng trị", "aliases", List.of()))),
                Map.of("id", "2", "kind", "hero", "translations",
                        List.of(Map.of("locale", "vi-VN", "name", "Laville", "aliases", List.of()))));
        var english = List.<Map<String, Object>>of(Map.of("id", "1", "kind", "spell", "translations",
                List.of(Map.of("locale", "en-US", "name", "Punish", "aliases", List.of()))));

        var glossary = WikiGlossaryClient.build(List.of(vietnamese, english));

        assertThat(glossary.size()).isEqualTo(1);
        assertThat(glossary.keptNames()).containsExactly("Laville");
        assertThat(glossary.lines("Mang Trừng trị", "en-US", false)).singleElement()
                .satisfies(line -> assertThat(line.target()).isEqualTo("Punish"));
    }
}
