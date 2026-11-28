package com.wikiaov.community.community.internal.translation.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class TranslationPromptTest {
    @Test
    void namesTheTargetLanguageAndListsOnlyTheGivenLines() {
        String prompt = TranslationPrompt.system("en-US",
                List.of(new Glossary.Line("spell:1", "Trừng trị", "Punish", List.of(), true)), 0);

        assertThat(prompt).contains("in English only").contains("Trừng trị -> Punish").contains("13,888")
                .doesNotContain("%1$s").doesNotContain("shop screens");
    }

    @Test
    void aPostWithImagesGetsTheScreenHints() {
        assertThat(TranslationPrompt.system("vi-VN", List.of(), 2)).contains("shop screens").contains("(none)")
                .contains("13.888");
    }

    @Test
    void thePostTextSaysHowManyImagesCameFirst() {
        assertThat(TranslationPrompt.post(null, "Xin chào", 2)).isEqualTo(
                "Title: (none)\nImages: 2 (attached above, in order)\nBody:\nXin chào");
    }
}
