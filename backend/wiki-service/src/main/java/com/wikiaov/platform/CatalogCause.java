package com.wikiaov.platform;

import org.jspecify.annotations.Nullable;

/** Why a revision of a warehouse catalog (item, arcana, spell, enchantment) exists (02, warehouse revisions). */
public enum CatalogCause {
    /** The first observation of an entry, before any recorded change. */
    DATA_BASELINE,
    /** The game changed the entry in a patch. */
    GAME_PATCH,
    /** An editor corrected what was recorded; the game did not change. */
    CONTENT_CORRECTION,
    /** Only translations changed; gameplay stays as the source revision has it. */
    TRANSLATION_UPDATE;

    /** Whether the revision records gameplay as observed at its patch: a baseline or a game patch. */
    public boolean gameplay() {
        return this == DATA_BASELINE || this == GAME_PATCH;
    }

    /** Whether the revision corrects or translates its source without a gameplay change. */
    public boolean revisesSource() {
        return this == CONTENT_CORRECTION || this == TRANSLATION_UPDATE;
    }

    /** The cause a fork names, or {@code null} when it names none a fork may have: a fork never starts a baseline. */
    public static @Nullable CatalogCause ofFork(@Nullable String name) {
        var cause = EnumNames.find(CatalogCause.class, name);
        return cause == DATA_BASELINE ? null : cause;
    }
}
