package com.wikiaov.community.community.internal.translation.application;

import com.wikiaov.community.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum TranslationErrorCode implements ApiErrorCode {
    /** The language is not one posts are translated into. */
    TRANSLATION_UNSUPPORTED_LOCALE(HttpStatus.BAD_REQUEST),
    /** Translation is off: no API key, or this month's budget is spent. */
    TRANSLATION_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE),
    /** The account or address started too many translations in the last hour. */
    TRANSLATION_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS),
    /** The Claude API failed or answered something unusable. */
    TRANSLATION_FAILED(HttpStatus.BAD_GATEWAY);

    private final HttpStatus status;

    TranslationErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Translation request failed";
    }
}
