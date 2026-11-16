package com.wikiaov.hero.internal.forms.domain;

import com.wikiaov.hero.internal.domain.HeroContent.*;
import java.util.stream.Stream;

/**
 * Gameplay belongs to forms. A hero that holds forms keeps only what all forms share: names, title, lore, shared skins
 * and card images. Roles, positions, ratings, stats and skills on it would contradict its forms.
 */
public final class HeroFormGameplay {
    private HeroFormGameplay() {
    }

    /** Whether a section's content carries gameplay that only a form may hold. */
    public static boolean present(Object content) {
        return switch (content) {
            case Profile profile -> !profile.roles().isEmpty() || !profile.positions().isEmpty();
            case Ratings ratings -> ratings.scaleCode() != null || Stream.of(ratings.survivability(),
                    ratings.attackDamage(), ratings.skillEffects(), ratings.difficulty()).anyMatch(v -> v != null);
            case Stats stats -> !stats.values().isEmpty();
            case Skills skills -> !skills.skills().isEmpty() || (skills.traits() != null && !skills.traits().isEmpty());
            case null, default -> false;
        };
    }
}
