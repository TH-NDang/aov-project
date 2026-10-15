package com.wikiaov.hero.internal.domain;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
public final class HeroContent {
    private HeroContent() {
    }
    public enum Cause {
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
    public record ProfileTranslation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 200) String title,
            @Size(max = 20000) String summary,
            @Size(max = 100000) String lore
    ) {
    }
    public record Profile(
            @NotEmpty @Size(max = 30) List<@Valid ProfileTranslation> translations,
            @NotEmpty Set<@NotNull Role> roles,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
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
            BigDecimal growthPerLevel,
            @NotBlank @Size(max = 32) String unit
    ) {
    }
    public record Stats(
            @NotEmpty @Size(max = 100) List<@Valid Stat> values,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
    }
    public record SkillTranslation(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 100000) String description
    ) {
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
            @NotNull @Size(max = 100) List<@Valid Effect> effects
    ) {
    }
    public record Skills(
            @NotEmpty @Size(max = 100) List<@Valid Skill> skills,
            @NotNull @Size(max = 30) List<@Valid Source> sources
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
            @NotEmpty @Size(max = 30) List<@Valid SkinTranslation> translations
    ) {
    }
    public record Skins(
            @NotNull @Size(max = 500) List<@Valid Skin> skins,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
    }
    public record Bindings(
            @NotNull Map<@NotNull MediaRole, @NotNull UUID> bindings,
            @NotNull @Size(max = 30) List<@Valid Source> sources
    ) {
    }
}
