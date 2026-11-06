package com.wikiaov.video.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum VideoErrorCode implements ApiErrorCode {
    VIDEO_NOT_FOUND(HttpStatus.NOT_FOUND),
    VIDEO_SUBJECT_NOT_FOUND(HttpStatus.UNPROCESSABLE_ENTITY),
    VIDEO_INVALID(HttpStatus.UNPROCESSABLE_ENTITY),
    VIDEO_DUPLICATE(HttpStatus.CONFLICT),
    VIDEO_CONFLICT(HttpStatus.CONFLICT);

    private final HttpStatus status;

    VideoErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return "Video request failed";
    }
}
