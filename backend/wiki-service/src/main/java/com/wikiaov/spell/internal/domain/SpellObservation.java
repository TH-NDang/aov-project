package com.wikiaov.spell.internal.domain;

import com.wikiaov.platform.CatalogCause;
import java.util.UUID;

/** A removed legacy observation without a known patch belongs to the archive, not current gameplay. */
public final class SpellObservation {
    private SpellObservation() {
    }

    public static boolean archived(CatalogCause cause, UUID patchVariantId, SpellContent content) {
        return patchVariantId == null && cause != CatalogCause.GAME_PATCH && content != null
                && content.legacy() && content.availability().equals("REMOVED");
    }
}
