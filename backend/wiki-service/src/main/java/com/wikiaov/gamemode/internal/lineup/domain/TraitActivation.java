package com.wikiaov.gamemode.internal.lineup.domain;

import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Counts the traits of a lineup the way the Wiki's builder does: each distinct unit counts once, emblems add one
 * each, and the reached tier is the highest threshold not above the count.
 */
public final class TraitActivation {
    private TraitActivation() {
    }

    /**
     * @param reachedTier index into the trait's tiers, or -1 when no threshold is reached
     */
    public record Count(
            String traitCode,
            int count,
            int reachedTier
    ) {
    }

    public static List<Count> count(AutoChessContent content, List<String> unitCodes, List<String> emblems) {
        var units = new HashMap<String, AutoChessContent.Unit>();
        content.units().forEach(unit -> units.put(unit.code(), unit));
        var counts = new HashMap<String, Integer>();
        for (String code : new LinkedHashSet<>(unitCodes)) {
            var unit = units.get(code);
            if (unit != null)
                unit.traitCodes().forEach(trait -> counts.merge(trait, 1, Integer::sum));
        }
        emblems.forEach(trait -> counts.merge(trait, 1, Integer::sum));

        var result = new ArrayList<Count>();
        for (var trait : content.traits()) {
            int count = counts.getOrDefault(trait.code(), 0);
            if (count == 0)
                continue;
            result.add(new Count(trait.code(), count, reachedTier(trait, count)));
        }
        return result;
    }

    public static Map<String, Count> byTrait(List<Count> counts) {
        var map = new HashMap<String, Count>();
        counts.forEach(count -> map.put(count.traitCode(), count));
        return map;
    }

    static int reachedTier(AutoChessContent.Trait trait, int count) {
        int reached = -1;
        for (int i = 0; i < trait.tiers().size(); i++) {
            if (trait.tiers().get(i).count() <= count)
                reached = i;
        }
        return reached;
    }
}
