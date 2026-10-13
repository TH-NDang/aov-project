package com.wikiaov.user.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum UserErrorCode implements ApiErrorCode {
    USER_PROFILE_NOT_FOUND(HttpStatus.NOT_FOUND),
    USER_PROFILE_CONFLICT(HttpStatus.CONFLICT),
    USER_PROFILE_INVALID(HttpStatus.UNPROCESSABLE_CONTENT),
    USER_AVATAR_INVALID(HttpStatus.UNPROCESSABLE_CONTENT);

    private final HttpStatus status;

    UserErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return name();
    }
}
