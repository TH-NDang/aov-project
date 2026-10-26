package com.wikiaov.enchantment.internal.reference.persistence;

import com.wikiaov.terminology.AdminReferenceProvider.Row;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Selects one patch-ranked snapshot per catalog identity. */
public interface EnchantmentReferenceSelections {
    default List<Row> selectReferenceRows(UUID rulesetId, Map<UUID, Long> ordinals, boolean published, long cutoff) {
        return selectReferenceRows(rulesetId, ordinals, published, cutoff, true);
    }

    List<Row> selectReferenceRows(UUID rulesetId, Map<UUID, Long> ordinals, boolean published, long cutoff,
            boolean allowUnscoped);
}
