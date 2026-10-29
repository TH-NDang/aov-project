package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.ApiErrorCode;

public enum TournamentErrorCode implements ApiErrorCode {
    TOURNAMENT_RECORD_NOT_FOUND(404),
    TOURNAMENT_INVALID_CONTENT(400),
    TOURNAMENT_INVALID_REQUEST(400),
    TOURNAMENT_VERSION_CONFLICT(409),
    TOURNAMENT_DUPLICATE_CODE(409),
    TOURNAMENT_RECORD_IN_USE(409),
    TOURNAMENT_RESTORE_BLOCKED(409),
    TOURNAMENT_RECORD_DELETED(409),
    TOURNAMENT_WIKI_UNAVAILABLE(502),
    TOURNAMENT_CATALOG_LIMIT(502),
    TOURNAMENT_PUBLICATION_INCOMPLETE(422);

    private final int status;

    TournamentErrorCode(int status) {
        this.status = status;
    }

    public int status() {
        return status;
    }
}
