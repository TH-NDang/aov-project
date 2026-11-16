package com.wikiaov.hero.internal.web.request;

import com.wikiaov.hero.internal.domain.HeroContent.*;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;

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
