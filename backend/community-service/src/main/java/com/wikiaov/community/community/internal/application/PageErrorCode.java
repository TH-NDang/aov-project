package com.wikiaov.community.community.internal.application;

import com.wikiaov.community.platform.ApiErrorCode;

public enum PageErrorCode implements ApiErrorCode {
    PAGE_NOT_FOUND(404),
    PAGE_INVALID_CONTENT(422),
    PAGE_CONFLICT(409),
    PAGE_ACTION_FORBIDDEN(403);

    private final int status;

    PageErrorCode(int status) {
        this.status = status;
    }

    public int status() {
        return status;
    }
}
