package com.wikiaov.gamemode.internal.lineup.domain;

import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Aggregates lineups into the public analysis: how often units and traits appear, weighted by likes. It describes
 * what editors and readers build, not match results, so it never claims a win rate.
 */
public final class LineupInsights {
    private LineupInsights() {
    }

    /** A lineup as the analysis sees it. */
    public record Sample(
            List<AutoChessContent.LineupUnit> units,
            List<String> emblems,
            long likes
    ) {
    }

    public record UnitUsage(
            String code,
            long appearances,
            long weighted,
            long carryCount
    ) {
    }

    /** @param topTierReached how many lineups reach the trait's highest threshold */
    public record TraitUsage(
            String code,
            long activations,
            long topTierReached
    ) {
    }

    public record CostShare(
            int cost,
            long count
    ) {
    }

    public record Summary(
            int lineupCount,
            List<UnitUsage> units,
            List<TraitUsage> traits,
            List<CostShare> costs
    ) {
    }

    public static Summary summarize(AutoChessContent guide, List<Sample> samples) {
        var unitCost = new HashMap<String, Integer>();
        guide.units().forEach(unit -> unitCost.put(unit.code(), unit.cost()));
        var tierCount = new HashMap<String, Integer>();
        guide.traits().forEach(trait -> tierCount.put(trait.code(), trait.tiers().size()));

        var appearances = new HashMap<String, long[]>();
        var traits = new HashMap<String, long[]>();
        var costs = new HashMap<Integer, Long>();
        for (var sample : samples) {
            var codes = new LinkedHashSet<String>();
            for (var unit : sample.units()) {
                if (!unitCost.containsKey(unit.unitCode()) || !codes.add(unit.unitCode())) {
                    continue;
                }
                var usage = appearances.computeIfAbsent(unit.unitCode(), key -> new long[3]);
                usage[0]++;
                usage[1] += 1 + sample.likes();
                if (unit.carry()) {
                    usage[2]++;
                }
                Integer cost = unitCost.get(unit.unitCode());
                if (cost != null) {
                    costs.merge(cost, 1L, Long::sum);
                }
            }
            for (var count : TraitActivation.count(guide, List.copyOf(codes), sample.emblems())) {
                if (count.reachedTier() < 0) {
                    continue;
                }
                var usage = traits.computeIfAbsent(count.traitCode(), key -> new long[2]);
                usage[0]++;
                if (count.reachedTier() == tierCount.get(count.traitCode()) - 1) {
                    usage[1]++;
                }
            }
        }

        var unitUsage = new ArrayList<UnitUsage>();
        appearances.forEach((code, usage) -> unitUsage.add(new UnitUsage(code, usage[0], usage[1], usage[2])));
        unitUsage.sort(Comparator.comparingLong(UnitUsage::weighted).reversed().thenComparing(UnitUsage::code));
        var traitUsage = new ArrayList<TraitUsage>();
        traits.forEach((code, usage) -> traitUsage.add(new TraitUsage(code, usage[0], usage[1])));
        traitUsage.sort(Comparator.comparingLong(TraitUsage::activations).reversed().thenComparing(TraitUsage::code));
        var costShare = new ArrayList<CostShare>();
        Map<Integer, Long> sorted = new TreeMap<>(costs);
        sorted.forEach((cost, count) -> costShare.add(new CostShare(cost, count)));

        return new Summary(samples.size(), unitUsage, traitUsage, costShare);
    }
}
