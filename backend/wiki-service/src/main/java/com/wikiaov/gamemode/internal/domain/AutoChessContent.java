package com.wikiaov.gamemode.internal.domain;

import com.wikiaov.gamemode.internal.domain.GameModeContent.RuleSection;
import com.wikiaov.gamemode.internal.domain.GameModeContent.Source;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * One consistent snapshot of the in-game auto-chess encyclopedia: rules, traits, units, items, blessings, quests and the
 * editors' recommended lineups. Units and lineups refer to other entries by code inside the same snapshot.
 */
public record AutoChessContent(
        String edition,
        LocalDate observedOn,
        String summary,
        List<RuleSection> rules,
        List<Trait> traits,
        List<Unit> units,
        List<ItemGroup> itemGroups,
        List<Item> items,
        List<Blessing> blessings,
        List<Quest> quests,
        List<Lineup> lineups,
        List<Source> sources
) {

    public AutoChessContent {
        rules = copy(rules);
        traits = copy(traits);
        units = copy(units);
        itemGroups = copy(itemGroups);
        items = copy(items);
        blessings = copy(blessings);
        quests = copy(quests);
        lineups = copy(lineups);
        sources = copy(sources);
    }

    public static AutoChessContent empty() {
        return new AutoChessContent(null, null, null, null, null, null, null, null, null, null, null, null);
    }

    public AutoChessContent withLineups(List<Lineup> replacement) {
        return new AutoChessContent(edition, observedOn, summary, rules, traits, units, itemGroups, items, blessings,
                quests, replacement, sources);
    }

    private static <T> List<T> copy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    /**
     * A synergy. The game lists FACTION and CLASS synergies on separate tabs.
     *
     * @param tiers activation thresholds in ascending order of unit count
     */
    public record Trait(
            String code,
            String kind,
            String name,
            String description,
            UUID iconAssetId,
            List<TraitTier> tiers,
            String note
    ) {

        public Trait {
            tiers = copy(tiers);
        }
    }

    public record TraitTier(
            int count,
            String effect
    ) {
    }

    /**
     * A chess piece. {@code complete} is false while the encyclopedia page has not been captured yet.
     *
     * @param heroCode optional link to the hero catalog; mode stats and skills stay mode data
     */
    public record Unit(
            String code,
            String name,
            Integer cost,
            List<String> traitCodes,
            UUID portraitAssetId,
            String heroCode,
            Skill skill,
            UnitStats stats,
            boolean complete,
            String note
    ) {

        public Unit {
            traitCodes = copy(traitCodes);
        }
    }

    /** The unit's skill; {@code values} holds the 1, 2 and 3 star value of {@code valueLabel}, or nothing. */
    public record Skill(
            String name,
            String description,
            UUID iconAssetId,
            String valueLabel,
            List<String> values
    ) {

        public Skill {
            values = copy(values);
        }
    }

    /** Stats at 1, 2 and 3 stars; each list holds three values or none. */
    public record UnitStats(
            List<Integer> health,
            List<Integer> physicalAttack,
            List<Integer> armor,
            List<Integer> magicResistance
    ) {

        public UnitStats {
            health = copy(health);
            physicalAttack = copy(physicalAttack);
            armor = copy(armor);
            magicResistance = copy(magicResistance);
        }
    }

    /** A row of the encyclopedia's item grid. {@code slotCount} includes slots the capture could not read. */
    public record ItemGroup(
            String code,
            String name,
            Integer slotCount
    ) {
    }

    public record Item(
            String code,
            String name,
            String effect,
            String groupCode,
            Integer slot,
            UUID iconAssetId
    ) {
    }

    /** A blessing; {@code tier} is {@code NORMAL}, {@code EPIC} or {@code LEGENDARY}. */
    public record Blessing(
            String code,
            String tier,
            String name,
            String description,
            UUID iconAssetId
    ) {
    }

    public record Quest(
            String code,
            String task,
            String reward
    ) {
    }

    /**
     * An editors' recommended lineup. The id stays stable across revisions so that likes keep counting.
     *
     * @param tier       {@code S}, {@code A}, {@code B}, {@code C}, or null while unrated
     * @param difficulty {@code EASY}, {@code MEDIUM}, {@code HARD}, or null
     * @param emblems    extra trait emblems counted by the lineup, at most three
     */
    public record Lineup(
            UUID id,
            String code,
            String name,
            String tier,
            String difficulty,
            String summary,
            List<LineupUnit> units,
            List<String> emblems,
            List<String> blessingCodes,
            String notes
    ) {

        public Lineup {
            units = copy(units);
            emblems = copy(emblems);
            blessingCodes = copy(blessingCodes);
        }

        public Lineup withId(UUID replacement) {
            return new Lineup(replacement, code, name, tier, difficulty, summary, units, emblems, blessingCodes,
                    notes);
        }
    }

    /** A unit placed in a lineup; {@code row} is {@code FRONT}, {@code MIDDLE}, {@code BACK} or null. */
    public record LineupUnit(
            String unitCode,
            boolean carry,
            String row,
            List<String> itemCodes
    ) {

        public LineupUnit {
            itemCodes = copy(itemCodes);
        }
    }
}
