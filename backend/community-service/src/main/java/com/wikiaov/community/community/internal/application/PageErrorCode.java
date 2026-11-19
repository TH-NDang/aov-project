package com.wikiaov.community.community.internal.application;

import com.wikiaov.community.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum PageErrorCode implements ApiErrorCode {
    PAGE_NOT_FOUND(HttpStatus.NOT_FOUND),
    PAGE_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_CONTENT),
    PAGE_CONFLICT(HttpStatus.CONFLICT),
    PAGE_ACTION_FORBIDDEN(HttpStatus.FORBIDDEN);

    private final HttpStatus status;

    PageErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Page request failed";
    }
}
