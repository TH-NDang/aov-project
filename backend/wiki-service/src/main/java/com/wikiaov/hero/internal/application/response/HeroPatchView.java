package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroContent.Role;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Gameplay data of a hero at one patch, derived on read from the nearest published revision and the recorded change
 * sets (ADR-016). Nothing here is persisted; derived and carried values are not observations.
 */
public record HeroPatchView(
        UUID heroId,
        UUID patchVariantId,
        Anchor anchor,
        List<StatValue> stats,
        List<RoleValue> roles,
        List<SkillFieldValue> skillFields,
        List<UUID> appliedChangeSetIds
) {
    public enum Direction {
        /** A revision published for this patch. */
        EXACT,
        /** An earlier revision with the new values of later change sets applied. */
        FORWARD,
        /** A later revision with the old values of change sets applied in reverse. */
        BACKWARD,
        /** The hero has no published revision in the ruleset. */
        NONE
    }

    public enum Provenance {
        /** Read from a revision published for this patch. */
        OBSERVED,
        /** Set by a change set between the anchor and this patch. */
        DERIVED,
        /** Copied from the anchor and not confirmed for this patch. */
        CARRIED
    }

    public record Anchor(
            Direction direction,
            UUID revisionId,
            UUID patchVariantId
    ) {
    }

    /** Change sets record base values only, so the provenance describes {@code baseValue}. */
    public record StatValue(
            String statKey,
            String unit,
            BigDecimal baseValue,
            BigDecimal growthPerLevel,
            Provenance provenance,
            UUID changeSetId
    ) {
    }

    public record RoleValue(
            Role roleCode,
            Provenance provenance,
            UUID changeSetId
    ) {
    }

    /** Skill text is free-form, so only the recorded fields are derived. */
    public record SkillFieldValue(
            String skillKey,
            String fieldKey,
            String value,
            Provenance provenance,
            UUID changeSetId
    ) {
    }
}
