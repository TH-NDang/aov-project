package com.wikiaov.community.tournament.internal.archive.domain;

/** What can still depend on a registry record and keep it from being deleted. */
public enum DependentKind {
    ROSTER_MEMBERSHIP,
    SERIES,
    TOURNAMENT_PART,
    /** A final table line or an award of a tournament that names the team or player. */
    TOURNAMENT_RESULT,
    /** A staff line of a tournament that names the team. */
    TOURNAMENT_STAFF,
    GAME,
    PUBLICATION_HISTORY,
    PUBLIC_GAME,
    COMPETITION_PAGE
}
