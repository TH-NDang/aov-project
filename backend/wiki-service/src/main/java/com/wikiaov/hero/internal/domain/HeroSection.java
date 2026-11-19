package com.wikiaov.hero.internal.domain;

import com.fasterxml.jackson.annotation.JsonValue;

public enum HeroSection {
    PROFILE,
    OVERVIEW_RATINGS,
    COMBAT_STATS,
    SKILLS,
    SKINS,
    MEDIA_BINDINGS;

    @JsonValue
    public String jsonKey() {
        return switch (this) {
            case PROFILE -> "profile";
            case OVERVIEW_RATINGS -> "overviewRatings";
            case COMBAT_STATS -> "combatStats";
            case SKILLS -> "skills";
            case SKINS -> "skins";
            case MEDIA_BINDINGS -> "mediaBindings";
        };
    }
}
