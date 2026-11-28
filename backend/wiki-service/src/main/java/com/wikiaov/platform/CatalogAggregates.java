package com.wikiaov.platform;

import java.util.Set;

/**
 * Audit aggregate types whose changes can alter a cached catalog read model. A write records one of these names in
 * its {@code AuditEntry}; {@link CatalogCacheChanges} then moves the cache epoch in the same transaction. A type that
 * is not listed in {@link #CACHED} leaves the cache as it is, so a new catalog type must be added here.
 */
public final class CatalogAggregates {
    public static final String HERO = "HERO";
    public static final String ITEM = "ITEM";
    public static final String ARCANA = "ARCANA";
    public static final String SPELL = "SPELL";
    public static final String ENCHANTMENT = "ENCHANTMENT";
    public static final String PATCH = "PATCH";
    public static final String REGION = "REGION";
    public static final String RANKED_SEASON = "RANKED_SEASON";
    public static final String REFERENCE_SETTINGS = "REFERENCE_SETTINGS";
    public static final String MEDIA_ASSET = "MEDIA_ASSET";
    public static final String SKIN_BADGE = "SKIN_BADGE";
    public static final String SKIN_BADGE_GROUP = "SKIN_BADGE_GROUP";
    public static final String ITEM_METADATA = "ITEM_METADATA";
    public static final String ENCHANTMENT_METADATA = "ENCHANTMENT_METADATA";
    public static final String HERO_STAT_RULE = "HERO_STAT_RULE";

    public static final Set<String> CACHED = Set.of(HERO, ITEM, ARCANA, SPELL, ENCHANTMENT, PATCH, REGION,
            RANKED_SEASON, REFERENCE_SETTINGS, MEDIA_ASSET, SKIN_BADGE, SKIN_BADGE_GROUP, ITEM_METADATA,
            ENCHANTMENT_METADATA, HERO_STAT_RULE);

    private CatalogAggregates() {
    }
}
