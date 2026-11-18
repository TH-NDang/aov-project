package com.wikiaov.community.tournament.internal.archive.domain;

import com.wikiaov.community.tournament.CompetitionReferences.Subject;

public enum RegistryKind {
    TEAM,
    PLAYER,
    TOURNAMENT,
    SERIES,
    ROSTER_MEMBERSHIP,
    GAME;

    /** The same record as other modules are asked about it. */
    public Subject subject() {
        return switch (this) {
            case TEAM -> Subject.TEAM;
            case PLAYER -> Subject.PLAYER;
            case TOURNAMENT -> Subject.TOURNAMENT;
            case SERIES -> Subject.SERIES;
            case ROSTER_MEMBERSHIP -> Subject.ROSTER_MEMBERSHIP;
            case GAME -> Subject.GAME;
        };
    }
}
