package com.wikiaov.community.tournament.internal.archive.domain;

/** What can still depend on a registry record and keep it from being deleted. */
public enum DependentKind {
    ROSTER_MEMBERSHIP,
    SERIES,
    TOURNAMENT_PART,
    GAME,
    PUBLICATION_HISTORY,
    PUBLIC_GAME,
    COMPETITION_PAGE
}
