package com.wikiaov.media.internal.domain.model;

/** Where an artwork came from. */
public enum ProvenanceSourceType {
    /** Official website, press kit or social account of the game. */
    OFFICIAL,
    /** Extracted from the game client. */
    GAME_CLIENT,
    /** Community site or fan contribution. */
    COMMUNITY,
    OTHER
}
