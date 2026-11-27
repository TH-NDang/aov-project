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
    /** Artwork of a game mode with the game's menu, text and account details removed (ADR-023). */
    GAME_MODE_ART,
    /** Icon from the auto-chess encyclopedia: unit, skill, trait, item or blessing. */
    AUTO_CHESS_ICON,
    /** Icon of an object of a battlefield map: a structure, minion, monster or mechanic. */
    MAP_ICON,
    OTHER
}
