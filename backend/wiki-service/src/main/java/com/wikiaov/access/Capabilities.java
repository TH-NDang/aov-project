package com.wikiaov.access;

/**
 * Capability names checked by the backend. They are granted as client roles of {@code wiki-service}
 * in the identity provider; actor roles (editor, publisher, ...) are composites of these.
 */
public final class Capabilities {

    public static final String CATALOG_READ = "catalog:read";

    public static final String HERO_WRITE = "hero:write";
    public static final String HERO_PUBLISH = "hero:publish";
    public static final String ITEM_WRITE = "item:write";
    public static final String ITEM_PUBLISH = "item:publish";
    public static final String ARCANA_WRITE = "arcana:write";
    public static final String ARCANA_PUBLISH = "arcana:publish";
    public static final String SPELL_WRITE = "spell:write";
    public static final String SPELL_PUBLISH = "spell:publish";
    public static final String ENCHANTMENT_WRITE = "enchantment:write";
    public static final String ENCHANTMENT_PUBLISH = "enchantment:publish";

    public static final String MEDIA_WRITE = "media:write";

    public static final String PATCH_WRITE = "patch:write";
    public static final String PATCH_PUBLISH = "patch:publish";

    public static final String REGION_ADMIN = "region:admin";

    private Capabilities() {
    }
}
