package com.wikiaov.community.tournament.internal.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.text.Normalizer;
import java.util.*;

/**
 * Series pick rule: outside the last possible game of a series, a team never picks the same hero twice. The last game
 * (its number equals the best-of) opens every hero again, and bans only apply to their own game.
 */
public final class SeriesPickRule {
    private SeriesPickRule() {
    }

    public static List<String> violations(Game game, Integer bestOf, Collection<Game> others) {
        var errors = new ArrayList<String>();
        if (bestOf == null || game.number() == null || game.number() >= bestOf)
            return errors;

        var used = new HashMap<UUID, Set<String>>();
        for (var other : others) {
            if (other.number() == null || other.number() >= bestOf || other.number().equals(game.number()))
                continue;
            for (var side : other.sides())
                if (side.teamId() != null)
                    used.computeIfAbsent(side.teamId(), ignored -> new HashSet<>()).addAll(picks(other, side.side()));
        }

        var teams = new EnumMap<Side, UUID>(Side.class);
        for (int sideIndex = 0; sideIndex < game.sides().size(); sideIndex++) {
            var side = game.sides().get(sideIndex);
            if (side.side() != null && side.teamId() != null)
                teams.put(side.side(), side.teamId());
            var taken = used.getOrDefault(side.teamId(), Set.of());
            for (int index = 0; index < side.participants().size(); index++)
                if (reused(side.participants().get(index).hero(), taken))
                    errors.add("sides[" + sideIndex + "].participants[" + index + "].hero.usedInSeries");
        }
        for (int index = 0; index < game.draft().turns().size(); index++) {
            var turn = game.draft().turns().get(index);
            if (turn.kind() == DraftKind.PICK && turn.side() != null
                    && reused(turn.hero(), used.getOrDefault(teams.get(turn.side()), Set.of())))
                errors.add("draft.turns[" + index + "].hero.usedInSeries");
        }
        return List.copyOf(errors);
    }

    private static Set<String> picks(Game game, Side side) {
        var heroes = new HashSet<String>();
        for (var entry : game.sides())
            if (entry.side() == side)
                for (var participant : entry.participants())
                    heroes.addAll(keys(participant.hero()));
        for (var turn : game.draft().turns())
            if (turn.side() == side && turn.kind() == DraftKind.PICK)
                heroes.addAll(keys(turn.hero()));
        return heroes;
    }

    private static boolean reused(Selection hero, Set<String> taken) {
        return !taken.isEmpty() && keys(hero).stream().anyMatch(taken::contains);
    }

    /** A hero matches by catalogue id or by name, so observations recorded without an id still count. */
    private static List<String> keys(Selection hero) {
        if (hero == null)
            return List.of();
        var keys = new ArrayList<String>(2);
        if (hero.id() != null)
            keys.add("id:" + hero.id());
        if (hero.name() != null && !hero.name().isBlank())
            keys.add("name:" + Normalizer.normalize(hero.name().trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFKC));
        return keys;
    }
}
