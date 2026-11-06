package com.wikiaov.media;

/** What an asset depicts. It never contains the owner's id: the owner binds to the asset, not the other way round. */
public enum MediaSemanticType {
    USER_AVATAR,
    HERO_HEAD,
    HERO_PORTRAIT,
    HERO_SPLASH,
    HERO_SKILL_ICON,
    HERO_SKIN_ART,
    SKIN_BADGE,
    ITEM_ICON,
    ARCANA_ICON,
    SPELL_ICON,
    ENCHANTMENT_ICON,
    PATCH_ART,
    /** AI-generated chibi sticker of a hero or skin; the provenance note names the subject and expression. */
    CHIBI_STICKER,
    OTHER
}
