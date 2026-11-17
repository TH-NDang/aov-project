package com.wikiaov.hero.internal.stats.domain;

import com.wikiaov.hero.internal.domain.HeroContent.Effect;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import java.util.Map;
import java.util.Set;

public final class HeroStatObservations {
    private static final Set<String> NUMERIC_FIELDS = Set.of("health", "physicalAttack", "magicAttack",
            "physicalDefense", "physicalDefensePercent", "magicDefense", "magicDefensePercent", "maxResource",
            "movementSpeed", "physicalPierce", "physicalPiercePercent", "magicPierce", "magicPiercePercent",
            "bonusAttackSpeedPercent", "criticalChancePercent", "criticalDamagePercent", "physicalLifestealPercent",
            "magicLifestealPercent", "cooldownReductionPercent");

    private HeroStatObservations() {
    }

    public static boolean hasReadings(Skills skills, String patchCode) {
        return skills != null && patchCode != null && !patchCode.isBlank() && skills.skills().stream()
                .flatMap(skill -> skill.effects().stream()).anyMatch(effect -> hasReadings(effect, patchCode));
    }

    private static boolean hasReadings(Effect effect, String patchCode) {
        if (!"SOURCE_SNAPSHOT".equals(effect.effectType()) || !patchCode.equals(effect.metadata().get("patchCode"))
                || !(effect.metadata().get("observedAttributes") instanceof Map<?, ?> capture)
                || !"MANUAL_VISUAL_TRANSCRIPTION".equals(capture.get("method"))
                || !"DISPLAYED_SNAPSHOT_NOT_LEVEL_ONE".equals(capture.get("scope"))
                || !(capture.get("values") instanceof Map<?, ?> values)) {
            return false;
        }

        return (values.get("attackRange") instanceof String range && !range.isBlank())
                || NUMERIC_FIELDS.stream()
                        .anyMatch(key -> values.get(key) instanceof Number n && Double.isFinite(n.doubleValue()));
    }
}
