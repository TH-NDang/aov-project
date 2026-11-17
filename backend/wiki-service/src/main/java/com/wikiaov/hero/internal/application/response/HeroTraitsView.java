package com.wikiaov.hero.internal.application.response;

import java.util.List;
import java.util.UUID;

/** Every trait with the heroes of a market that have it (ADR-029). */
public record HeroTraitsView(
        String region,
        List<Trait> traits
) {

    public record Trait(
            String code,
            List<Hero> heroes
    ) {
    }

    public record Hero(
            UUID id,
            String code
    ) {
    }
}
