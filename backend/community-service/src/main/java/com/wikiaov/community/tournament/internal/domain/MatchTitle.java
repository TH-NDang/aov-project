package com.wikiaov.community.tournament.internal.domain;

import org.jspecify.annotations.Nullable;

/**
 * What a match is in its stage, as a code and its numbers, so each reader words it in its own language. A planned
 * match and the series it became carry the same title; a name an editor typed is kept apart and shown instead. See
 * spec 04, match titles.
 */
public record MatchTitle(
        Kind kind,
        @Nullable Integer leg,
        @Nullable Integer round,
        @Nullable Integer number
) {
    /** The highest leg, round or match number a title can hold. */
    public static final int MAX_NUMBER = 99;

    public enum Kind {
        /** A round of a round robin: {@code leg} and {@code round}. */
        ROUND_ROBIN,
        /** One of the upper bracket semifinals: {@code number}. */
        UPPER_SEMIFINAL,
        UPPER_FINAL,
        /** A round of the lower bracket: {@code round} and {@code number}. */
        LOWER_ROUND,
        LOWER_SEMIFINAL,
        LOWER_FINAL,
        GRAND_FINAL,
        /** A match an editor added by hand to a generated schedule. */
        EXTRA
    }

    public static MatchTitle roundRobin(int leg, int round) {
        return new MatchTitle(Kind.ROUND_ROBIN, leg, round, null);
    }

    public static MatchTitle of(Kind kind) {
        return new MatchTitle(kind, null, null, null);
    }

    public static MatchTitle numbered(Kind kind, @Nullable Integer round, int number) {
        return new MatchTitle(kind, null, round, number);
    }

    /** Whether a title a client wrote holds: absent, or a kind with numbers from 1 to {@link #MAX_NUMBER}. */
    public static boolean valid(@Nullable MatchTitle title) {
        if (title == null) {
            return true;
        }
        if (title.kind() == null) {
            return false;
        }
        for (var value : new Integer[] {title.leg(), title.round(), title.number()}) {
            if (value != null && (value < 1 || value > MAX_NUMBER)) {
                return false;
            }
        }
        return true;
    }
}
