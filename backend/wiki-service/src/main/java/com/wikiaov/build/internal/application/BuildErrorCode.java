package com.wikiaov.build.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum BuildErrorCode implements ApiErrorCode {
    BUILD_CAPTURE_NOT_FOUND(HttpStatus.NOT_FOUND),
    BUILD_NOT_FOUND(HttpStatus.NOT_FOUND),
    BUILD_HERO_NOT_FOUND(HttpStatus.NOT_FOUND),
    BUILD_CAPTURE_EXISTS(HttpStatus.CONFLICT),
    BUILD_VERSION_CONFLICT(HttpStatus.CONFLICT),
    BUILD_REVIEW_OPEN(HttpStatus.CONFLICT),
    BUILD_INVALID(HttpStatus.UNPROCESSABLE_ENTITY);

    private final HttpStatus status;

    BuildErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Build request failed";
    }
}
