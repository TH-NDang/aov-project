package com.wikiaov.platform;

import java.util.Set;

/**
 * The stat codes the catalogs share (ADR-033): the arcana codes plus those items need. A unit is {@code %} or absent
 * for points.
 */
public final class CatalogStats {
    public static final Set<String> KEYS = Set.of("physical-attack", "magic-attack", "adaptive-attack", "max-health",
            "armor", "magic-defense", "attack-speed", "movement-speed", "cooldown-reduction", "critical-chance",
            "critical-damage", "physical-lifesteal", "magic-lifesteal", "armor-penetration", "magic-penetration",
            "health-regen-per-five-seconds", "mana-regen-per-five-seconds", "max-mana", "tenacity", "attack-range");

    public static final String PERCENT = "%";

    private CatalogStats() {
    }

    public static boolean isKey(String key) {
        return key != null && KEYS.contains(key);
    }

    public static boolean isUnit(String unit) {
        return unit == null || PERCENT.equals(unit);
    }
}
