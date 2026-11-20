package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum TournamentErrorCode implements ApiErrorCode {
    TOURNAMENT_RECORD_NOT_FOUND(HttpStatus.NOT_FOUND),
    TOURNAMENT_INVALID_CONTENT(HttpStatus.BAD_REQUEST),
    TOURNAMENT_VERSION_CONFLICT(HttpStatus.CONFLICT),
    TOURNAMENT_RECORD_IN_USE(HttpStatus.CONFLICT),
    /** Another active player of the country already has that name; resend with allowSameName for a namesake. */
    TOURNAMENT_PLAYER_SAME_NAME(HttpStatus.CONFLICT),
    TOURNAMENT_RESTORE_BLOCKED(HttpStatus.CONFLICT),
    TOURNAMENT_RECORD_DELETED(HttpStatus.CONFLICT),
    TOURNAMENT_MEDIA_RETIRED(HttpStatus.CONFLICT),
    TOURNAMENT_WIKI_UNAVAILABLE(HttpStatus.BAD_GATEWAY),
    TOURNAMENT_CATALOG_LIMIT(HttpStatus.BAD_GATEWAY),
    TOURNAMENT_PUBLICATION_INCOMPLETE(HttpStatus.UNPROCESSABLE_CONTENT);

    private final HttpStatus status;

    TournamentErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Tournament request failed";
    }
}
