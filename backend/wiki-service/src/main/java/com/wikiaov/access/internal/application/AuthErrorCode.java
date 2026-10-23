package com.wikiaov.access.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum AuthErrorCode implements ApiErrorCode {
    AUTH_INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "Authentication failed"),
    AUTH_SESSION_EXPIRED(HttpStatus.UNAUTHORIZED, "Session expired"),
    AUTH_ORIGIN_REJECTED(HttpStatus.FORBIDDEN, "Origin rejected"),
    AUTH_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts"),
    AUTH_PROVIDER_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Identity provider unavailable"),
    AUTH_GOOGLE_DISABLED(HttpStatus.SERVICE_UNAVAILABLE, "Google login unavailable"),
    AUTH_INVALID_STATE(HttpStatus.BAD_REQUEST, "Invalid login state");

    private final HttpStatus status;
    private final String title;

    AuthErrorCode(HttpStatus status, String title) {
        this.status = status;
        this.title = title;
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return title;
    }
}
