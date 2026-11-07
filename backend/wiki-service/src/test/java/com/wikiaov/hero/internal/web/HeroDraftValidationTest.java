package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.ApiException;
import jakarta.validation.Validation;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class HeroDraftValidationTest {
    @Test
    void incompleteDraftsRemainValidButPublicationReportsMissingFields() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validation = new HeroValidation(null, factory.getValidator(), null);
            var stats = new Stats(List.of(), List.of());
            validation.validate(HeroSection.COMBAT_STATS, stats);
            assertThatThrownBy(() -> validation.validatePublication(HeroSection.COMBAT_STATS, stats))
                    .isInstanceOf(ApiException.class);
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

    @Test
    void aStatPercentNeedsAStatThatShowsOneAndTheNumberBesideIt() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validation = new HeroValidation(null, factory.getValidator(), null);
            var hundred = BigDecimal.valueOf(100);

            for (var key : List.of("ARMOR", "MAGIC_DEFENSE", "ARMOR_PIERCE", "MAGIC_PIERCE"))
                assertThatCode(() -> validation.validate(HeroSection.COMBAT_STATS, stats(new Stat(key,
                        BigDecimal.valueOf(150), BigDecimal.valueOf(20), null, "POINT")))).doesNotThrowAnyException();
            for (var percent : List.of(BigDecimal.ZERO, hundred))
                assertThatCode(() -> validation.validate(HeroSection.COMBAT_STATS,
                        stats(new Stat("ARMOR", BigDecimal.TEN, percent, null, "POINT"))))
                        .doesNotThrowAnyException();

            var refused = List.of(new Stat("HP", BigDecimal.TEN, BigDecimal.ONE, null, "POINT"),
                    new Stat("ARMOR", null, BigDecimal.ONE, BigDecimal.ONE, "POINT"),
                    new Stat("ARMOR", BigDecimal.TEN, BigDecimal.valueOf(-1), null, "POINT"),
                    new Stat("ARMOR", BigDecimal.TEN, BigDecimal.valueOf(101), null, "POINT"));
            for (var stat : refused)
                assertThatThrownBy(() -> validation.validate(HeroSection.COMBAT_STATS, stats(stat)))
                        .isInstanceOf(ApiException.class);
        }
    }

    private static Stats stats(Stat stat) {
        return new Stats(List.of(stat), List.of());
    }
}
