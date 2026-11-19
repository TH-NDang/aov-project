package com.wikiaov.hero.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.SkillKind;
import com.wikiaov.hero.internal.domain.HeroContent.SkillTranslation;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class HeroSkillSummariesTest {
    @Test
    void incomingTextWithoutASummaryTakesTheOneItsSkillHadInTheSameLocale() {
        var previous = List.of(
                skill("skill-1", text("vi-VN", "Mô tả cũ", "Tóm tắt tiếng Việt"), text("en-US", "Old", "Summary")),
                skill("skill-2", text("vi-VN", "Mô tả hai", "Tóm tắt chiêu hai")));
        var incoming = List.of(
                skill("skill-1", text("vi-VN", "Mô tả mới", null), text("en-US", "New", "A new summary"),
                        text("th-TH", "ใหม่", null)),
                skill("skill-3", text("vi-VN", "Chiêu mới", null)));

        var result = HeroSkillSummaries.retain(previous, incoming);

        assertThat(result.getFirst().translations()).containsExactly(
                text("vi-VN", "Mô tả mới", "Tóm tắt tiếng Việt"), text("en-US", "New", "A new summary"),
                text("th-TH", "ใหม่", null));
        assertThat(result.getLast()).isEqualTo(incoming.getLast());
    }

    @Test
    void skillsWithoutEarlierSummariesAndIncompleteEntriesPassThroughUnchanged() {
        var previous = List.of(skill("skill-1", text("vi-VN", "Mô tả", null)),
                skill("skill-2", text("vi-VN", "Mô tả", "Tóm tắt")));
        var unsummarized = skill("skill-1", text("vi-VN", "Mô tả mới", null));
        var withoutTranslations = new Skill("skill-2", SkillKind.ACTIVE, null, 1, null, null, List.of());
        var withMissingText = new Skill("skill-2", SkillKind.ACTIVE, null, 2, null,
                Arrays.asList((SkillTranslation) null), List.of());

        var result = HeroSkillSummaries.retain(previous,
                Arrays.asList(unsummarized, withoutTranslations, withMissingText, null));

        assertThat(result).containsExactly(unsummarized, withoutTranslations, withMissingText, null);
    }

    @Test
    void aSummaryOutlivesItsDescriptionOnlyWhenTheTextChangedUnderTheSameSummary() {
        var before = text("vi-VN", "Mô tả cũ", "Tóm tắt");

        assertThat(HeroSkillSummaries.outlivedDescription(before, text("vi-VN", "Mô tả mới", "Tóm tắt"))).isTrue();
        assertThat(HeroSkillSummaries.outlivedDescription(before, text("vi-VN", "Mô tả cũ", "Tóm tắt"))).isFalse();
        assertThat(HeroSkillSummaries.outlivedDescription(before, text("vi-VN", "Mô tả mới", "Tóm tắt mới")))
                .isFalse();
        assertThat(HeroSkillSummaries.outlivedDescription(before, text("vi-VN", "Mô tả mới", null))).isFalse();
        assertThat(HeroSkillSummaries.outlivedDescription(null, text("vi-VN", "Mô tả mới", "Tóm tắt"))).isFalse();
    }

    private static Skill skill(String key, SkillTranslation... translations) {
        return new Skill(key, SkillKind.ACTIVE, null, 0, null, List.of(translations), List.of());
    }

    private static SkillTranslation text(String locale, String description, String summary) {
        return new SkillTranslation(locale, "Chiêu", description, summary);
    }
}
