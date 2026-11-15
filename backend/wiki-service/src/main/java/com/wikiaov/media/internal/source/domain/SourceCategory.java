package com.wikiaov.media.internal.source.domain;

/**
 * What a collection of source files is for (ADR-030 section 4). The declaration order is the browsing order.
 */
public enum SourceCategory {
    /** Hero page captures of a patch, recaptures and in-match shots. */
    HERO_CAPTURE,
    /** Shop screenshots: hero gold prices and how skins are obtained. */
    SHOP_CAPTURE,
    /** The game's recommended pro builds. */
    BUILD_CAPTURE,
    /** The game's hero ranking boards. */
    RANKING_CAPTURE,
    /** Game mode sources: auto-chess encyclopedia pages, lobby screenshots with the UID masked. */
    GAME_MODE_SOURCE,
    /** Esports sources: collected tournament data and pictures. */
    ESPORTS_SOURCE,
    /** Data that import tools read: JSON, CSV, Markdown, scripts. */
    IMPORT_DATA,
    /** Original files kept only to rebuild something later, such as a ZIP as delivered. */
    ARCHIVE
}
