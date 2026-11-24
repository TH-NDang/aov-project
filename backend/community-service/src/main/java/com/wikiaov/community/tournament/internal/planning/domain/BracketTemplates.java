package com.wikiaov.community.tournament.internal.planning.domain;

import com.wikiaov.community.tournament.internal.domain.MatchTitle;
import com.wikiaov.community.tournament.internal.domain.MatchTitle.Kind;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Match;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Slot;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan.Stage;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Elimination brackets drawn from seeds (spec 04, bracket templates). Seeds meet as late as they can: one and two sit
 * in different halves, and where the seeds do not fill the first round the highest ones go straight to the second.
 */
public final class BracketTemplates {
    public static final int MIN_TEAMS = 2;
    public static final int MAX_TEAMS = 64;
    /** Sizes of a double elimination: every seed plays the first upper round. */
    private static final List<Integer> DOUBLE_SIZES = List.of(4, 8, 16, 32);

    private BracketTemplates() {
    }

    public static List<Match> singleElimination(Stage stage, int teams, boolean thirdPlace) {
        if (teams < MIN_TEAMS || teams > MAX_TEAMS) {
            throw new IllegalArgumentException("A bracket holds from " + MIN_TEAMS + " to " + MAX_TEAMS + " seeds.");
        }

        var matches = new ArrayList<Match>();
        var sides = sides(teams);
        int round = 1;
        while (sides.size() > 1) {
            int remaining = sides.size();
            var next = new ArrayList<Slot>();
            var played = new ArrayList<Match>();
            for (int index = 0; index < remaining; index += 2) {
                Slot a = sides.get(index);
                Slot b = sides.get(index + 1);
                if (a == null || b == null) {
                    next.add(a == null ? b : a);
                    continue;
                }
                int number = played.size() + 1;
                var match = match(stage, "R" + remaining + "_" + number, round, knockoutTitle(remaining, number), a,
                        b);
                played.add(match);
                next.add(Slot.outcome(match.key(), true));
            }
            // A bracket of three has one semifinal, so nobody is left to play its loser.
            if (remaining == 2 && thirdPlace && matches.size() >= 2) {
                played.addFirst(match(stage, "P3", round, MatchTitle.of(Kind.THIRD_PLACE),
                        Slot.outcome(matches.get(matches.size() - 2).key(), false),
                        Slot.outcome(matches.getLast().key(), false)));
            }
            matches.addAll(played);
            sides = next;
            round++;
        }
        return List.copyOf(matches);
    }

    public static List<Match> doubleElimination(Stage stage, int teams) {
        if (!DOUBLE_SIZES.contains(teams)) {
            throw new IllegalArgumentException("A double elimination holds 4, 8, 16 or 32 seeds.");
        }

        int upperRounds = Integer.numberOfTrailingZeros(teams);
        int lowerRounds = 2 * (upperRounds - 1);
        var matches = new ArrayList<Match>();
        var upper = sides(teams);
        List<Slot> lower = List.of();
        int lowerRound = 0;
        for (int round = 1; round <= upperRounds; round++) {
            var winners = new ArrayList<Slot>();
            var losers = new ArrayList<Slot>();
            for (int index = 0; index < upper.size(); index += 2) {
                int number = index / 2 + 1;
                var match = match(stage, "U" + round + "_" + number, round, upperTitle(upperRounds, round, number),
                        upper.get(index), upper.get(index + 1));
                matches.add(match);
                winners.add(Slot.outcome(match.key(), true));
                losers.add(Slot.outcome(match.key(), false));
            }
            if (round == 1) {
                lower = lowerRound(stage, matches, ++lowerRound, lowerRounds, losers);
            } else {
                // Losers drop in from the far end, so that a pair that just met in the upper bracket does not meet
                // again at once.
                Collections.reverse(losers);
                lower = lowerRound(stage, matches, ++lowerRound, lowerRounds, interleaved(losers, lower));
                if (lower.size() > 1) {
                    lower = lowerRound(stage, matches, ++lowerRound, lowerRounds, lower);
                }
            }
            upper = winners;
        }

        matches.add(match(stage, "GF", lowerRounds + 1, MatchTitle.of(Kind.GRAND_FINAL), upper.getFirst(),
                lower.getFirst()));
        return List.copyOf(matches);
    }

    /** One round of the lower bracket; returns its winners. */
    private static List<Slot> lowerRound(Stage stage, List<Match> matches, int round, int rounds, List<Slot> sides) {
        var winners = new ArrayList<Slot>();
        for (int index = 0; index < sides.size(); index += 2) {
            int number = index / 2 + 1;
            var match = match(stage, "L" + round + "_" + number, round, lowerTitle(rounds, round, number),
                    sides.get(index), sides.get(index + 1));
            matches.add(match);
            winners.add(Slot.outcome(match.key(), true));
        }
        return winners;
    }

    private static List<Slot> interleaved(List<Slot> first, List<Slot> second) {
        var sides = new ArrayList<Slot>();
        for (int index = 0; index < first.size(); index++) {
            sides.add(first.get(index));
            sides.add(second.get(index));
        }
        return sides;
    }

    /** The first round of a bracket, two by two; an empty side is a bye. */
    private static List<Slot> sides(int teams) {
        var order = List.of(1);
        while (order.size() < teams) {
            int total = order.size() * 2 + 1;
            var next = new ArrayList<Integer>();
            for (int seed : order) {
                next.add(seed);
                next.add(total - seed);
            }
            order = next;
        }

        var sides = new ArrayList<Slot>();
        order.forEach(seed -> sides.add(seed <= teams ? Slot.seed(seed) : null));
        return sides;
    }

    private static MatchTitle knockoutTitle(int remaining, int number) {
        return switch (remaining) {
            case 2 -> MatchTitle.of(Kind.FINAL);
            case 4 -> MatchTitle.numbered(Kind.SEMIFINAL, null, number);
            case 8 -> MatchTitle.numbered(Kind.QUARTERFINAL, null, number);
            default -> MatchTitle.numbered(Kind.ROUND_OF, remaining, number);
        };
    }

    private static MatchTitle upperTitle(int rounds, int round, int number) {
        if (round == rounds) {
            return MatchTitle.of(Kind.UPPER_FINAL);
        }
        return round == rounds - 1
                ? MatchTitle.numbered(Kind.UPPER_SEMIFINAL, null, number)
                : MatchTitle.numbered(Kind.UPPER_ROUND, round, number);
    }

    private static MatchTitle lowerTitle(int rounds, int round, int number) {
        if (round == rounds) {
            return MatchTitle.of(Kind.LOWER_FINAL);
        }
        return round == rounds - 1 && rounds > 2
                ? MatchTitle.of(Kind.LOWER_SEMIFINAL)
                : MatchTitle.numbered(Kind.LOWER_ROUND, round, number);
    }

    private static Match match(Stage stage, String name, int round, MatchTitle title, Slot a, Slot b) {
        return new Match(stage.code() + "_" + name, stage.code(), round, null, stage.bestOf(), null, a, b, null,
                title);
    }
}
