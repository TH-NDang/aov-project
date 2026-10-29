package com.wikiaov.community.tournament.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SeriesPickRuleTest {
    private static final UUID ALPHA = new UUID(0, 1);
    private static final UUID BETA = new UUID(0, 2);

    @Test
    void aTeamCannotPickAgainAHeroItPlayedEarlierInTheSeries() {
        var first = game(1, ALPHA, List.of("Florentino", "Nakroth"), BETA, List.of("Lauriel"));
        // Teams swap sides in game 2; the rule follows the team.
        var second = game(2, BETA, List.of("Florentino"), ALPHA, List.of("Murad", " NAKROTH"));

        assertThat(SeriesPickRule.violations(second, 5, List.of(first)))
                .containsExactly("sides[1].participants[1].hero.usedInSeries");
        assertThat(SeriesPickRule.violations(first, 5, List.of(second)))
                .as("editing an earlier game cannot create a repeat in a later one either")
                .containsExactly("sides[0].participants[1].hero.usedInSeries");
    }

    @Test
    void theLastGameOfTheSeriesOpensEveryHeroAgain() {
        var first = game(1, ALPHA, List.of("Florentino"), BETA, List.of());
        var decider = game(3, ALPHA, List.of("Florentino"), BETA, List.of());

        assertThat(SeriesPickRule.violations(decider, 3, List.of(first))).isEmpty();
        assertThat(SeriesPickRule.violations(first, 3, List.of(decider))).isEmpty();
    }

    @Test
    void draftPickTurnsAreCheckedLikeLineUps() {
        var first = game(1, ALPHA, List.of("Florentino"), BETA, List.of());
        var second = game(2, ALPHA, List.of(), BETA, List.of());
        var turns = List.of(new DraftTurn(1, DraftKind.BAN, Side.RED, new Selection(null, "Florentino"), null),
                new DraftTurn(2, DraftKind.PICK, Side.BLUE, new Selection(null, "Florentino"), null));
        var drafted = new Game(second.seriesId(), 2, "VN", "vi-VN", null, null, null, null, null, null, null, null,
                second.sides(), false, null, new GameDraft(null, null, turns));

        assertThat(SeriesPickRule.violations(drafted, 5, List.of(first)))
                .containsExactly("draft.turns[1].hero.usedInSeries");
    }

    private static Game game(int number, UUID blue, List<String> blueHeroes, UUID red, List<String> redHeroes) {
        return new Game(null, number, "VN", "vi-VN", null, null, null, null, null, null, null, null,
                List.of(side(Side.BLUE, blue, blueHeroes), side(Side.RED, red, redHeroes)), false);
    }

    private static GameSide side(Side side, UUID team, List<String> heroes) {
        var participants = new ArrayList<Participant>();
        for (int index = 0; index < 5; index++)
            participants.add(new Participant(null, Lane.values()[index],
                    new Selection(null, index < heroes.size() ? heroes.get(index) : null), null, null, null, List.of(),
                    List.of(), null));
        return new GameSide(side, team, List.of(), participants);
    }
}
