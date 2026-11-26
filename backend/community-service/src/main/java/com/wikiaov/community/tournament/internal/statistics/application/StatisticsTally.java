package com.wikiaov.community.tournament.internal.statistics.application;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.statistics.application.HeroRoll.Hero;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameLength;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameStatistics;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.HeroCount;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.MvpCount;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.LineupSide;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Counts the published games of one competition (spec 04, hero statistics of a competition). The games come newest
 * first: of two games of the same length the newer one stands.
 */
final class StatisticsTally {
    /** How many players the list of MVPs names. */
    static final int MAX_MVPS = 10;

    private static final Comparator<HeroCount> MOST_PRESENT_FIRST = Comparator
            .comparingInt((HeroCount hero) -> hero.picks() + hero.bans()).reversed()
            .thenComparing(HeroCount::picks, Comparator.reverseOrder())
            .thenComparing(HeroCount::name)
            .thenComparing(HeroCount::id, Comparator.nullsLast(Comparator.naturalOrder()));
    private static final Comparator<MvpCount> MOST_GAMES_FIRST = Comparator.comparingInt(MvpCount::games).reversed()
            .thenComparing(mvp -> mvp.playerId().toString());

    private final HeroRoll heroes;
    private final Map<Hero, Counts> counts = new HashMap<>();
    private final Map<UUID, Integer> mvps = new HashMap<>();
    private final List<GameLength> lengths = new ArrayList<>();
    private int decided;
    private int blueWins;
    private int withBans;

    private StatisticsTally(HeroRoll heroes) {
        this.heroes = heroes;
    }

    static GameStatistics of(List<PublishedLineup> newestFirst, HeroRoll heroes) {
        var tally = new StatisticsTally(heroes);
        newestFirst.forEach(tally::add);

        return tally.total(newestFirst.size());
    }

    private void add(PublishedLineup game) {
        if (game.winner() != null) {
            decided++;
        }
        if (game.winner() == Side.BLUE) {
            blueWins++;
        }
        if (game.showsBans()) {
            withBans++;
        }
        if (game.durationSeconds() != null) {
            lengths.add(new GameLength(game.id(), game.durationSeconds()));
        }
        if (game.mvpPlayerId() != null) {
            mvps.merge(game.mvpPlayerId(), 1, Integer::sum);
        }

        for (var side : game.sides()) {
            picks(game, side);
            bans(side);
        }
    }

    private void picks(PublishedLineup game, LineupSide side) {
        for (var seat : side.seats()) {
            if (!HeroRoll.present(seat.hero())) {
                continue;
            }
            var count = count(heroes.hero(seat.hero()));
            count.picks++;
            if (side.side() == Side.BLUE) {
                count.bluePicks++;
            }
            if (side.side() == game.winner()) {
                count.wins++;
            }
        }
    }

    /** A hero listed twice among the bans of one side was still banned once. */
    private void bans(LineupSide side) {
        var banned = new HashSet<Hero>();
        for (var ban : side.bans()) {
            if (HeroRoll.present(ban) && banned.add(heroes.hero(ban))) {
                count(heroes.hero(ban)).bans++;
            }
        }
    }

    private Counts count(Hero hero) {
        return counts.computeIfAbsent(hero, first -> new Counts());
    }

    private GameStatistics total(int games) {
        var average = lengths.stream().mapToInt(GameLength::seconds).average();
        var bySeconds = Comparator.comparingInt(GameLength::seconds);

        return new GameStatistics(games, decided, blueWins, withBans,
                average.isPresent() ? (int) Math.round(average.getAsDouble()) : null,
                lengths.stream().max(bySeconds).orElse(null), lengths.stream().min(bySeconds).orElse(null),
                counts.entrySet().stream().map(entry -> entry.getValue().of(entry.getKey()))
                        .sorted(MOST_PRESENT_FIRST).toList(),
                mvps.entrySet().stream().map(entry -> new MvpCount(entry.getKey(), entry.getValue()))
                        .sorted(MOST_GAMES_FIRST).limit(MAX_MVPS).toList());
    }

    private static final class Counts {
        private int picks;
        private int wins;
        private int bans;
        private int bluePicks;

        private HeroCount of(Hero hero) {
            return new HeroCount(hero.id(), hero.code(), hero.name(), hero.iconUrl(), picks, wins, bans, bluePicks);
        }
    }
}
