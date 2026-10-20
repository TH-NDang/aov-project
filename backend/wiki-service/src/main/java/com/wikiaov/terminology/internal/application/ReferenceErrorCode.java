package com.wikiaov.terminology.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum ReferenceErrorCode implements ApiErrorCode {
    REFERENCE_INVALID_SETTINGS(HttpStatus.UNPROCESSABLE_ENTITY),
    REFERENCE_INVALID_LOCALE(HttpStatus.UNPROCESSABLE_ENTITY),
    REFERENCE_VERSION_CONFLICT(HttpStatus.CONFLICT);

    private final HttpStatus status;
    ReferenceErrorCode(HttpStatus status) {
        this.status = status;
    }
    public HttpStatus status() {
        return status;
    }
    public String title() {
        return "Reference settings request failed";
    }
}
