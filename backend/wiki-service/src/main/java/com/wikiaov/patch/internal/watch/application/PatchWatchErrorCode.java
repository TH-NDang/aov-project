package com.wikiaov.patch.internal.watch.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum PatchWatchErrorCode implements ApiErrorCode {
    PATCH_NOTE_POST_NOT_FOUND(HttpStatus.NOT_FOUND),
    PATCH_NOTE_POST_INVALID(HttpStatus.UNPROCESSABLE_ENTITY),
    PATCH_NOTE_POST_DUPLICATE(HttpStatus.CONFLICT),
    PATCH_NOTE_POST_CONFLICT(HttpStatus.CONFLICT),
    PATCH_NOTE_SCHEDULE_INVALID(HttpStatus.UNPROCESSABLE_ENTITY),
    PATCH_NOTE_SCHEDULE_CONFLICT(HttpStatus.CONFLICT);

    private final HttpStatus status;

    PatchWatchErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Patch watch request failed";
    }
}
