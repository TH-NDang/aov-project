package com.wikiaov.hero.internal.authoring.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.SkillKind;
import com.wikiaov.hero.internal.domain.HeroContent.SkillTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RevisionState;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HeroPublicationChecksTest {
    private final HeroSections sections = mock(HeroSections.class);
    private final HeroPublicationChecks checks = new HeroPublicationChecks(sections, mock(HeroValidation.class),
            mock(GameplayContexts.class), mock(HeroForms.class), mock(HeroRevisionContexts.class));
    private final Map<HeroSection, UUID> sectionIds = new EnumMap<>(HeroSection.class);

    @BeforeEach
    void completeDraft() {
        for (var section : HeroSection.values()) {
            sectionIds.put(section, UUID.randomUUID());
        }
        content(HeroSection.PROFILE, profile("vi-VN"));
        content(HeroSection.SKILLS, skills("vi-VN"));
        content(HeroSection.MEDIA_BINDINGS, bindings(MediaRole.HEAD, MediaRole.PORTRAIT, MediaRole.SPLASH));
    }

    @Test
    void aDraftWithEverySectionTranslatedAndPicturedCanBePublished() {
        assertThatCode(() -> checks.check(draft())).doesNotThrowAnyException();
    }

    @Test
    void aDraftWithoutEverySectionCannotBePublished() {
        sectionIds.remove(HeroSection.SKINS);

        assertThatThrownBy(() -> checks.check(draft())).isInstanceOf(ApiException.class)
                .hasMessage("All hero sections are required.");
    }

    @Test
    void aHeroIsPublishedWithItsHeadPortraitAndSplash() {
        content(HeroSection.MEDIA_BINDINGS, bindings(MediaRole.HEAD, MediaRole.PORTRAIT));

        assertThatThrownBy(() -> checks.check(draft())).isInstanceOf(ApiException.class)
                .hasMessage("HEAD, PORTRAIT and SPLASH bindings are required for publication.");
    }

    @Test
    void everySkillIsTranslatedIntoEveryLocaleOfTheProfile() {
        content(HeroSection.PROFILE, profile("vi-VN", "en-US"));

        assertThatThrownBy(() -> checks.check(draft())).isInstanceOf(ApiException.class)
                .hasMessage("Every skill needs translations for all profile locales.");
    }

    private void content(HeroSection section, Object content) {
        when(sections.content(section, sectionIds.get(section))).thenReturn(content);
    }

    private HeroRevisionView draft() {
        return new HeroRevisionView(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), 1, RevisionState.DRAFT, 1,
                null, null, Cause.DATA_BASELINE, null, null, Map.copyOf(sectionIds));
    }

    private static Profile profile(String... locales) {
        return new Profile(List.of(locales).stream()
                .map(locale -> new ProfileTranslation(locale, "Airi", null, null, null)).toList(),
                Set.of(Role.ASSASSIN), List.of());
    }

    private static Skills skills(String locale) {
        var translation = new SkillTranslation(locale, "Strike", "Deals damage.");
        return new Skills(List.of(new Skill("strike", SkillKind.ACTIVE, null, 1, null, List.of(translation),
                List.of())), List.of());
    }

    private static Bindings bindings(MediaRole... roles) {
        Map<MediaRole, UUID> bindings = new EnumMap<>(MediaRole.class);
        for (var role : roles) {
            bindings.put(role, UUID.randomUUID());
        }
        return new Bindings(bindings, List.of());
    }
}
