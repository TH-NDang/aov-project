package com.wikiaov.gamemode.internal.guide.domain;

import com.wikiaov.gamemode.internal.catalog.domain.GameModeContentRules;
import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.Lineup;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupStage;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.Unit;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.UnitStats;
import com.wikiaov.gamemode.internal.domain.ContentChecks;
import com.wikiaov.platform.ApiFieldError;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/** Structural and reference rules of an auto-chess guide snapshot (spec 01, game modes section). */
public final class AutoChessContentRules {
    public static final Set<String> TRAIT_KINDS = Set.of("FACTION", "CLASS");

    public static final Set<String> BLESSING_TIERS = Set.of("NORMAL", "EPIC", "LEGENDARY");

    public static final Set<String> LINEUP_TIERS = Set.of("S", "A", "B", "C");

    public static final Set<String> DIFFICULTIES = Set.of("EASY", "MEDIUM", "HARD");

    public static final Set<String> ROWS = Set.of("FRONT", "MIDDLE", "BACK");

    /** Cells in each of the three rows of a player's half of the board. */
    public static final int BOARD_COLUMNS = 7;

    /** Stages before the late game, which is the lineup itself. */
    public static final Set<String> LINEUP_STAGES = Set.of("EARLY", "MID");

    /** Ten board slots plus the one an item opens. */
    public static final int MAX_LINEUP_UNITS = 11;

    public static final int MAX_ITEMS_PER_UNIT = 3;

    /** Items a lineup builds first, in order. */
    public static final int MAX_PRIORITY_ITEMS = 6;

    public static final int MAX_EMBLEMS = 3;

    /** The encyclopedia lists 6-gold units since 08/11/2026 (Volkath, Edras). */
    public static final int MAX_COST = 6;

    private AutoChessContentRules() {
    }

    /** Errors that block saving. Missing data is allowed in a draft; broken references are not. */
    public static List<ApiFieldError> validate(AutoChessContent content) {
        var checks = new ContentChecks();

        checks.text("edition", content.edition(), 120, false);
        checks.text("summary", content.summary(), 2000, false);
        GameModeContentRules.rules(checks, "rules", content.rules(), 60);
        GameModeContentRules.sources(checks, "sources", content.sources());
        var traitCodes = traits(checks, content);
        var unitCodes = units(checks, content, traitCodes);
        var itemCodes = items(checks, content);
        var blessingCodes = blessings(checks, content);
        quests(checks, content);
        lineups(checks, content, unitCodes, itemCodes, traitCodes, blessingCodes);

        return checks.errors();
    }

    /** Fields that must be filled before publication. */
    public static List<String> missingFields(AutoChessContent content) {
        var missing = new ArrayList<String>();
        if (content.units().isEmpty()) {
            missing.add("units");
        }
        if (content.traits().isEmpty()) {
            missing.add("traits");
        }
        for (int i = 0; i < content.units().size(); i++) {
            var unit = content.units().get(i);
            if (!unit.complete()) {
                continue;
            }
            String at = "units[" + i + "]";
            // A unit without any trait is a real game state (Ignis), so traits are not required here.
            if (unit.portraitAssetId() == null) {
                missing.add(at + ".portraitAssetId");
            }
            if (unit.skill() == null || unit.skill().name() == null || unit.skill().name().isBlank()) {
                missing.add(at + ".skill.name");
            }
            if (!completeStats(unit.stats())) {
                missing.add(at + ".stats");
            }
        }
        for (int i = 0; i < content.lineups().size(); i++) {
            if (content.lineups().get(i).units().isEmpty()) {
                missing.add("lineups[" + i + "].units");
            }
        }
        return missing;
    }

    /** Every asset the snapshot refers to. */
    public static Set<UUID> assets(AutoChessContent content) {
        var ids = new LinkedHashSet<UUID>();
        content.traits().forEach(trait -> add(ids, trait.iconAssetId()));
        content.units().forEach(unit -> {
            add(ids, unit.portraitAssetId());
            if (unit.skill() != null) {
                add(ids, unit.skill().iconAssetId());
            }
        });
        content.itemGroups().forEach(group -> add(ids, group.iconAssetId()));
        content.items().forEach(item -> add(ids, item.iconAssetId()));
        content.blessings().forEach(blessing -> add(ids, blessing.iconAssetId()));
        return ids;
    }

    /**
     * Gives every lineup without an id a new one and keeps the ids of the source revision, so likes survive edits.
     */
    public static AutoChessContent assignLineupIds(AutoChessContent content, Supplier<UUID> ids) {
        if (content.lineups().stream().allMatch(lineup -> lineup.id() != null)) {
            return content;
        }
        return content.withLineups(content.lineups().stream()
                .map(lineup -> lineup.id() == null ? lineup.withId(ids.get()) : lineup).toList());
    }

    private static void add(Set<UUID> ids, UUID id) {
        if (id != null) {
            ids.add(id);
        }
    }

    private static boolean completeStats(UnitStats stats) {
        return stats != null && stats.health().size() == 3 && stats.physicalAttack().size() == 3
                && stats.armor().size() == 3 && stats.magicResistance().size() == 3;
    }

    private static Set<String> traits(ContentChecks checks, AutoChessContent content) {
        var codes = new HashSet<String>();
        checks.size("traits", content.traits(), 60);
        for (int i = 0; i < content.traits().size(); i++) {
            var trait = content.traits().get(i);
            String at = "traits[" + i + "]";
            checks.code(at + ".code", trait.code(), codes);
            checks.oneOf(at + ".kind", trait.kind(), TRAIT_KINDS, true);
            checks.text(at + ".name", trait.name(), 80, true);
            checks.text(at + ".description", trait.description(), 2000, false);
            checks.text(at + ".note", trait.note(), 500, false);
            checks.size(at + ".tiers", trait.tiers(), 10);
            int previous = 0;
            for (int t = 0; t < trait.tiers().size(); t++) {
                var tier = trait.tiers().get(t);
                checks.range(at + ".tiers[" + t + "].count", tier.count(), 1, 20, true);
                if (tier.count() <= previous) {
                    checks.fail(at + ".tiers[" + t + "].count", "NOT_ASCENDING",
                            "Thresholds must increase from tier to tier.");
                }
                previous = tier.count();
                checks.text(at + ".tiers[" + t + "].effect", tier.effect(), 1000, true);
            }
        }
        return codes;
    }

    private static Set<String> units(ContentChecks checks, AutoChessContent content, Set<String> traitCodes) {
        var codes = new HashSet<String>();
        checks.size("units", content.units(), 120);
        for (int i = 0; i < content.units().size(); i++) {
            var unit = content.units().get(i);
            String at = "units[" + i + "]";
            checks.code(at + ".code", unit.code(), codes);
            checks.text(at + ".name", unit.name(), 80, true);
            checks.range(at + ".cost", unit.cost(), 1, MAX_COST, true);
            checks.references(at + ".traitCodes", unit.traitCodes(), traitCodes, 3);
            checks.text(at + ".note", unit.note(), 500, false);
            if (unit.heroCode() != null && !ContentChecks.CODE.matcher(unit.heroCode()).matches()) {
                checks.fail(at + ".heroCode", "INVALID_CODE", "Use the hero's catalog code.");
            }
            skill(checks, at, unit);
            stats(checks, at + ".stats", unit.stats());
        }
        return codes;
    }

    private static void skill(ContentChecks checks, String at, Unit unit) {
        var skill = unit.skill();
        if (skill == null) {
            return;
        }
        checks.text(at + ".skill.name", skill.name(), 120, false);
        checks.text(at + ".skill.description", skill.description(), 4000, false);
        checks.text(at + ".skill.valueLabel", skill.valueLabel(), 80, false);
        if (!skill.values().isEmpty() && skill.values().size() != 3) {
            checks.fail(at + ".skill.values", "STAR_VALUES", "Give one value per star level, or none.");
        }
        for (int v = 0; v < skill.values().size(); v++) {
            checks.text(at + ".skill.values[" + v + "]", skill.values().get(v), 40, true);
        }
    }

    private static void stats(ContentChecks checks, String at, UnitStats stats) {
        if (stats == null) {
            return;
        }
        var lists = List.of(stats.health(), stats.physicalAttack(), stats.armor(), stats.magicResistance());
        var names = List.of("health", "physicalAttack", "armor", "magicResistance");
        for (int s = 0; s < lists.size(); s++) {
            var values = lists.get(s);
            if (!values.isEmpty() && values.size() != 3) {
                checks.fail(at + "." + names.get(s), "STAR_VALUES", "Give one value per star level, or none.");
            }
            for (int v = 0; v < values.size(); v++) {
                checks.range(at + "." + names.get(s) + "[" + v + "]", values.get(v), 0, 1_000_000, true);
            }
        }
    }

    private static Set<String> items(ContentChecks checks, AutoChessContent content) {
        var groups = new HashSet<String>();
        var groupSlots = new HashMap<String, Integer>();
        checks.size("itemGroups", content.itemGroups(), 20);
        for (int i = 0; i < content.itemGroups().size(); i++) {
            var group = content.itemGroups().get(i);
            String at = "itemGroups[" + i + "]";
            checks.code(at + ".code", group.code(), groups);
            checks.text(at + ".name", group.name(), 80, true);
            checks.range(at + ".slotCount", group.slotCount(), 1, 40, false);
            if (group.code() != null && group.slotCount() != null) {
                groupSlots.put(group.code(), group.slotCount());
            }
        }

        var codes = new HashSet<String>();
        var slots = new HashSet<String>();
        checks.size("items", content.items(), 200);
        for (int i = 0; i < content.items().size(); i++) {
            var item = content.items().get(i);
            String at = "items[" + i + "]";
            checks.code(at + ".code", item.code(), codes);
            checks.text(at + ".name", item.name(), 120, true);
            checks.text(at + ".effect", item.effect(), 1000, false);
            if (item.groupCode() != null && !groups.contains(item.groupCode())) {
                checks.fail(at + ".groupCode", "UNKNOWN_REFERENCE", "No item group has this code.");
            }
            if (item.slot() != null) {
                int max = groupSlots.getOrDefault(item.groupCode(), 40) - 1;
                checks.range(at + ".slot", item.slot(), 0, max, true);
                if (!slots.add(item.groupCode() + "#" + item.slot())) {
                    checks.fail(at + ".slot", "DUPLICATE_SLOT", "Another item already uses this slot.");
                }
            }
        }
        return codes;
    }

    private static Set<String> blessings(ContentChecks checks, AutoChessContent content) {
        var codes = new HashSet<String>();
        checks.size("blessings", content.blessings(), 300);
        for (int i = 0; i < content.blessings().size(); i++) {
            var blessing = content.blessings().get(i);
            String at = "blessings[" + i + "]";
            checks.code(at + ".code", blessing.code(), codes);
            checks.oneOf(at + ".tier", blessing.tier(), BLESSING_TIERS, true);
            checks.text(at + ".name", blessing.name(), 120, true);
            checks.text(at + ".description", blessing.description(), 2000, false);
        }
        return codes;
    }

    private static void quests(ContentChecks checks, AutoChessContent content) {
        var codes = new HashSet<String>();
        checks.size("quests", content.quests(), 100);
        for (int i = 0; i < content.quests().size(); i++) {
            var quest = content.quests().get(i);
            String at = "quests[" + i + "]";
            checks.code(at + ".code", quest.code(), codes);
            checks.text(at + ".task", quest.task(), 300, true);
            checks.text(at + ".reward", quest.reward(), 200, false);
        }
    }

    private static void lineups(ContentChecks checks, AutoChessContent content, Set<String> units,
            Set<String> items, Set<String> traits, Set<String> blessings) {
        var codes = new HashSet<String>();
        var ids = new HashSet<UUID>();
        checks.size("lineups", content.lineups(), 60);
        for (int i = 0; i < content.lineups().size(); i++) {
            Lineup lineup = content.lineups().get(i);
            String at = "lineups[" + i + "]";
            if (lineup.id() != null && !ids.add(lineup.id())) {
                checks.fail(at + ".id", "DUPLICATE_ID", "Two lineups share one id.");
            }
            checks.code(at + ".code", lineup.code(), codes);
            checks.text(at + ".name", lineup.name(), 80, true);
            checks.oneOf(at + ".tier", lineup.tier(), LINEUP_TIERS, false);
            checks.oneOf(at + ".difficulty", lineup.difficulty(), DIFFICULTIES, false);
            checks.text(at + ".summary", lineup.summary(), 1000, false);
            checks.text(at + ".notes", lineup.notes(), 2000, false);
            lineupUnits(checks, at + ".units", lineup.units(), units, items);
            checks.references(at + ".emblems", lineup.emblems(), traits, MAX_EMBLEMS);
            checks.references(at + ".blessingCodes", lineup.blessingCodes(), blessings, 5);
            lineupStages(checks, at + ".stages", lineup.stages(), units);
            checks.references(at + ".priorityItemCodes", lineup.priorityItemCodes(), items, MAX_PRIORITY_ITEMS);
        }
    }

    /** Early and mid game boards: each stage once, known units once each. */
    private static void lineupStages(ContentChecks checks, String at, List<LineupStage> stages, Set<String> units) {
        checks.size(at, stages, LINEUP_STAGES.size());
        var seen = new HashSet<String>();
        for (int s = 0; s < stages.size(); s++) {
            var stage = stages.get(s);
            String stageAt = at + "[" + s + "]";
            checks.oneOf(stageAt + ".stage", stage.stage(), LINEUP_STAGES, true);
            if (stage.stage() != null && !seen.add(stage.stage())) {
                checks.fail(stageAt + ".stage", "DUPLICATE_STAGE", "Each stage appears once.");
            }

            checks.references(stageAt + ".unitCodes", stage.unitCodes(), units, MAX_LINEUP_UNITS);
            checks.text(stageAt + ".note", stage.note(), 500, false);
        }
    }

    /** Shared by editorial and community lineups: known units once each, known items, valid rows and free cells. */
    public static void lineupUnits(ContentChecks checks, String at, List<LineupUnit> lineupUnits, Set<String> units,
            Set<String> items) {
        checks.size(at, lineupUnits, MAX_LINEUP_UNITS);
        var codes = lineupUnits.stream().map(LineupUnit::unitCode).collect(Collectors.toList());
        checks.references(at + "[].unitCode", codes, units, MAX_LINEUP_UNITS);
        var cells = new HashSet<String>();
        for (int u = 0; u < lineupUnits.size(); u++) {
            var unit = lineupUnits.get(u);
            checks.oneOf(at + "[" + u + "].row", unit.row(), ROWS, false);
            checks.range(at + "[" + u + "].column", unit.column(), 1, BOARD_COLUMNS, false);
            if (unit.column() != null && unit.row() == null) {
                checks.fail(at + "[" + u + "].row", "REQUIRED", "A unit with a column needs a row.");
            }
            if (unit.column() != null && unit.row() != null && !cells.add(unit.row() + "-" + unit.column())) {
                checks.fail(at + "[" + u + "].column", "DUPLICATE_CELL", "Two units stand on one cell.");
            }

            checks.size(at + "[" + u + "].itemCodes", unit.itemCodes(), MAX_ITEMS_PER_UNIT);
            for (int x = 0; x < unit.itemCodes().size(); x++) {
                if (!items.contains(unit.itemCodes().get(x))) {
                    checks.fail(at + "[" + u + "].itemCodes[" + x + "]", "UNKNOWN_REFERENCE",
                            "No item has this code.");
                }
            }
        }
    }
}
