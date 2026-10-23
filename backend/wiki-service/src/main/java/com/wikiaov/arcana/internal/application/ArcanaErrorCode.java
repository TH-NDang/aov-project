package com.wikiaov.arcana.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum ArcanaErrorCode implements ApiErrorCode {
    ARCANA_NOT_FOUND(HttpStatus.NOT_FOUND),
    ARCANA_REVISION_NOT_FOUND(HttpStatus.NOT_FOUND),
    ARCANA_CONFLICT(HttpStatus.CONFLICT),
    ARCANA_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_ENTITY);

    private final HttpStatus status;

    ArcanaErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return "Arcana request failed";
    }
}
