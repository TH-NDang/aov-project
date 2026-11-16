package com.wikiaov.hero.internal.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

public final class HeroContent {
    public interface Publication {
    }

    private HeroContent() {
    }

    public enum Cause {
        DATA_BASELINE,
        GAME_PATCH,
        CONTENT_CORRECTION,
        TRANSLATION,
        IMPORT_CORRECTION,
        VISUAL_UPDATE,
        OTHER
    }

    public enum Role {
        TANK,
        WARRIOR,
        ASSASSIN,
        MAGE,
        MARKSMAN,
        SUPPORT
    }

    public enum MediaRole {
        HEAD,
        PORTRAIT,
        SPLASH
    }

    public enum SkillKind {
        PASSIVE,
        ACTIVE,
        OTHER
    }

    public record Source(
            @NotBlank @Size(max = 255) String label,
            @Size(max = 2000) String sourceUrl,
            Instant observedAt,
            @NotNull Verification verificationState,
            @Size(max = 4000) String note
    ) {
    }

    public enum Verification {
        UNVERIFIED,
        VERIFIED
    }

    /**
     * Strengths, weaknesses and counter tips are editor-written notes (ADR-029). Only the notes endpoint writes them;
     * a profile update keeps the notes the draft already has.
     */
    public record ProfileTranslation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 200) String title,
            @Size(max = 20000) String summary,
            @Size(max = 100000) String lore,
            @Size(max = 4000) String strengths,
            @Size(max = 4000) String weaknesses,
            @Size(max = 4000) String counterTips
    ) {
        public ProfileTranslation(String locale, String name, String title, String summary, String lore) {
            this(locale, name, title, summary, lore, null, null, null);
        }

        public ProfileTranslation withNotes(String strengths, String weaknesses, String counterTips) {
            return new ProfileTranslation(locale, name, title, summary, lore, strengths, weaknesses, counterTips);
        }
    }

    public enum Position {
        TOP,
        MID,
        JUNGLE,
        DRAGON,
        SUPPORT
    }

    public record Profile(
            @NotEmpty @Size(max = 30) List<@Valid ProfileTranslation> translations,
            @NotNull @NotEmpty(groups = Publication.class) Set<@NotNull Role> roles,
            @NotNull Set<@NotNull Position> positions,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
        public Profile {
            positions = positions == null ? Set.of() : positions;
        }

        public Profile(List<ProfileTranslation> translations, Set<Role> roles, List<Source> sources) {
            this(translations, roles, Set.of(), sources);
        }
    }

    public record Ratings(
            @NotBlank @Size(max = 64) String scaleCode,
            @NotNull BigDecimal survivability,
            @NotNull BigDecimal attackDamage,
            @NotNull BigDecimal skillEffects,
            @NotNull BigDecimal difficulty,
            boolean derived,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
    }

    public record Stat(
            @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{0,63}") String statKey,
            BigDecimal baseValue,
            BigDecimal percentValue,
            BigDecimal growthPerLevel,
            @NotBlank @Size(max = 32) String unit
    ) {
    }

    public record Stats(
            @NotNull @NotEmpty(groups = Publication.class) @Size(max = 100) List<@Valid Stat> values,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
    }

    public record SkillTranslation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 120) String name,
            @NotNull @NotBlank(groups = Publication.class) @Size(max = 100000) String description
    ) {
        public SkillTranslation {
            description = description == null ? "" : description;
        }
    }

    public record Effect(
            @NotBlank @Size(max = 32) String effectType,
            @NotNull Map<String, Object> metadata
    ) {
    }

    public record Skill(
            @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") @Size(max = 64) String skillKey,
            @NotNull SkillKind kind,
            @Size(max = 64) String formKey,
            @PositiveOrZero int displayOrder,
            UUID iconAssetId,
            @NotEmpty @Size(max = 30) List<@Valid SkillTranslation> translations,
            @NotNull @Size(max = 100) List<@Valid Effect> effects,
            @Size(max = 10) List<@NotNull @Valid SkillStateIcon> stateIcons
    ) {
        public Skill {
            stateIcons = stateIcons == null ? List.of() : stateIcons;
        }

        public Skill(String skillKey, SkillKind kind, String formKey, int displayOrder, UUID iconAssetId,
                List<SkillTranslation> translations, List<Effect> effects) {
            this(skillKey, kind, formKey, displayOrder, iconAssetId, translations, effects, List.of());
        }
    }

    /** The icon a skill shows in a named state, such as a form, while its name, text and numbers stay the same. */
    public record SkillStateIcon(
            @NotNull UUID assetId,
            @NotBlank @Size(max = 64) String label
    ) {
    }

    /**
     * Traits are yes/no facts read from the kit and confirmed by an editor (ADR-029). {@code null} traits mean "not
     * sent": a skills update keeps the traits the draft already has, and only the traits endpoint replaces them.
     */
    public record Skills(
            @NotEmpty @Size(max = 100) List<@Valid Skill> skills,
            @NotNull @Size(max = 30) List<@Valid Source> sources,
            @Size(max = 32) List<@NotNull @Valid Trait> traits
    ) {
        public Skills(List<Skill> skills, List<Source> sources) {
            this(skills, sources, null);
        }
    }

    /** The fixed list of traits a hero page can show, grouped as the Wiki shows them. */
    public enum TraitCode {
        TRUE_DAMAGE,
        PERCENT_HP_DAMAGE,
        MISSING_HP_DAMAGE,
        ARMOR_SHRED,
        DASH,
        WALL_CROSS,
        UNTARGETABLE,
        STEALTH,
        GLOBAL,
        CC_IMMUNE,
        CLEANSE,
        SELF_HEAL,
        SHIELD,
        DAMAGE_REDUCTION,
        REVIVE,
        HARD_CC,
        DISPLACE,
        SILENCE,
        ALLY_HEAL,
        ALLY_SHIELD,
        ALLY_BUFF,
        VISION
    }

    public record Trait(
            @NotNull TraitCode code,
            @NotNull @Size(max = 20) List<@NotBlank @Size(max = 64) String> skillKeys,
            @NotNull @Size(max = 30) List<@Valid TraitTranslation> translations
    ) {
    }

    public record TraitTranslation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 300) String detail
    ) {
    }

    public record SkinTranslation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 20000) String description,
            @Size(max = 4000) String acquisitionNote
    ) {
    }

    public record Skin(
            @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") @Size(max = 64) String skinKey,
            @PositiveOrZero int displayOrder,
            UUID artAssetId,
            @Size(max = 64) String rarityCode,
            @NotEmpty @Size(max = 30) List<@Valid SkinTranslation> translations,
            UUID headAssetId,
            UUID portraitAssetId,
            Map<@NotNull MediaRole, @NotNull @Size(max = 200) List<@NotNull @Valid ImageOption>> images
    ) {
        public Skin {
            images = images == null ? Map.of() : images;
        }

        public Skin(String skinKey, int displayOrder, UUID artAssetId, String rarityCode,
                List<SkinTranslation> translations) {
            this(skinKey, displayOrder, artAssetId, rarityCode, translations, null, null, Map.of());
        }
    }

    public record Skins(
            @NotNull @Size(max = 500) List<@Valid Skin> skins,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
    }

    public record ImageOption(
            @NotNull UUID assetId,
            @Size(max = 255) String label
    ) {
    }

    public record Bindings(
            @NotNull Map<@NotNull MediaRole, @NotNull UUID> bindings,
            @NotNull @Size(max = 30) List<@Valid Source> sources,
            Map<@NotNull MediaRole, @NotNull @Size(max = 200) List<@NotNull @Valid ImageOption>> images
    ) {
        public Bindings {
            images = images == null ? Map.of() : images;
        }

        public Bindings(Map<MediaRole, UUID> bindings, List<Source> sources) {
            this(bindings, sources, Map.of());
        }
    }
}
