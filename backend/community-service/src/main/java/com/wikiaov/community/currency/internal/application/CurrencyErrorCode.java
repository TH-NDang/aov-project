package com.wikiaov.community.currency.internal.application;

import com.wikiaov.community.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum CurrencyErrorCode implements ApiErrorCode {
    EXCHANGE_RATE_INVALID_QUERY(HttpStatus.BAD_REQUEST);

    private final HttpStatus status;

    CurrencyErrorCode(HttpStatus status) {
        this.status = status;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return "Exchange rate request failed";
    }
}
