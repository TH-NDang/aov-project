package com.wikiaov.community.tournament.internal.statistics.application;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.DraftKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Side;
import com.wikiaov.community.tournament.internal.statistics.application.HeroRoll.Hero;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupBan;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupGame;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupHero;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupPick;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupPlayer;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.LineupTeam;
import com.wikiaov.community.tournament.internal.statistics.application.LineupViews.Lineups;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup;
import com.wikiaov.community.tournament.internal.statistics.domain.PublishedLineup.LineupSide;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Lists the published games of one competition with their picks and bans (spec 04, lineups of a competition). The games
 * come newest first: a player keeps the first nickname met.
 */
final class LineupList {
    private static final Comparator<LineupPick> BY_LANE = Comparator.comparing(LineupPick::lane,
            Comparator.nullsLast(Comparator.naturalOrder()));
    private static final Comparator<LineupBan> BY_TURN = Comparator.comparing(LineupBan::turn,
            Comparator.nullsLast(Comparator.naturalOrder()));

    private final HeroRoll roll;
    private final Map<Hero, Integer> heroes = new LinkedHashMap<>();
    private final Map<UUID, Integer> players = new LinkedHashMap<>();
    private final Map<UUID, String> nicknames = new HashMap<>();

    private LineupList(HeroRoll roll) {
        this.roll = roll;
    }

    static Lineups of(List<PublishedLineup> games, HeroRoll roll) {
        var list = new LineupList(roll);
        var listed = games.stream().map(list::game).toList();

        return new Lineups(
                list.heroes.keySet().stream()
                        .map(hero -> new LineupHero(hero.id(), hero.code(), hero.name(), hero.iconUrl())).toList(),
                list.players.keySet().stream().map(player -> new LineupPlayer(player, list.nicknames.get(player)))
                        .toList(),
                listed);
    }

    private LineupGame game(PublishedLineup game) {
        game.players().forEach((player, nickname) -> {
            if (nickname != null && !nickname.isBlank()) {
                nicknames.putIfAbsent(player, nickname.strip());
            }
        });
        var turns = new HashMap<Turn, Integer>();
        for (var turn : game.turns()) {
            if (turn.order() != null && HeroRoll.present(turn.hero()) && roll.hero(turn.hero()) != null) {
                turns.putIfAbsent(new Turn(turn.side(), turn.kind(), roll.hero(turn.hero())), turn.order());
            }
        }

        return new LineupGame(game.id(), game.seriesId(), game.number(), game.winner(), game.durationSeconds(),
                player(game.mvpPlayerId()), team(game, Side.BLUE, turns), team(game, Side.RED, turns));
    }

    private @Nullable LineupTeam team(PublishedLineup game, Side side, Map<Turn, Integer> turns) {
        return game.sides().stream().filter(candidate -> candidate.side() == side).findFirst()
                .map(found -> new LineupTeam(found.teamId(), picks(found, turns), bans(found, turns))).orElse(null);
    }

    private List<LineupPick> picks(LineupSide side, Map<Turn, Integer> turns) {
        return side.seats().stream().filter(seat -> HeroRoll.present(seat.hero())).map(seat -> {
            var hero = roll.hero(seat.hero());
            return new LineupPick(place(hero), seat.lane(), player(seat.playerId()),
                    turns.get(new Turn(side.side(), DraftKind.PICK, hero)));
        }).sorted(BY_LANE).toList();
    }

    /** A hero listed twice among the bans of one side was still banned once. */
    private List<LineupBan> bans(LineupSide side, Map<Turn, Integer> turns) {
        var banned = new LinkedHashSet<Hero>();
        side.bans().stream().filter(HeroRoll::present).map(roll::hero).forEach(banned::add);

        return banned.stream()
                .map(hero -> new LineupBan(place(hero), turns.get(new Turn(side.side(), DraftKind.BAN, hero))))
                .sorted(BY_TURN).toList();
    }

    private int place(Hero hero) {
        return heroes.computeIfAbsent(hero, next -> heroes.size());
    }

    private @Nullable Integer player(@Nullable UUID player) {
        return player == null ? null : players.computeIfAbsent(player, next -> players.size());
    }

    private record Turn(
            Side side,
            DraftKind kind,
            Hero hero
    ) {
    }
}
