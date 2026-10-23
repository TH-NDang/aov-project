package com.wikiaov.arcana.internal.reference.persistence;

import com.wikiaov.terminology.AdminReferenceProvider.Row;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Selects one patch-ranked snapshot per catalog identity. */
public interface ArcanaReferenceSelections {
    List<Row> selectReferenceRows(UUID rulesetId, Map<UUID, Long> ordinals, boolean published, long cutoff);
}
