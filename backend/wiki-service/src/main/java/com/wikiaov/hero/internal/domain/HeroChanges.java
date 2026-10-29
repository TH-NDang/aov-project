package com.wikiaov.hero.internal.domain;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;

public final class HeroChanges {
    private HeroChanges() {
    }

    public enum Kind {
        BUFF,
        NERF,
        ADJUSTMENT,
        REWORK,
        FIX,
        OTHER
    }

    /** Where the recorded values come from (ADR-016). */
    public enum ChangeSource {
        /** Values are compared with the source and target snapshots. */
        SNAPSHOT,
        /** Values are transcribed from official patch notes; no snapshot of the patch is required. */
        PATCH_NOTES
    }

    @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
    @JsonSubTypes({@JsonSubTypes.Type(value = StatChange.class, name = "STAT"),
            @JsonSubTypes.Type(value = SkillChange.class, name = "SKILL"),
            @JsonSubTypes.Type(value = RoleChange.class, name = "ROLE"),
            @JsonSubTypes.Type(value = VisualChange.class, name = "VISUAL"),
            @JsonSubTypes.Type(value = MechanicChange.class, name = "MECHANIC"),
            @JsonSubTypes.Type(value = OtherChange.class, name = "OTHER")})
    public sealed interface Change
            permits StatChange, SkillChange, RoleChange, VisualChange, MechanicChange, OtherChange {
        Kind changeKind();
    }

    public record StatChange(
            @NotNull Kind changeKind,
            @NotBlank @Size(max = 64) String statKey,
            BigDecimal oldValue,
            BigDecimal newValue,
            @NotBlank @Size(max = 32) String unit
    ) implements Change {
    }

    public record SkillChange(
            @NotNull Kind changeKind,
            @NotBlank @Size(max = 64) String skillKey,
            @NotBlank @Size(max = 64) String fieldKey,
            @Size(max = 20000) String oldValue,
            @Size(max = 20000) String newValue
    ) implements Change {
    }

    public record RoleChange(
            @NotNull Kind changeKind,
            @NotNull HeroContent.Role roleCode,
            boolean added
    ) implements Change {
    }

    public record VisualChange(
            @NotNull Kind changeKind,
            @NotNull HeroContent.MediaRole mediaRole,
            UUID oldAssetId,
            UUID newAssetId
    ) implements Change {
    }

    public record MechanicChange(
            @NotNull Kind changeKind,
            @NotBlank @Size(max = 64) String mechanicKey,
            @NotBlank @Size(max = 20000) String description
    ) implements Change {
    }

    public record OtherChange(
            @NotNull Kind changeKind,
            @NotBlank @Size(max = 20000) String description
    ) implements Change {
    }

    public record Summary(
            @NotBlank @Size(max = 16) String locale,
            @NotBlank @Size(max = 20000) String summary
    ) {
    }

    /** A missing {@code sourceKind} means {@link ChangeSource#SNAPSHOT}, which requires {@code toHeroRevisionId}. */
    public record Record(
            @NotNull UUID heroId,
            ChangeSource sourceKind,
            @Size(max = 2048) String sourceUrl,
            UUID fromHeroRevisionId,
            UUID toHeroRevisionId,
            @NotEmpty @Size(max = 30) List<@Valid Summary> summaryTranslations,
            @NotEmpty @Size(max = 200) List<@Valid Change> changes
    ) {
        public ChangeSource source() {
            return sourceKind == null ? ChangeSource.SNAPSHOT : sourceKind;
        }
    }
}
