package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.ApiException;
import jakarta.validation.Validation;
import java.util.*;
import org.junit.jupiter.api.Test;

class HeroDraftValidationTest {
    @Test
    void incompleteDraftsRemainValidButPublicationReportsMissingFields() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validation = new HeroValidation(null, factory.getValidator(), null);
            var profile = new Profile(List.of(new ProfileTranslation("vi-VN", "Airi", null, null, null)),
                    Set.of(), List.of());
            validation.validate(HeroSection.PROFILE, profile);
            assertThatThrownBy(() -> validation.validatePublication(HeroSection.PROFILE, profile))
                    .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getErrors())
                            .anyMatch(error -> error.path().equals("PROFILE.roles")));
            var text = new SkillTranslation("vi-VN", "Skill", null);
            assertThat(text.description()).isEmpty();
            assertThat(factory.getValidator().validate(text)).isEmpty();
            assertThat(factory.getValidator().validate(text, Publication.class))
                    .anyMatch(v -> v.getPropertyPath().toString().equals("description"));
            assertThat(factory.getValidator().validate(new SkillTranslation("vi-VN", "Skill", "Complete"),
                    Publication.class)).isEmpty();
            assertThat(factory.getValidator().validate(new SkillTranslation("vi-VN", "", ""))).isNotEmpty();
        }
    }
}
