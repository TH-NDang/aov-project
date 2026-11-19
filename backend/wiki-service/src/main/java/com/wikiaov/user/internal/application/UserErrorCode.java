package com.wikiaov.user.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum UserErrorCode implements ApiErrorCode {
    USER_PROFILE_NOT_FOUND(HttpStatus.NOT_FOUND),
    USER_PROFILE_CONFLICT(HttpStatus.CONFLICT),
    USER_PROFILE_INVALID(HttpStatus.UNPROCESSABLE_CONTENT),
    USER_AVATAR_INVALID(HttpStatus.UNPROCESSABLE_CONTENT),
    USER_ACCOUNT_PROVIDER_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE),
    USER_MAIL_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE),
    USER_EMAIL_MISSING(HttpStatus.CONFLICT),
    USER_PASSWORD_CODE_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
    USER_PASSWORD_CHALLENGE_NOT_FOUND(HttpStatus.NOT_FOUND),
    USER_PASSWORD_CODE_INVALID(HttpStatus.BAD_REQUEST),
    USER_PASSWORD_CODE_EXPIRED(HttpStatus.GONE),
    USER_PASSWORD_CHANGE_IN_PROGRESS(HttpStatus.CONFLICT),
    USER_PASSWORD_REJECTED(HttpStatus.UNPROCESSABLE_CONTENT),
    USER_SESSION_NOT_FOUND(HttpStatus.NOT_FOUND),
    USER_SESSION_CURRENT(HttpStatus.CONFLICT),
    USER_TWO_FACTOR_ACTIVE(HttpStatus.CONFLICT);

    private final HttpStatus status;

    UserErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return name();
    }
}
