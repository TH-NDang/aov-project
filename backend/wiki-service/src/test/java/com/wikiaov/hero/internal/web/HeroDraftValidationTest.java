package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Publication;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.SkillKind;
import com.wikiaov.hero.internal.domain.HeroContent.SkillStateIcon;
import com.wikiaov.hero.internal.domain.HeroContent.SkillTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Stat;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import jakarta.validation.Validation;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

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

    @Test
    void skillStateIconsNameEachStateOnceWithAPictureOfTheirOwn() {
        var icon = UUID.randomUUID();
        var sea = UUID.randomUUID();
        var storm = UUID.randomUUID();
        var portrait = UUID.randomUUID();
        var media = new MediaAssets() {
            @Override
            public Optional<MediaAssetReference> find(UUID assetId) {
                var type = assetId.equals(portrait)
                        ? MediaSemanticType.HERO_PORTRAIT
                        : MediaSemanticType.HERO_SKILL_ICON;
                return Optional.of(new MediaAssetReference(assetId, type, MediaAssetState.ACTIVE,
                        new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/webp", 64, 64,
                                "https://img.example/" + assetId + ".webp")));
            }

            @Override
            public Map<UUID, MediaAssetReference> findAll(Collection<UUID> assetIds) {
                return Map.of();
            }
        };
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validation = new HeroValidation(media, factory.getValidator(), null);

            assertThatCode(() -> validation.validate(HeroSection.SKILLS,
                    skills(icon, new SkillStateIcon(sea, "Hải quái"), new SkillStateIcon(storm, "Bão tố"))))
                    .doesNotThrowAnyException();
            assertThat(new Skill("skill-1-1", SkillKind.ACTIVE, null, 0, icon,
                    List.of(new SkillTranslation("vi-VN", "Chiêu", "Mô tả")), List.of(), null).stateIcons())
                    .as("A skill saved before state icons reads as having none").isEmpty();

            var refused = List.of(
                    skills(icon, new SkillStateIcon(sea, "Hải quái"), new SkillStateIcon(storm, " hải QUÁI ")),
                    skills(icon, new SkillStateIcon(sea, "Hải quái"), new SkillStateIcon(sea, "Bão tố")),
                    skills(icon, new SkillStateIcon(icon, "Hải quái")),
                    skills(icon, new SkillStateIcon(sea, "  ")),
                    skills(icon, new SkillStateIcon(portrait, "Hải quái")));
            for (var value : refused)
                assertThatThrownBy(() -> validation.validate(HeroSection.SKILLS, value))
                        .isInstanceOf(ApiException.class);

            var tooMany = new ArrayList<SkillStateIcon>();
            for (int n = 0; n < 11; n++)
                tooMany.add(new SkillStateIcon(UUID.randomUUID(), "Trạng thái " + n));
            assertThat(factory.getValidator()
                    .validate(skills(icon, tooMany.toArray(SkillStateIcon[]::new)).skills().getFirst()))
                    .anyMatch(v -> v.getPropertyPath().toString().equals("stateIcons"));
        }
    }

    @Test
    void aSkillSummaryIsOneShortParagraphAndABlankOneIsNoSummary() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validation = new HeroValidation(null, factory.getValidator(), null);

            assertThat(new SkillTranslation("vi-VN", "Chiêu", "Mô tả", "  Lướt tới.  ").summary())
                    .isEqualTo("Lướt tới.");
            assertThat(new SkillTranslation("vi-VN", "Chiêu", "Mô tả", " \n ").summary()).isNull();
            assertThat(new SkillTranslation("vi-VN", "Chiêu", "Mô tả").summary()).isNull();
            assertThat(new JsonMapper().readValue("""
                    {"locale":"vi-VN","name":"Chiêu","description":"Mô tả"}
                    """, SkillTranslation.class))
                    .as("Content saved before summaries existed reads as having none")
                    .isEqualTo(new SkillTranslation("vi-VN", "Chiêu", "Mô tả", null));

            assertThatCode(() -> validation.validatePublication(HeroSection.SKILLS, summarized(null)))
                    .as("A summary is optional, also for publication").doesNotThrowAnyException();
            assertThatCode(() -> validation.validate(HeroSection.SKILLS, summarized("x".repeat(300))))
                    .doesNotThrowAnyException();
            for (var refused : List.of("x".repeat(301), "Lướt tới.\nHất tung.", "Lướt tới.\r\nHất tung."))
                assertThatThrownBy(() -> validation.validate(HeroSection.SKILLS, summarized(refused)))
                        .isInstanceOf(ApiException.class);
        }
    }

    private static Skills summarized(String summary) {
        return new Skills(List.of(new Skill("skill-1-1", SkillKind.ACTIVE, null, 0, null,
                List.of(new SkillTranslation("vi-VN", "Chiêu", "Mô tả", summary)), List.of())), List.of());
    }

    private static Skills skills(UUID icon, SkillStateIcon... states) {
        return new Skills(List.of(new Skill("skill-1-1", SkillKind.ACTIVE, null, 0, icon,
                List.of(new SkillTranslation("vi-VN", "Chiêu", "Mô tả")), List.of(), List.of(states))), List.of());
    }

    private static Stats stats(Stat stat) {
        return new Stats(List.of(stat), List.of());
    }
}
