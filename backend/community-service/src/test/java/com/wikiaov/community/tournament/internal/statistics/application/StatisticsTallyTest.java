package com.wikiaov.community.tournament.internal.statistics.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameLength;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.HeroCount;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.MvpCount;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.KnownHero;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.LineupSide;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class StatisticsTallyTest {
    private static final UUID FLORENTINO = UUID.randomUUID();

    @Test
    void aBanListedTwiceForOneSideCountsOnce() {
        var game = game(Side.BLUE, side(Side.BLUE, List.of(named("Veera"), named("veera ")), List.of()),
                side(Side.RED, List.of(named("Veera")), List.of()));

        assertThat(StatisticsTally.of(List.of(game)).heroes())
                .containsExactly(count(null, "Veera", 0, 0, 2, 0));
    }

    @Test
    void anEmptyOrMissingSelectionIsNoHero() {
        var empty = Arrays.asList(new Selection(null, null), new Selection(null, " "), null);
        var game = game(Side.BLUE, side(Side.BLUE, empty, empty));

        assertThat(StatisticsTally.of(List.of(game)).heroes()).isEmpty();
    }

    @Test
    void aPickWinsOnlyInADecidedGame() {
        var picked = side(Side.RED, List.of(), List.of(named("Veera")));

        var statistics = StatisticsTally.of(List.of(game(Side.RED, picked), game(null, picked)));

        assertThat(statistics.heroes()).containsExactly(count(null, "Veera", 2, 1, 0, 0));
    }

    @Test
    void aHeroRecordedByItsNameAloneJoinsTheOneWithAnIdOfThatName() {
        var game = game(null, side(Side.BLUE, List.of(), List.of(new Selection(FLORENTINO, "Florentino"))),
                side(Side.RED, List.of(named("florentino ")), List.of()));

        assertThat(StatisticsTally.of(List.of(game)).heroes())
                .containsExactly(count(FLORENTINO, "Florentino", 1, 0, 1, 1));
    }

    @Test
    void aNameTwoHeroesGoByJoinsNeither() {
        var other = UUID.randomUUID();
        var game = game(null,
                side(Side.BLUE, List.of(),
                        List.of(new Selection(FLORENTINO, "Florentino"), new Selection(other, "Florentino"))),
                side(Side.RED, List.of(named("Florentino")), List.of()));

        assertThat(StatisticsTally.of(List.of(game)).heroes()).hasSize(3)
                .contains(count(null, "Florentino", 0, 0, 1, 0));
    }

    @Test
    void aHeroCarriesTheCodeAndThePictureOfTheNewestCatalogThatHasThem() {
        var sides = List.of(side(Side.BLUE, List.of(), List.of(new Selection(FLORENTINO, "Florentino"))));
        var newer = lineup(sides, new KnownHero(FLORENTINO, "florentino", "Florentino", null));
        var older = lineup(sides, new KnownHero(FLORENTINO, "old-code", "Florentino", "https://img/florentino.jpg"));

        assertThat(StatisticsTally.of(List.of(newer, older)).heroes()).containsExactly(
                new HeroCount(FLORENTINO, "florentino", "Florentino", "https://img/florentino.jpg", 2, 0, 0, 2));
    }

    @Test
    void aHeroTheNewestGameKnowsByItsIdAloneTakesItsNameFromAnOlderOne() {
        var newer = game(null, side(Side.BLUE, List.of(new Selection(FLORENTINO, null)), List.of()));
        var older = game(null, side(Side.BLUE, List.of(new Selection(FLORENTINO, "Florentino")), List.of()));

        assertThat(StatisticsTally.of(List.of(newer, older)).heroes())
                .containsExactly(count(FLORENTINO, "Florentino", 0, 0, 2, 0));
    }

    @Test
    void heroesComeByPicksAndBansThenByPicksThenByName() {
        var game = game(null,
                side(Side.BLUE, List.of(named("Banned once"), named("Both")),
                        List.of(named("Zephys"), named("Airi"), named("Twice"))),
                side(Side.RED, List.of(named("Twice")), List.of(named("Both"))));

        assertThat(StatisticsTally.of(List.of(game)).heroes()).extracting(HeroCount::name)
                .containsExactly("Both", "Twice", "Airi", "Zephys", "Banned once");
    }

    @Test
    void theAverageLengthIsRounded() {
        var games = List.of(lasting(1000), lasting(1001));

        assertThat(StatisticsTally.of(games).averageSeconds()).isEqualTo(1001);
    }

    @Test
    void aLengthOfZeroSecondsIsNotKnown() {
        var zero = lasting(0);
        var known = lasting(900);

        var statistics = StatisticsTally.of(List.of(zero, known));

        assertThat(statistics.averageSeconds()).isEqualTo(900);
        assertThat(statistics.shortest()).isEqualTo(new GameLength(known.id(), 900));
    }

    @Test
    void ofTwoGamesOfTheSameLengthTheNewerStands() {
        var newer = lasting(900);
        var older = lasting(900);

        var statistics = StatisticsTally.of(List.of(newer, older));

        assertThat(statistics.longest()).isEqualTo(new GameLength(newer.id(), 900));
        assertThat(statistics.shortest()).isEqualTo(new GameLength(newer.id(), 900));
    }

    @Test
    void atMostTenMvpsAreNamedAndEqualOnesComeByTheirId() {
        var games = new ArrayList<PublishedLineup>();
        var players = IntStream.range(0, 11).mapToObj(number -> new UUID(number == 0 ? Long.MIN_VALUE : number, 1))
                .toList();
        players.forEach(player -> games.add(withMvp(player)));
        games.add(withMvp(players.get(5)));

        var mvps = StatisticsTally.of(games).mvps();

        assertThat(mvps).hasSize(10);
        assertThat(mvps.getFirst()).isEqualTo(new MvpCount(players.get(5), 2));
        assertThat(mvps.get(1)).isEqualTo(new MvpCount(players.get(1), 1));
        assertThat(mvps).extracting(MvpCount::playerId).doesNotContain(players.get(0));
    }

    private static Selection named(String name) {
        return new Selection(null, name);
    }

    private static LineupSide side(Side side, List<@Nullable Selection> bans, List<@Nullable Selection> picks) {
        return new LineupSide(side, bans, picks);
    }

    private static PublishedLineup game(@Nullable Side winner, LineupSide... sides) {
        return lineup(winner, null, null, List.of(sides));
    }

    private static PublishedLineup lasting(int seconds) {
        return lineup(null, seconds, null, List.of());
    }

    private static PublishedLineup withMvp(UUID player) {
        return lineup(null, null, player, List.of());
    }

    private static HeroCount count(@Nullable UUID id, String name, int picks, int wins, int bans, int bluePicks) {
        return new HeroCount(id, null, name, null, picks, wins, bans, bluePicks);
    }

    private static PublishedLineup lineup(List<LineupSide> sides, KnownHero hero) {
        return new PublishedLineup(UUID.randomUUID(), Instant.EPOCH, null, null, null, sides, List.of(hero));
    }

    private static PublishedLineup lineup(@Nullable Side winner, @Nullable Integer seconds, @Nullable UUID mvp,
            List<LineupSide> sides) {
        return new PublishedLineup(UUID.randomUUID(), Instant.EPOCH, winner, seconds, mvp, sides, List.of());
    }
}
