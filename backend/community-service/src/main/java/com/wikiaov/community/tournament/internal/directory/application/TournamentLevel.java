package com.wikiaov.community.tournament.internal.directory.application;

/** Which tournaments a list holds: every tournament, or main events only with their parts folded in (V016). */
public enum TournamentLevel {
    ALL,
    MAIN;

    /** Whether the list leaves the parts of main events out. */
    public boolean mainEventsOnly() {
        return this == MAIN;
    }
}
