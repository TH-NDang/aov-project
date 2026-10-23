package com.wikiaov.patch.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum PatchErrorCode implements ApiErrorCode {
    PATCH_NOT_FOUND(HttpStatus.NOT_FOUND),
    PATCH_CONTEXT_UNAVAILABLE(HttpStatus.UNPROCESSABLE_ENTITY),
    PATCH_INVALID(HttpStatus.UNPROCESSABLE_ENTITY),
    PATCH_CONFLICT(HttpStatus.CONFLICT);

    private final HttpStatus status;

    PatchErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return "Patch request failed";
    }
}
