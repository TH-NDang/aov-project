package com.wikiaov.community.community.internal.translation.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class GlossaryTest {
    private static Glossary.Term term(String key, String kind, String vi, List<String> viAliases, String en,
            List<String> enAliases) {
        return new Glossary.Term(key, kind, Map.of("vi-VN", new Glossary.Names(vi, viAliases), "en-US",
                new Glossary.Names(en, enAliases)));
    }

    private final Glossary glossary = Glossary.of(List.of(
            term("spell:1", "spell", "Trừng trị", List.of(), "Punish", List.of()),
            term("term:caesar", "term", "Caesar", List.of("Tà Thần"), "Dark Slayer", List.of("DS")),
            term("term:duong-caesar", "term", "đường Caesar", List.of("đường Tà Thần"), "Dark Slayer Lane",
                    List.of()),
            term("term:kim-cuong", "term", "Kim Cương", List.of(), "Diamond", List.of()),
            term("term:ba-dao", "term", "bá đạo", List.of("imba"), "busted", List.of("OP")),
            term("item:orb", "item", "Quả cầu băng sương", List.of(), "Arctic Orb", List.of()),
            term("enchantment:orb", "enchantment", "Quả cầu băng sương", List.of(), "Evanescence", List.of()),
            term("term:ngoc", "term", "Ngọc", List.of("bảng ngọc"), "Arcana", List.of())), Set.of("Laville"));

    @Test
    void onlyTheNamesAPostUsesBecomeLines() {
        var lines = glossary.lines("Laville giờ bá đạo, nhớ mang Trừng trị", "en-US", false);

        assertThat(lines).extracting(Glossary.Line::source).containsExactly("bá đạo", "Trừng trị");
        assertThat(lines).extracting(Glossary.Line::target).containsExactly("busted", "Punish");
        assertThat(lines).allMatch(Glossary.Line::strict);
    }

    @Test
    void theLongerNameWinsWhereTwoOverlap() {
        var lines = glossary.lines("Ra đường Caesar sớm để giành Caesar", "en-US", false);

        assertThat(lines).extracting(Glossary.Line::target).containsExactly("Dark Slayer Lane", "Dark Slayer");
    }

    @Test
    void wordsInsideReferenceTagsAreLeftToTheTag() {
        var lines = glossary.lines("Dùng <ref=spell:1>Trừng trị</ref> thật nhanh", "en-US", false);

        assertThat(lines).isEmpty();
    }

    @Test
    void aCapitalisedRankDoesNotCatchTheEverydayWord() {
        assertThat(glossary.lines("Lên rank Kim Cương rồi", "en-US", false)).extracting(Glossary.Line::target)
                .containsExactly("Diamond");
        assertThat(glossary.lines("nhẫn kim cương đẹp quá", "en-US", false)).isEmpty();
    }

    @Test
    void wholeWordsOnlyInLatinLetters() {
        assertThat(glossary.lines("imbalance, not imba", "en-US", false)).extracting(Glossary.Line::target)
                .containsExactly("busted");
        assertThat(glossary.lines("Ngọc gì cho Laville?", "en-US", false)).extracting(Glossary.Line::target)
                .containsExactly("Arcana");
    }

    @Test
    void aNameWithTwoMeaningsIsNotChecked() {
        var lines = glossary.lines("Quả cầu băng sương mạnh quá", "en-US", false);

        assertThat(lines).hasSize(1);
        assertThat(lines.getFirst().strict()).isFalse();
    }

    @Test
    void englishPostsMatchEnglishNamesForAVietnameseReader() {
        var lines = glossary.lines("DS is up, bring Punish", "vi-VN", false);

        assertThat(lines).extracting(Glossary.Line::target).containsExactlyInAnyOrder("Caesar", "Trừng trị");
    }

    @Test
    void aPostWithImagesAlsoGetsTheTermsAnImageMayShow() {
        var lines = glossary.lines("Xem ảnh", "en-US", true);

        assertThat(lines).extracting(Glossary.Line::target).contains("Arcana", "Diamond", "Dark Slayer");
        assertThat(lines).noneMatch(Glossary.Line::strict);
        assertThat(lines).extracting(Glossary.Line::target).doesNotContain("Punish", "Arctic Orb");
    }

    @Test
    void decomposedVietnameseStillMatches() {
        String decomposed = java.text.Normalizer.normalize("Nhớ mang Trừng trị", java.text.Normalizer.Form.NFD);

        assertThat(glossary.lines(decomposed, "en-US", false)).extracting(Glossary.Line::target)
                .containsExactly("Punish");
    }
}
