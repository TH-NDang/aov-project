package com.wikiaov.gamemode.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum GameModeErrorCode implements ApiErrorCode {
    GAME_MODE_NOT_FOUND(HttpStatus.NOT_FOUND),
    GAME_MODE_REVISION_NOT_FOUND(HttpStatus.NOT_FOUND),
    GAME_MODE_GUIDE_NOT_FOUND(HttpStatus.NOT_FOUND),
    GAME_MODE_MAP_NOT_FOUND(HttpStatus.NOT_FOUND),
    GAME_MODE_LINEUP_NOT_FOUND(HttpStatus.NOT_FOUND),
    GAME_MODE_CONFLICT(HttpStatus.CONFLICT),
    GAME_MODE_CODE_TAKEN(HttpStatus.CONFLICT),
    GAME_MODE_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_ENTITY),
    GAME_MODE_FORBIDDEN(HttpStatus.FORBIDDEN),
    GAME_MODE_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS);

    private final HttpStatus status;

    GameModeErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Game mode request failed";
    }
}
