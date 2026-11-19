package com.wikiaov.hero.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.SkillKind;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Trait;
import com.wikiaov.hero.internal.domain.HeroContent.TraitCode;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class HeroEvaluationsTest {

    @Test
    void aSkillsUpdateKeepsTheTraitsAndDropsTheSkillsItRemoves() {
        var previous = new Skills(List.of(skill("skill-1"), skill("skill-2")), List.of(),
                List.of(new Trait(TraitCode.DASH, List.of("skill-1", "skill-2"), List.of())));
        var incoming = new Skills(List.of(skill("skill-1")), List.of(), List.of());

        var result = HeroEvaluations.retain(previous, incoming);

        assertThat(result.traits()).containsExactly(new Trait(TraitCode.DASH, List.of("skill-1"), List.of()));
        assertThat(result.skills()).isEqualTo(incoming.skills());
    }

    @Test
    void aProfileUpdateKeepsTheNotesOfLocalesThatRemain() {
        var previous = profile(new ProfileTranslation("vi-VN", "Airi", null, null, null).withNotes("Mạnh", null, null),
                new ProfileTranslation("en-US", "Airi", null, null, null).withNotes("Strong", null, null));
        var incoming = profile(new ProfileTranslation("vi-VN", "Airi mới", null, null, null));

        var result = HeroEvaluations.retain(previous, incoming);

        assertThat(result.translations()).singleElement().satisfies(text -> {
            assertThat(text.name()).isEqualTo("Airi mới");
            assertThat(text.strengths()).isEqualTo("Mạnh");
        });
    }

    private static Skill skill(String key) {
        return new Skill(key, SkillKind.ACTIVE, null, 1, null, List.of(), List.of());
    }

    private static Profile profile(ProfileTranslation... translations) {
        return new Profile(List.of(translations), Set.of(Role.MAGE), List.of());
    }
}
