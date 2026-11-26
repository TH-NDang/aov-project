package com.wikiaov.community.tournament.internal.statistics.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftTurn;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Lane;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupBan;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupHero;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupPick;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupPlayer;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.Lineups;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.LineupSide;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.Seat;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class LineupListTest {
    private static final UUID FLORENTINO = UUID.randomUUID();
    private static final UUID PLAYER = UUID.randomUUID();
    private static final UUID TEAM = UUID.randomUUID();

    @Test
    void aGameNamesItsHeroesAndPlayersByTheirPlaceInTheLists() {
        var first = game(side(Side.BLUE, List.of(), seat("Airi", Lane.MID, PLAYER)));
        var second = game(side(Side.RED, List.of(named("Airi")), seat("Veera", Lane.MID, PLAYER)));

        var lineups = list(first, second);

        assertThat(lineups.heroes()).extracting(LineupHero::name).containsExactly("Airi", "Veera");
        assertThat(lineups.players()).containsExactly(new LineupPlayer(PLAYER, null));
        assertThat(lineups.games().get(0).blue().picks()).containsExactly(new LineupPick(0, Lane.MID, 0, null));
        assertThat(lineups.games().get(1).red().picks()).containsExactly(new LineupPick(1, Lane.MID, 0, null));
        assertThat(lineups.games().get(1).red().bans()).containsExactly(new LineupBan(0, null));
    }

    @Test
    void picksComeByLaneAndThoseWithoutOneLast() {
        var game = game(side(Side.BLUE, List.of(), seat("Nowhere", null, null), seat("Helper", Lane.SUPPORT, null),
                seat("Fighter", Lane.TOP, null)));

        var lineups = list(game);

        assertThat(lineups.games().getFirst().blue().picks())
                .extracting(pick -> lineups.heroes().get(pick.hero()).name())
                .containsExactly("Fighter", "Helper", "Nowhere");
    }

    @Test
    void aTurnOfTheDraftIsThatOfItsSideItsKindAndItsHero() {
        var turns = List.of(turn(1, DraftKind.BAN, Side.BLUE, "Veera"), turn(2, DraftKind.BAN, Side.RED, "Veera"),
                turn(5, DraftKind.PICK, Side.BLUE, "Airi"));
        var game = game(turns, side(Side.BLUE, List.of(named("Veera")), seat("Airi", Lane.MID, null)),
                side(Side.RED, List.of(named("Veera"))));

        var lineup = list(game).games().getFirst();

        assertThat(lineup.blue().picks()).extracting(LineupPick::turn).containsExactly(5);
        assertThat(lineup.blue().bans()).extracting(LineupBan::turn).containsExactly(1);
        assertThat(lineup.red().bans()).extracting(LineupBan::turn).containsExactly(2);
    }

    @Test
    void bansComeByTheirTurn() {
        var turns = List.of(turn(1, DraftKind.BAN, Side.RED, "First"), turn(3, DraftKind.BAN, Side.RED, "Second"));
        var game = game(turns, side(Side.RED, List.of(named("Unseen"), named("Second"), named("First"))));

        var lineups = list(game);

        assertThat(lineups.games().getFirst().red().bans())
                .extracting(ban -> lineups.heroes().get(ban.hero()).name())
                .containsExactly("First", "Second", "Unseen");
    }

    @Test
    void aBanListedTwiceForOneSideIsListedOnce() {
        var game = game(side(Side.BLUE, List.of(named("Veera"), named("veera "))));

        assertThat(list(game).games().getFirst().blue().bans()).hasSize(1);
    }

    @Test
    void aMissingOrEmptySelectionIsNoHero() {
        var empty = Arrays.asList(new Selection(null, null), new Selection(null, " "), null);
        var game = game(new LineupSide(Side.BLUE, TEAM, empty,
                List.of(new Seat(null, Lane.TOP, PLAYER, null, List.of(), null, List.of()))));

        var lineups = list(game);

        assertThat(lineups.heroes()).isEmpty();
        assertThat(lineups.games().getFirst().blue().picks()).isEmpty();
        assertThat(lineups.games().getFirst().blue().bans()).isEmpty();
    }

    @Test
    void aHeroRecordedByItsNameAloneIsTheOneWithAnIdOfThatName() {
        var game = game(
                side(Side.BLUE, List.of(), new Seat(new Selection(FLORENTINO, "Florentino"), Lane.TOP, null, null,
                        List.of(), null, List.of())),
                side(Side.RED, List.of(named("florentino"))));

        var lineups = list(game);

        assertThat(lineups.heroes()).containsExactly(new LineupHero(FLORENTINO, null, "Florentino", null));
        assertThat(lineups.games().getFirst().red().bans()).containsExactly(new LineupBan(0, null));
    }

    @Test
    void aSideTheGameDoesNotHaveIsLeftOut() {
        var lineup = list(game(side(Side.BLUE, List.of()))).games().getFirst();

        assertThat(lineup.blue().teamId()).isEqualTo(TEAM);
        assertThat(lineup.red()).isNull();
    }

    @Test
    void aLengthOfZeroSecondsIsNotKnown() {
        var lineup = list(new PublishedLineup(UUID.randomUUID(), Instant.EPOCH, UUID.randomUUID(), 1, null, 0, PLAYER,
                List.of(), List.of(), null, null)).games().getFirst();

        assertThat(lineup.seconds()).isNull();
        assertThat(lineup.mvp()).isZero();
    }

    @Test
    void aPlayerKeepsTheNicknameOfTheNewestGameThatKnowsOne() {
        var other = UUID.randomUUID();
        var newest = known(Map.of(other, "Kawhi"), seat("Airi", Lane.MID, PLAYER), seat("Veera", Lane.TOP, other));
        var older = known(Map.of(PLAYER, "YuXiang "), seat("Airi", Lane.MID, PLAYER));
        var oldest = known(Map.of(PLAYER, "Former name", other, "Another name"), seat("Airi", Lane.MID, PLAYER));

        assertThat(list(newest, older, oldest).players()).containsExactlyInAnyOrder(
                new LineupPlayer(PLAYER, "YuXiang"), new LineupPlayer(other, "Kawhi"));
    }

    private static Lineups list(PublishedLineup... games) {
        var lineups = List.of(games);

        return LineupList.of(lineups, HeroRoll.of(lineups));
    }

    private static Selection named(String name) {
        return new Selection(null, name);
    }

    private static Seat seat(String hero, @Nullable Lane lane, @Nullable UUID player) {
        return new Seat(named(hero), lane, player, null, List.of(), null, List.of());
    }

    private static LineupSide side(Side side, List<@Nullable Selection> bans, Seat... seats) {
        return new LineupSide(side, TEAM, bans, List.of(seats));
    }

    private static DraftTurn turn(int order, DraftKind kind, Side side, String hero) {
        return new DraftTurn(order, kind, side, named(hero), null);
    }

    private static PublishedLineup game(LineupSide... sides) {
        return game(List.of(), sides);
    }

    private static PublishedLineup game(List<DraftTurn> turns, LineupSide... sides) {
        return new PublishedLineup(UUID.randomUUID(), Instant.EPOCH, UUID.randomUUID(), 1, Side.BLUE, 900, null,
                List.of(sides), turns, null, null);
    }

    private static PublishedLineup known(Map<UUID, String> players, Seat... seats) {
        return new PublishedLineup(UUID.randomUUID(), Instant.EPOCH, UUID.randomUUID(), 1, Side.BLUE, 900, null,
                List.of(side(Side.BLUE, List.of(), seats)), List.of(), players, null);
    }
}
