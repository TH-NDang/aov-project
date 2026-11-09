package com.wikiaov.gamemode.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.gamemode.internal.domain.AutoChessContent.Lineup;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupStage;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.Trait;
import com.wikiaov.gamemode.internal.domain.AutoChessContent.TraitTier;
import com.wikiaov.platform.ApiFieldError;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AutoChessContentRulesTest {
    @Test
    void acceptsAConsistentGuide() {
        assertThat(AutoChessContentRules.validate(AutoChessFixtures.guide())).isEmpty();
        assertThat(AutoChessContentRules.missingFields(AutoChessFixtures.guide())).isEmpty();
    }

    @Test
    void rejectsUnitsThatPointAtUnknownTraits() {
        var guide = AutoChessFixtures.guide();
        var units = new ArrayList<>(guide.units());
        units.add(AutoChessFixtures.unit("raz", "Raz", 1, "phap-su"));
        var broken = new AutoChessContent(guide.edition(), null, null, null, guide.traits(), units, guide.itemGroups(),
                guide.items(), null, null, null, null);

        assertThat(codes(AutoChessContentRules.validate(broken))).contains("UNKNOWN_REFERENCE");
    }

    @Test
    void rejectsDuplicateCodesAndThresholdsThatDoNotIncrease() {
        var guide = AutoChessFixtures.guide();
        var traits = new ArrayList<>(guide.traits());
        traits.add(new Trait("dau-si", "FACTION", "Đấu sĩ lặp", null, null,
                List.of(new TraitTier(4, "a"), new TraitTier(2, "b")), null));
        var broken = new AutoChessContent(null, null, null, null, traits, guide.units(), null, null, null, null, null,
                null);

        assertThat(codes(AutoChessContentRules.validate(broken))).contains("DUPLICATE_CODE", "NOT_ASCENDING");
    }

    @Test
    void lineupsMayOnlyUseKnownUnitsOnceAndAtMostThreeItems() {
        var guide = AutoChessFixtures.guide();
        var lineup = new Lineup(UUID.randomUUID(), "sai", "Sai", "Z", null, null,
                List.of(new LineupUnit("violet", true, "BACK", null, List.of("thanh-kiem", "a", "b", "c")),
                        new LineupUnit("violet", false, "SIDE", null, List.of()),
                        new LineupUnit("khong-co", false, null, null, List.of())),
                List.of(), List.of(), null, List.of(), List.of("thanh-kiem", "khong-co"));
        var broken = guide.withLineups(List.of(lineup));

        assertThat(codes(AutoChessContentRules.validate(broken))).contains("INVALID_VALUE", "DUPLICATE_REFERENCE",
                "UNKNOWN_REFERENCE", "TOO_MANY");
    }

    @Test
    void lineupUnitsStandOnFreeCellsOfTheBoard() {
        var guide = AutoChessFixtures.guide();
        var lineup = guide.lineups().getFirst();
        var placed = List.of(new LineupUnit("violet", true, "BACK", 4, List.of()),
                new LineupUnit("florentino", false, "FRONT", 4, List.of()),
                new LineupUnit("amily", false, "FRONT", 3, List.of()));
        var crowded = List.of(new LineupUnit("violet", true, "BACK", 4, List.of()),
                new LineupUnit("florentino", false, "BACK", 4, List.of()),
                new LineupUnit("amily", false, null, 8, List.of()));

        assertThat(AutoChessContentRules.validate(guide.withLineups(List.of(withUnits(lineup, placed))))).isEmpty();
        assertThat(codes(AutoChessContentRules.validate(guide.withLineups(List.of(withUnits(lineup, crowded))))))
                .contains("DUPLICATE_CELL", "OUT_OF_RANGE", "REQUIRED");
    }

    private static Lineup withUnits(Lineup lineup, List<LineupUnit> units) {
        return new Lineup(lineup.id(), lineup.code(), lineup.name(), lineup.tier(), lineup.difficulty(),
                lineup.summary(), units, lineup.emblems(), lineup.blessingCodes(), lineup.notes(), lineup.stages(),
                lineup.priorityItemCodes());
    }

    @Test
    void lineupStagesAreEarlyOrMidOnceEachWithKnownUnits() {
        var guide = AutoChessFixtures.guide();
        var lineup = guide.lineups().getFirst();
        var staged = new Lineup(lineup.id(), lineup.code(), lineup.name(), lineup.tier(), lineup.difficulty(),
                lineup.summary(), lineup.units(), lineup.emblems(), lineup.blessingCodes(), lineup.notes(),
                List.of(new LineupStage("EARLY", List.of("violet", "amily"), "Giữ máu"),
                        new LineupStage("MID", List.of("violet", "florentino", "amily"), null)),
                List.of("thanh-kiem"));

        assertThat(AutoChessContentRules.validate(guide.withLineups(List.of(staged)))).isEmpty();

        var broken = new Lineup(lineup.id(), lineup.code(), lineup.name(), lineup.tier(), lineup.difficulty(),
                lineup.summary(), lineup.units(), lineup.emblems(), lineup.blessingCodes(), lineup.notes(),
                List.of(new LineupStage("EARLY", List.of("violet"), null),
                        new LineupStage("EARLY", List.of("khong-co"), null), new LineupStage("LATE", List.of(), null)),
                List.of());

        assertThat(codes(AutoChessContentRules.validate(guide.withLineups(List.of(broken))))).contains("TOO_MANY",
                "DUPLICATE_STAGE", "UNKNOWN_REFERENCE", "INVALID_VALUE");
    }

    @Test
    void unitsMayCostUpToSixGoldAndHaveNoTrait() {
        var guide = AutoChessFixtures.guide();
        var units = new ArrayList<>(guide.units());
        units.add(AutoChessFixtures.unit("edras", "Edras", 6, "dau-si"));
        units.add(AutoChessFixtures.unit("ignis", "Ignis", 5));
        var withTopCost = new AutoChessContent(null, null, null, null, guide.traits(), units, null, null, null, null,
                null, null);

        assertThat(AutoChessContentRules.validate(withTopCost)).isEmpty();
        assertThat(AutoChessContentRules.missingFields(withTopCost)).isEmpty();

        units.add(AutoChessFixtures.unit("qua-dat", "Quá đắt", 7, "dau-si"));
        var tooExpensive = new AutoChessContent(null, null, null, null, guide.traits(), units, null, null, null, null,
                null, null);
        assertThat(codes(AutoChessContentRules.validate(tooExpensive))).contains("OUT_OF_RANGE");
    }

    @Test
    void draftsMayBeIncompleteButPublicationNeedsCompleteUnits() {
        var guide = AutoChessFixtures.guide();
        var units = new ArrayList<>(guide.units());
        units.add(new AutoChessContent.Unit("rourke", "Rourke", 3, List.of("dau-si"), null, null, null, null, true,
                null));
        units.add(new AutoChessContent.Unit("jinna", "Jinna", 4, List.of(), null, null, null, null, false, null));
        var draft = new AutoChessContent(null, null, null, null, guide.traits(), units, null, null, null, null, null,
                null);

        assertThat(AutoChessContentRules.validate(draft)).isEmpty();
        assertThat(AutoChessContentRules.missingFields(draft)).containsExactly("units[4].portraitAssetId",
                "units[4].skill.name", "units[4].stats");
        assertThat(AutoChessContentRules.missingFields(AutoChessContent.empty())).containsExactly("units", "traits");
    }

    @Test
    void keepsLineupIdsAndAssignsMissingOnes() {
        var guide = AutoChessFixtures.guide();
        var fresh = new Lineup(null, "moi", "Mới", null, null, null, List.of(), List.of(), List.of(), null,
                List.of(), List.of());
        var withNew = guide.withLineups(List.of(guide.lineups().getFirst(), fresh));
        var assigned = UUID.randomUUID();

        var result = AutoChessContentRules.assignLineupIds(withNew, () -> assigned);

        assertThat(result.lineups()).extracting(Lineup::id).containsExactly(AutoChessFixtures.LINEUP_ID, assigned);
        assertThat(AutoChessContentRules.assignLineupIds(guide, UUID::randomUUID)).isSameAs(guide);
    }

    private static List<String> codes(List<ApiFieldError> errors) {
        return errors.stream().map(ApiFieldError::code).toList();
    }
}
