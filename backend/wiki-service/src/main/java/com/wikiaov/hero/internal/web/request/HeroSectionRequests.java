package com.wikiaov.hero.internal.web.request;

import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.ImageOption;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Ratings;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Skin;
import com.wikiaov.hero.internal.domain.HeroContent.Skins;
import com.wikiaov.hero.internal.domain.HeroContent.Source;
import com.wikiaov.hero.internal.domain.HeroContent.Stat;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroContent.Trait;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class HeroSectionRequests {
    private HeroSectionRequests() {
    }

    public record ProfileRequest(
            @NotNull @Positive Long expectedDraftVersion,
            List<ProfileTranslation> translations,
            Set<Role> roles,
            Set<Position> positions,
            List<Source> sources,
            String changeNote
    ) {
        public Profile content() {
            return new Profile(translations, roles, positions, sources == null ? List.of() : sources);
        }
    }

    public record RatingsRequest(
            @NotNull @Positive Long expectedDraftVersion,
            String scaleCode,
            BigDecimal survivability,
            BigDecimal attackDamage,
            BigDecimal skillEffects,
            BigDecimal difficulty,
            Boolean derived,
            List<Source> sources,
            String changeNote
    ) {
        public Ratings content() {
            return new Ratings(scaleCode, survivability, attackDamage, skillEffects, difficulty,
                    Boolean.TRUE.equals(derived),
                    sources == null ? List.of() : sources);
        }
    }

    public record StatsRequest(
            @NotNull @Positive Long expectedDraftVersion,
            List<Stat> values,
            List<Source> sources,
            String changeNote
    ) {
        public Stats content() {
            return new Stats(values, sources == null ? List.of() : sources);
        }
    }

    /**
     * {@code traits} is accepted because clients send the skills section back as they read it, and it is ignored: the
     * draft keeps its traits, and only the traits endpoint changes them (ADR-029).
     */
    public record SkillsRequest(
            @NotNull @Positive Long expectedDraftVersion,
            List<Skill> skills,
            List<Source> sources,
            String changeNote,
            List<Trait> traits
    ) {
        public Skills content() {
            return new Skills(skills, sources == null ? List.of() : sources);
        }
    }

    public record SkinsRequest(
            @NotNull @Positive Long expectedDraftVersion,
            List<Skin> skins,
            List<Source> sources,
            String changeNote
    ) {
        public Skins content() {
            return new Skins(skins, sources == null ? List.of() : sources);
        }
    }

    public record BindingsRequest(
            @NotNull @Positive Long expectedDraftVersion,
            Map<MediaRole, UUID> bindings,
            List<Source> sources,
            String changeNote,
            Map<MediaRole, List<ImageOption>> images
    ) {
        public Bindings content() {
            return new Bindings(bindings, sources == null ? List.of() : sources, images);
        }
    }
}
