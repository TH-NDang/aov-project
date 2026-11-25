package com.wikiaov.community.tournament.internal.statistics.application;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Selection;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.games.domain.GameRules;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameLength;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameStatistics;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.HeroCount;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.MvpCount;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.KnownHero;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.LineupSide;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;

/**
 * Counts the published games of one competition (spec 04, hero statistics of a competition). The games come newest
 * first: a hero keeps the first name, code and picture met, and of two games of the same length the newer one stands.
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

    private final Map<String, Hero> heroes = new HashMap<>();
    private final Map<UUID, Integer> mvps = new HashMap<>();
    private final List<GameLength> lengths = new ArrayList<>();
    private int decided;
    private int blueWins;

    private StatisticsTally() {
    }

    static GameStatistics of(List<PublishedLineup> newestFirst) {
        var tally = new StatisticsTally();
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
        // Zero seconds is a length nobody filled in, not a game that ended at once.
        if (game.durationSeconds() != null && game.durationSeconds() > 0) {
            lengths.add(new GameLength(game.id(), game.durationSeconds()));
        }
        if (game.mvpPlayerId() != null) {
            mvps.merge(game.mvpPlayerId(), 1, Integer::sum);
        }

        for (var side : game.sides()) {
            picks(game, side);
            bans(game, side);
        }
    }

    private void picks(PublishedLineup game, LineupSide side) {
        for (var pick : side.picks()) {
            if (!present(pick)) {
                continue;
            }
            var hero = hero(game, pick);
            hero.picks++;
            if (side.side() == Side.BLUE) {
                hero.bluePicks++;
            }
            if (side.side() == game.winner()) {
                hero.wins++;
            }
        }
    }

    /** A hero listed twice among the bans of one side was still banned once. */
    private void bans(PublishedLineup game, LineupSide side) {
        var banned = new HashSet<String>();
        for (var ban : side.bans()) {
            if (present(ban) && banned.add(GameRules.identity(ban))) {
                hero(game, ban).bans++;
            }
        }
    }

    private Hero hero(PublishedLineup game, Selection selection) {
        var hero = heroes.computeIfAbsent(GameRules.identity(selection), identity -> new Hero(selection.id()));
        var name = game.nameOf(selection);
        if (hero.name.isEmpty()) {
            hero.name = name;
        }
        game.known(selection).ifPresent(hero::picture);
        Stream.of(name, Objects.requireNonNullElse(selection.name(), "")).filter(known -> !known.isBlank())
                .map(known -> GameRules.identity(new Selection(null, known))).forEach(hero.names::add);

        return hero;
    }

    /**
     * Imported games name some heroes without their id. Such a hero joins the one hero with an id that this competition
     * knows by the same name; a name two of them go by tells nothing.
     */
    private void joinNamed() {
        var byName = heroes.values().stream().filter(hero -> hero.id != null)
                .flatMap(hero -> hero.names.stream().map(name -> Map.entry(name, hero)))
                .collect(Collectors.groupingBy(Map.Entry::getKey,
                        Collectors.mapping(Map.Entry::getValue, Collectors.toList())));

        heroes.entrySet().removeIf(entry -> {
            var known = entry.getValue().id == null ? byName.getOrDefault(entry.getKey(), List.of()) : List.<Hero>of();
            if (known.size() != 1) {
                return false;
            }
            known.getFirst().join(entry.getValue());
            return true;
        });
    }

    private GameStatistics total(int games) {
        joinNamed();
        var average = lengths.stream().mapToInt(GameLength::seconds).average();
        var bySeconds = Comparator.comparingInt(GameLength::seconds);

        return new GameStatistics(games, decided, blueWins,
                average.isPresent() ? (int) Math.round(average.getAsDouble()) : null,
                lengths.stream().max(bySeconds).orElse(null), lengths.stream().min(bySeconds).orElse(null),
                heroes.values().stream().map(Hero::count).sorted(MOST_PRESENT_FIRST).toList(),
                mvps.entrySet().stream().map(entry -> new MvpCount(entry.getKey(), entry.getValue()))
                        .sorted(MOST_GAMES_FIRST).limit(MAX_MVPS).toList());
    }

    private static boolean present(@Nullable Selection selection) {
        return selection != null && selection.present();
    }

    private static final class Hero {
        private final @Nullable UUID id;
        private final Set<String> names = new HashSet<>();
        private String name = "";
        private @Nullable String code;
        private @Nullable String iconUrl;
        private int picks;
        private int wins;
        private int bans;
        private int bluePicks;

        private Hero(@Nullable UUID id) {
            this.id = id;
        }

        private void picture(KnownHero known) {
            code = code == null || code.isBlank() ? known.code() : code;
            iconUrl = iconUrl == null || iconUrl.isBlank() ? known.iconUrl() : iconUrl;
        }

        private void join(Hero named) {
            picks += named.picks;
            wins += named.wins;
            bans += named.bans;
            bluePicks += named.bluePicks;
        }

        private HeroCount count() {
            return new HeroCount(id, code, name, iconUrl, picks, wins, bans, bluePicks);
        }
    }
}
