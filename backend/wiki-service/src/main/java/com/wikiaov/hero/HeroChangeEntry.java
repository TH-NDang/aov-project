package com.wikiaov.hero;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.hero.internal.domain.HeroChanges.ChangeSource;
import com.wikiaov.hero.internal.domain.HeroChanges.OverallKind;
import com.wikiaov.patch.PublishedPatch;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The changes one patch made to one hero, as the change history and the patch pages send them (03, hero changes;
 * ADR-016).
 *
 * @param overallKind       the editor's overall assessment, or {@code null} until one is recorded
 * @param assessmentVersion the version of that assessment, {@code 0} until one is recorded
 * @param actualLocale      the locale of the summary; left out with it when the change set has no summary
 * @param holderId          the hero that holds this hero as a form (ADR-024); left out for a hero without a holder
 * @param holderCode        the code of that holding hero; left out with it
 * @param formKey           the form this hero is on its holder; left out with it
 * @param patch             the patch the changes belong to; sent by the hero change history only
 */
public record HeroChangeEntry(
        UUID id,
        @Nullable OverallKind overallKind,
        long assessmentVersion,
        UUID heroId,
        String heroCode,
        UUID patchVariantId,
        @Nullable UUID fromHeroRevisionId,
        @Nullable UUID toHeroRevisionId,
        ChangeSource sourceKind,
        @Nullable String sourceUrl,
        boolean introducesHero,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable String actualLocale,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable String summary,
        List<Line> changes,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable UUID holderId,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable String holderCode,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable String formKey,
        @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable PublishedPatch patch
) {

    /** The same entry naming the hero that holds this hero as a form. */
    public HeroChangeEntry withHolder(UUID id, String code, @Nullable String form) {
        return new HeroChangeEntry(this.id, overallKind, assessmentVersion, heroId, heroCode, patchVariantId,
                fromHeroRevisionId, toHeroRevisionId, sourceKind, sourceUrl, introducesHero, actualLocale, summary,
                changes, id, code, form, patch);
    }

    /** The same entry with the patch it belongs to. */
    public HeroChangeEntry withPatch(PublishedPatch value) {
        return new HeroChangeEntry(id, overallKind, assessmentVersion, heroId, heroCode, patchVariantId,
                fromHeroRevisionId, toHeroRevisionId, sourceKind, sourceUrl, introducesHero, actualLocale, summary,
                changes, holderId, holderCode, formKey, value);
    }

    /** One recorded change; {@code type} names the kind of line and which fields it carries. */
    @Schema(oneOf = {StatLine.class, SkillLine.class, RoleLine.class, VisualLine.class, MechanicLine.class,
            OtherLine.class})
    public sealed interface Line permits StatLine, SkillLine, RoleLine, VisualLine, MechanicLine, OtherLine {
        UUID id();

        String changeKind();

        int sortOrder();

        String type();
    }

    public record StatLine(
            UUID id,
            String changeKind,
            int sortOrder,
            String type,
            String statKey,
            @Nullable BigDecimal oldValue,
            @Nullable BigDecimal newValue,
            String unitCode
    ) implements Line {
        public static final String TYPE = "HERO_STAT_CHANGE";
    }

    public record SkillLine(
            UUID id,
            String changeKind,
            int sortOrder,
            String type,
            String skillKey,
            String fieldKey,
            @Nullable String oldValue,
            @Nullable String newValue
    ) implements Line {
        public static final String TYPE = "HERO_SKILL_CHANGE";
    }

    public record RoleLine(
            UUID id,
            String changeKind,
            int sortOrder,
            String type,
            String roleCode,
            boolean added
    ) implements Line {
        public static final String TYPE = "HERO_ROLE_CHANGE";
    }

    public record VisualLine(
            UUID id,
            String changeKind,
            int sortOrder,
            String type,
            String mediaRole,
            @Nullable UUID oldAssetId,
            @Nullable UUID newAssetId
    ) implements Line {
        public static final String TYPE = "HERO_VISUAL_CHANGE";
    }

    /** @param previous what the mechanic did before its change, or {@code null} until an editor records it */
    public record MechanicLine(
            UUID id,
            String changeKind,
            int sortOrder,
            String type,
            String mechanicKey,
            String description,
            @Nullable Previous previous
    ) implements Line {
        public static final String TYPE = "HERO_MECHANIC_CHANGE";
    }

    public record OtherLine(
            UUID id,
            String changeKind,
            int sortOrder,
            String type,
            String description
    ) implements Line {
        public static final String TYPE = "HERO_OTHER_CHANGE";
    }

    /** What a mechanic did before its change, with the source it was written from. */
    public record Previous(
            String description,
            String sourceUrl,
            Instant recordedAt
    ) {
    }
}
