package com.wikiaov.community.community.internal.translation.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.community.internal.translation.domain.TranslatedPost.ImageText;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TranslationChecksTest {
    private static final Glossary.Line PUNISH = new Glossary.Line("spell:1", "Trừng trị", "Punish", List.of(), true);
    private static final Glossary.Line CARRY = new Glossary.Line("term:ganh", "gánh team", "carry", List.of(), true);

    private static TranslationChecks.Source source(String body, int images) {
        return new TranslationChecks.Source(null, body, images);
    }

    @Test
    void aFaithfulAnswerPasses() {
        var answer = new TranslatedPost("vi-VN", null,
                "<ref=hero:1>Laville</ref> is busted, remember to bring Punish, he carried us", List.of());

        assertThat(TranslationChecks.failures(source("<ref=hero:1>Laville</ref> bá quá, nhớ mang Trừng trị, "
                + "gánh team", 0), answer, "en-US", List.of(PUNISH, CARRY), Set.of())).isEmpty();
    }

    @Test
    void aLostOrChangedReferenceTagFails() {
        assertThat(TranslationChecks.missingRefs("<ref=hero:1>Laville</ref> and <ref=hero:1>Laville</ref>",
                "<ref=hero:1>Laville</ref> and <ref=hero:2>Laville</ref>")).isEqualTo(1);
        var answer = new TranslatedPost("vi-VN", null, "Laville is strong", List.of());

        assertThat(TranslationChecks.failures(source("<ref=hero:1>Laville</ref> mạnh", 0), answer, "en-US",
                List.of(), Set.of())).anyMatch(failure -> failure.contains("<ref=...>"));
    }

    @Test
    void vietnameseLeftInAnEnglishAnswerFails() {
        assertThat(TranslationChecks.wrongLanguage("Laville đang rất mạnh trong mùa này", "en-US", Set.of()))
                .isTrue();
        assertThat(TranslationChecks.wrongLanguage("Laville is strong this season", "en-US", Set.of())).isFalse();
    }

    @Test
    void keptNamesQuotesAndAcronymsDoNotCountAgainstTheLanguage() {
        assertThat(TranslationChecks.wrongLanguage("Team ĐTDV won with Tôn Ngộ Không at the \"Giải mùa đông\"",
                "en-US", Set.of("Tôn Ngộ Không"))).isFalse();
    }

    @Test
    void englishLeftInAVietnameseAnswerFails() {
        assertThat(TranslationChecks.wrongLanguage("The jungler should take the red buff before the fight starts",
                "vi-VN", Set.of())).isTrue();
        assertThat(TranslationChecks.wrongLanguage("Đi rừng bên mình farm không kịp, lại bị cướp bùa đỏ rồi.",
                "vi-VN", Set.of())).isFalse();
        assertThat(TranslationChecks.wrongLanguage("ป่าเรา", "vi-VN", Set.of())).isTrue();
    }

    @Test
    void aStrictTermMustBeUsedAndEnglishMayInflectIt() {
        assertThat(TranslationChecks.uses("He carried the game", CARRY, "en-US")).isTrue();
        assertThat(TranslationChecks.uses("Bring Retribution", PUNISH, "en-US")).isFalse();
        var answer = new TranslatedPost("vi-VN", null, "Bring Retribution", List.of());

        assertThat(TranslationChecks.failures(source("Mang Trừng trị", 0), answer, "en-US", List.of(PUNISH),
                Set.of())).containsExactly("Use the glossary term \"Punish\" for \"Trừng trị\".");
    }

    @Test
    void everyImageNeedsAnEntryAndATextWhenItHasWords() {
        var answer = new TranslatedPost("vi-VN", null, "Look", List.of(new ImageText(0, true, "vi-VN", null)));

        var failures = TranslationChecks.failures(source("Xem", 2), answer, "en-US", List.of(), Set.of());

        assertThat(failures).anyMatch(failure -> failure.contains("2 image(s)"));
        assertThat(failures).anyMatch(failure -> failure.startsWith("Image 1 has text"));
    }

    @Test
    void aMissingTitleFails() {
        var answer = new TranslatedPost("vi-VN", null, "Patch notes", List.of());

        assertThat(TranslationChecks.failures(new TranslationChecks.Source("Bản cập nhật", "Ghi chú", 0), answer,
                "en-US", List.of(), Set.of())).contains("Translate the title too.");
    }
}
