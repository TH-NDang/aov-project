package com.wikiaov.community.tournament.internal.games.domain;

import static com.wikiaov.community.testsupport.GameContentFixtures.named;
import static com.wikiaov.community.testsupport.GameContentFixtures.selection;
import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftTurn;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Game;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.GameDraft;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class DraftRulesTest {
    @Test
    void aDraftOfMoreThanFortyTurnsIsRejectedWithoutCheckingEachTurn() {
        var turns = IntStream.rangeClosed(1, 41).mapToObj(order -> new DraftTurn(order, null, null, null, null))
                .toList();

        assertThat(violations(null, new GameDraft(null, null, turns))).containsExactly("draft.maximum");
    }

    @Test
    void aDraftStartLaterThanTwoDaysOfVideoIsOutOfRange() {
        assertThat(violations(null, new GameDraft(172_801, null, List.of())))
                .containsExactly("draft.startSecond.range");
    }

    @Test
    void theDraftStartsBeforeTheGameStartsOnTheVideo() {
        assertThat(violations(100, new GameDraft(150, null, List.of())))
                .containsExactly("draft.startSecond.afterGameStart");
    }

    @Test
    void everyTurnNamesItsKindAndItsSide() {
        var turn = new DraftTurn(1, null, null, null, null);

        assertThat(violations(null, new GameDraft(null, null, List.of(turn))))
                .containsExactly("draft.turns[0].kind", "draft.turns[0].side");
    }

    @Test
    void aSideBansAtMostFourHeroes() {
        assertThat(violations(null, new GameDraft(null, null, turns(DraftKind.BAN, 5))))
                .containsExactly("draft.turns[4].maximum");
    }

    @Test
    void aSidePicksAtMostFiveHeroes() {
        assertThat(violations(null, new GameDraft(null, null, turns(DraftKind.PICK, 6))))
                .containsExactly("draft.turns[5].maximum");
    }

    @Test
    void turnsAreMarkedOnTheVideoInTheOrderTheyWereTaken() {
        var turns = List.of(new DraftTurn(1, DraftKind.BAN, Side.BLUE, selection(1), 120),
                new DraftTurn(2, DraftKind.BAN, Side.RED, selection(2), 110));

        assertThat(violations(null, new GameDraft(100, 200, turns))).containsExactly("draft.turns[1].atSecond.order");
    }

    @Test
    void aHeroNamedInATurnKeepsTheLengthLimitOfEverySelection() {
        var turn = new DraftTurn(1, DraftKind.PICK, Side.BLUE, named("x".repeat(201)), null);

        assertThat(violations(null, new GameDraft(null, null, List.of(turn))))
                .containsExactly("draft.turns[0].hero.name.length");
    }

    private static List<DraftTurn> turns(DraftKind kind, int count) {
        var turns = new ArrayList<DraftTurn>();
        for (int order = 1; order <= count; order++) {
            turns.add(new DraftTurn(order, kind, Side.BLUE, selection(order), null));
        }
        return turns;
    }

    private static List<String> violations(@Nullable Integer liveSecond, GameDraft draft) {
        var game = new Game(null, null, null, null, null, null, null, null, null, null, liveSecond, null, List.of(),
                false, null, draft);
        var errors = new ArrayList<String>();
        DraftRules.check(game, errors);
        return errors;
    }
}
