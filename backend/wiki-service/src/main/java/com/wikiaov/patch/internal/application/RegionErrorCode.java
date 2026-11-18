package com.wikiaov.patch.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum RegionErrorCode implements ApiErrorCode {
    UNSUPPORTED_REGION;

    @Override
    public HttpStatus status() {
        return HttpStatus.UNPROCESSABLE_ENTITY;
    }

    @Override
    public String title() {
        return "Unsupported region";
    }
}
