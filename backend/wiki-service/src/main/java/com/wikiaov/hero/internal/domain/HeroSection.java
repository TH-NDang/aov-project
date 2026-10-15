package com.wikiaov.hero.internal.domain;
public enum HeroSection {
    PROFILE("profile", "profile"),
    OVERVIEW_RATINGS("overview_rating", "overview_rating"),
    COMBAT_STATS("combat_stats", "combat_stats"),
    SKILLS("skill_set", "skills"),
    SKINS("skin_set", "skins"),
    MEDIA_BINDINGS("media_binding", "media_binding");
    private final String table;
    private final String column;
    HeroSection(String table, String column) {
        this.table = "hero.hero_" + table + "_revision";
        this.column = column + "_revision_id";
    }
    public String table() {
        return table;
    }
    public String column() {
        return column;
    }
    @com.fasterxml.jackson.annotation.JsonValue
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
    public static HeroSection path(String path) {
        return valueOf(path.toUpperCase(java.util.Locale.ROOT).replace('-', '_'));
    }
}
