package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A hero's publication state for the Admin overview. Each draft carries only the fields the Admin's publish rules read,
 * so the list stays small enough to load for every hero; this view passes no judgement of its own.
 * {@code holderId} and {@code formKey} are set for a form of another hero; {@code formIds} lists the forms of a hero
 * that holds forms, whose drafts carry no gameplay (ADR-024).
 */
public record HeroPublishReadinessView(
        UUID id,
        String code,
        List<Name> names,
        String headUrl,
        List<HeroRevisionView> revisions,
        List<Draft> drafts,
        UUID holderId,
        String formKey,
        List<UUID> formIds
) {
    public record Name(
            String locale,
            String name
    ) {
    }

    public record Draft(
            UUID revisionId,
            boolean observedStats,
            boolean skinsSaved,
            DraftProfile profile,
            DraftRatings overviewRatings,
            DraftStats combatStats,
            DraftSkills skills,
            DraftMedia mediaBindings
    ) {
    }

    public record DraftProfile(
            List<Name> translations,
            Set<Role> roles
    ) {
    }

    public record DraftRatings(
            String scaleCode,
            BigDecimal survivability,
            BigDecimal attackDamage,
            BigDecimal skillEffects,
            BigDecimal difficulty
    ) {
    }

    public record DraftStats(
            List<String> values
    ) {
    }

    public record DraftSkills(
            List<DraftSkill> skills
    ) {
    }

    public record DraftSkill(
            String skillKey,
            List<DraftSkillText> translations
    ) {
    }

    public record DraftSkillText(
            String locale,
            String name,
            String description
    ) {
    }

    public record DraftMedia(
            Map<MediaRole, UUID> bindings
    ) {
    }
}
