package com.wikiaov.spell.internal.domain;

import java.util.UUID;

/** A removed legacy observation without a known patch belongs to the archive, not current gameplay. */
public final class SpellObservation {
    private SpellObservation() {
    }

    public static boolean archived(String cause, UUID patchVariantId, SpellContent content) {
        return patchVariantId == null && !"GAME_PATCH".equals(cause) && content != null
                && content.legacy() && content.availability().equals("REMOVED");
    }
}
