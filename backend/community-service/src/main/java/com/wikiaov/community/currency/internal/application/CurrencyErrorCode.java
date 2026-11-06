package com.wikiaov.community.currency.internal.application;

import com.wikiaov.community.platform.ApiErrorCode;

public enum CurrencyErrorCode implements ApiErrorCode {
    EXCHANGE_RATE_INVALID_QUERY(400);

    private final int status;

    CurrencyErrorCode(int status) {
        this.status = status;
    }

    @Override
    public int status() {
        return status;
    }
}
