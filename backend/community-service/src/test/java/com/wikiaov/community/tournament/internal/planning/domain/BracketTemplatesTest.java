package com.wikiaov.community.tournament.internal.planning.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.community.tournament.internal.domain.MatchTitle;
import com.wikiaov.community.tournament.internal.domain.MatchTitle.Kind;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Entry;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Match;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Slot;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class BracketTemplatesTest {
    private static Stage stage(String format) {
        return new Stage("PO", "Playoffs", format, 5, 1, 1, 0, 1, List.of(), "", null, null, null, null, null);
    }

    private static CompetitionPlan plan(Stage stage, int teams, List<Match> matches) {
        var entries = IntStream.rangeClosed(1, teams).mapToObj(seed -> new Entry(UUID.randomUUID(), seed, null, ""))
                .toList();
        return new CompetitionPlan("", "", null, null, "", "", "", "", null, entries, List.of(stage), null, matches,
                null);
    }

    private static Match titled(List<Match> matches, Kind kind) {
        return matches.stream().filter(match -> match.title().kind() == kind).findFirst().orElseThrow();
    }

    @ParameterizedTest
    @ValueSource(ints = {2, 3, 5, 6, 8, 11, 16, 24, 64})
    void aKnockoutOfAnySizePlaysOneMatchFewerThanItsTeams(int teams) {
        var stage = stage("SINGLE_ELIMINATION");

        var matches = BracketTemplates.singleElimination(stage, teams, false);

        CompetitionRules.validate(plan(stage, teams, matches));
        assertThat(matches).hasSize(teams - 1);
        assertThat(matches.getLast().title()).isEqualTo(MatchTitle.of(Kind.FINAL));
    }

    @Test
    void theHighestSeedsOfSixSkipTheFirstRoundAndMeetOnlyInTheFinal() {
        var matches = BracketTemplates.singleElimination(stage("SINGLE_ELIMINATION"), 6, false);

        assertThat(matches.get(0).a()).isEqualTo(Slot.seed(4));
        assertThat(matches.get(0).b()).isEqualTo(Slot.seed(5));
        assertThat(matches.get(1).a()).isEqualTo(Slot.seed(3));
        assertThat(matches.get(2).title()).isEqualTo(MatchTitle.numbered(Kind.SEMIFINAL, null, 1));
        assertThat(matches.get(2).a()).isEqualTo(Slot.seed(1));
        assertThat(matches.get(3).a()).isEqualTo(Slot.seed(2));
    }

    @Test
    void thirdPlaceIsPlayedByTheLosersOfTheSemifinals() {
        var matches = BracketTemplates.singleElimination(stage("SINGLE_ELIMINATION"), 8, true);

        var third = titled(matches, Kind.THIRD_PLACE);

        assertThat(List.of(third.a(), third.b())).containsExactly(Slot.outcome("PO_R4_1", false),
                Slot.outcome("PO_R4_2", false));
        assertThat(matches).hasSize(8);
    }

    @ParameterizedTest
    @ValueSource(ints = {4, 8, 16, 32})
    void aDoubleEliminationSendsEveryLoserOfTheUpperBracketToTheLowerOne(int teams) {
        var stage = stage("DOUBLE_ELIMINATION");

        var matches = BracketTemplates.doubleElimination(stage, teams);

        CompetitionRules.validate(plan(stage, teams, matches));
        assertThat(matches).hasSize(2 * teams - 2);
        var dropping = matches.stream().flatMap(match -> List.of(match.a(), match.b()).stream())
                .filter(slot -> "LOSER".equals(slot.type())).map(Slot::matchKey).toList();
        assertThat(dropping).doesNotHaveDuplicates().hasSize(teams - 1);
    }

    @Test
    void aDoubleEliminationOfFourNamesItsRoundsLikeTheAogPlayoffs() {
        var titles = BracketTemplates.doubleElimination(stage("DOUBLE_ELIMINATION"), 4).stream().map(Match::title)
                .toList();

        assertThat(titles).containsExactly(MatchTitle.numbered(Kind.UPPER_SEMIFINAL, null, 1),
                MatchTitle.numbered(Kind.UPPER_SEMIFINAL, null, 2), MatchTitle.numbered(Kind.LOWER_ROUND, 1, 1),
                MatchTitle.of(Kind.UPPER_FINAL), MatchTitle.of(Kind.LOWER_FINAL), MatchTitle.of(Kind.GRAND_FINAL));
    }

    @Test
    void losersOfTheUpperSemifinalsDropIntoTheOtherHalf() {
        var matches = BracketTemplates.doubleElimination(stage("DOUBLE_ELIMINATION"), 8);

        var first = matches.stream().filter(match -> match.key().equals("PO_L2_1")).findFirst().orElseThrow();

        assertThat(first.a()).isEqualTo(Slot.outcome("PO_U2_2", false));
        assertThat(first.b()).isEqualTo(Slot.outcome("PO_L1_1", true));
    }

    @Test
    void sizesABracketCannotHoldAreRefused() {
        assertThatThrownBy(() -> BracketTemplates.singleElimination(stage("SINGLE_ELIMINATION"), 1, false))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> BracketTemplates.doubleElimination(stage("DOUBLE_ELIMINATION"), 6))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
