package com.wikiaov.community.tournament.internal.planning.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Entry;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.EntryStatus;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Match;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Slot;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionResults.Resolved;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionResults.Standing;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionResults.Table;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class CompetitionResultsTest {
    private static final UUID ANNA = new UUID(0, 1);
    private static final UUID BORIS = new UUID(0, 2);
    private static final UUID CLARA = new UUID(0, 3);
    private static final UUID DAVID = new UUID(0, 4);

    @Test
    void aDrawnMatchHasNeitherAWinnerNorALoser() {
        var drawn = result("M1", ANNA, BORIS, 1, 1);

        assertThat(drawn.played()).isTrue();
        assertThat(drawn.winner()).isNull();
        assertThat(drawn.loser()).isNull();
    }

    @Test
    void aMatchWithoutAResultOrWithOtherTeamsIsNotPlayed() {
        assertThat(result("M1", ANNA, BORIS, null, null).played()).isFalse();
        assertThat(new Resolved("M1", ANNA, BORIS, 2, 0, null, false).played()).isFalse();
        assertThat(new Resolved("M1", ANNA, BORIS, 2, 0, null, false).winner()).isNull();
    }

    @Test
    void aDrawnMatchIsPlayedWithoutBeingWonOrLost() {
        var table = table(List.of(), result("M1", ANNA, BORIS, 1, 1), result("M2", ANNA, CLARA, 2, 0),
                result("M3", BORIS, CLARA, 2, 0));

        assertThat(table.complete()).isTrue();
        assertThat(row(table, ANNA)).extracting(Standing::played, Standing::won, Standing::lost)
                .containsExactly(2, 1, 0);
        assertThat(row(table, CLARA)).extracting(Standing::played, Standing::won, Standing::lost)
                .containsExactly(2, 0, 2);
    }

    @Test
    void aDrawGivesBothTeamsThePointsOfALostMatch() {
        int winPoints = 3;
        int lossPoints = 1;

        var table = table(List.of(), 1, winPoints, lossPoints, 1, result("M1", ANNA, BORIS, 1, 1));

        assertThat(table.rows()).extracting(Standing::points).containsExactly(lossPoints, lossPoints);
    }

    @Test
    void aRowCarriesItsGamesWonItsGamesLostAndItsPoints() {
        int winPoints = 3;
        int lossPoints = 0;

        var table = table(List.of(), 1, winPoints, lossPoints, 1, result("M1", ANNA, BORIS, 2, 0),
                result("M2", CLARA, ANNA, 1, 1));

        assertThat(row(table, ANNA)).extracting(Standing::gameWins, Standing::gameLosses, Standing::points)
                .containsExactly(3, 1, winPoints + lossPoints);
    }

    @Test
    void aTableIsCompleteOnceEveryMatchWasPlayed() {
        assertThat(table(List.of(), result("M1", ANNA, BORIS, 1, 1), result("M2", ANNA, CLARA, 2, 0),
                result("M3", BORIS, CLARA, null, null)).complete()).isFalse();
    }

    @Test
    void theFirstTeamsOfACompleteTableQualify() {
        int advance = 2;

        var table = table(List.of(), 1, 1, 0, advance, result("M1", ANNA, BORIS, 2, 0),
                result("M2", ANNA, CLARA, 2, 0), result("M3", BORIS, CLARA, 2, 0));

        assertThat(table.rows()).filteredOn(Standing::qualified).extracting(Standing::teamId)
                .containsExactly(ANNA, BORIS);
    }

    @Test
    void nobodyQualifiesWhileTheTableIsIncomplete() {
        int advance = 2;

        var table = table(List.of(), 1, 1, 0, advance, result("M1", ANNA, BORIS, 2, 0),
                result("M2", ANNA, CLARA, 2, 0), result("M3", BORIS, CLARA, null, null));

        assertThat(table.rows()).noneMatch(Standing::qualified);
    }

    @Test
    void levelTeamsOfWhichOnlySomeCouldAdvanceDoNotQualify() {
        int advance = 1;

        var table = table(List.of(), 1, 1, 0, advance, result("M1", ANNA, BORIS, 1, 1),
                result("M2", ANNA, CLARA, 2, 0), result("M3", BORIS, CLARA, 2, 0));

        assertThat(table.complete()).isTrue();
        assertThat(table.rows()).noneMatch(Standing::qualified);
    }

    @Test
    void ofTwoLevelTeamsTheOneWithTheLargerGameDifferenceComesFirst() {
        var table = table(List.of("GAME_DIFF", "GAME_WINS"), result("M1", ANNA, BORIS, 2, 0),
                result("M2", ANNA, CLARA, 0, 2), result("M3", ANNA, DAVID, 1, 1));

        // One win each for Anna and Clara; Anna also lost a match and drew one, and so won more games than Clara.
        assertThat(table.rows()).extracting(Standing::teamId).containsExactly(CLARA, ANNA, DAVID, BORIS);
    }

    @Test
    void ofTwoTeamsWithTheSameGameDifferenceTheOneThatWonMoreGamesComesFirst() {
        var table = table(List.of("GAME_DIFF", "GAME_WINS"), result("M1", ANNA, BORIS, null, null),
                result("M2", ANNA, CLARA, 2, 0), result("M3", ANNA, DAVID, 0, 2), result("M4", BORIS, CLARA, 2, 0),
                result("M5", BORIS, DAVID, 2, 0), result("M6", CLARA, DAVID, 1, 1));

        // A win and a defeat each for Anna and David; David also drew a match, Anna still has one to play.
        assertThat(table.rows()).extracting(Standing::teamId).containsExactly(BORIS, DAVID, ANNA, CLARA);
    }

    @Test
    void threeTeamsThatBeatEachOtherInTurnStayLevel() {
        var table = table(List.of("HEAD_TO_HEAD"), result("M1", ANNA, BORIS, 0, 2), result("M2", ANNA, CLARA, 2, 0),
                result("M3", BORIS, CLARA, 0, 2));

        assertThat(table.rows()).allMatch(Standing::tied);
    }

    @Test
    void theMatchOfTwoLevelTeamsTellsThemApart() {
        var table = table(List.of("HEAD_TO_HEAD"), result("M1", ANNA, BORIS, 2, 0), result("M2", ANNA, CLARA, 2, 0),
                result("M3", ANNA, DAVID, 0, 2), result("M4", BORIS, CLARA, 2, 0), result("M5", BORIS, DAVID, 2, 0),
                result("M6", CLARA, DAVID, 2, 0));

        // Two wins each for Anna and Boris, and Anna won their match; one each for Clara and David, who lost to Clara.
        assertThat(table.rows()).extracting(Standing::teamId).containsExactly(ANNA, BORIS, CLARA, DAVID);
        assertThat(table.rows()).noneMatch(Standing::tied);
    }

    @Test
    void aDrawnLegCountsAmongTheMatchesOfTwoLevelTeams() {
        var table = table(List.of("HEAD_TO_HEAD"), 2, result("M1", ANNA, BORIS, 1, 1), result("M2", BORIS, ANNA, 2, 0),
                result("M3", ANNA, CLARA, 2, 0), result("M4", CLARA, ANNA, 1, 1), result("M5", BORIS, CLARA, 1, 1),
                result("M6", CLARA, BORIS, 1, 1));

        // One win each for Anna and Boris; they met twice, and Boris won the match that was not drawn.
        assertThat(table.rows()).extracting(Standing::teamId).containsExactly(BORIS, ANNA, CLARA);
        assertThat(table.rows()).noneMatch(Standing::tied);
    }

    @Test
    void aDrawBetweenLevelTeamsIsAMatchTheyPlayedAndLeavesThemLevel() {
        var table = table(List.of("HEAD_TO_HEAD", "GAME_DIFF"), result("M1", ANNA, BORIS, 1, 1),
                result("M2", ANNA, CLARA, 2, 0), result("M3", BORIS, CLARA, 2, 0));

        assertThat(row(table, ANNA).tied()).isTrue();
        assertThat(row(table, BORIS).rank()).isEqualTo(row(table, ANNA).rank());
        assertThat(row(table, CLARA).rank()).isEqualTo(3);
    }

    private static Standing row(Table table, UUID team) {
        return table.rows().stream().filter(row -> row.teamId().equals(team)).findFirst().orElseThrow();
    }

    private static Resolved result(String key, UUID a, UUID b, Integer scoreA, Integer scoreB) {
        return new Resolved(key, a, b, scoreA, scoreB, null, true);
    }

    private static Table table(List<String> tieBreakers, Resolved... results) {
        return table(tieBreakers, 1, results);
    }

    private static Table table(List<String> tieBreakers, int legs, Resolved... results) {
        return table(tieBreakers, legs, 1, 0, 1, results);
    }

    private static Table table(List<String> tieBreakers, int legs, int winPoints, int lossPoints, int advance,
            Resolved... results) {
        var stage = new Stage("GROUP", "Group", "ROUND_ROBIN", 2, legs, winPoints, lossPoints, advance, tieBreakers, "",
                null, null, null, null, null);
        var entrants = Stream.of(results).flatMap(result -> Stream.of(result.teamAId(), result.teamBId())).distinct()
                .map(team -> new Entry(team, null, EntryStatus.REGISTERED, "")).toList();
        var matches = List.of(results).stream().map(result -> new Match(result.key(), "GROUP", 1, "", 2, null,
                Slot.team(result.teamAId()), Slot.team(result.teamBId()), null, null)).toList();
        var plan = new CompetitionPlan("", "", null, null, "", "", "", "", null, entrants, List.of(stage), null,
                matches, null);

        return CompetitionResults.tables(plan, List.of(results)).getFirst();
    }
}
