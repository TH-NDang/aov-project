package com.wikiaov.item.internal.application;
import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;
public enum ItemErrorCode implements ApiErrorCode {
    ITEM_NOT_FOUND(HttpStatus.NOT_FOUND),
    ITEM_REVISION_NOT_FOUND(HttpStatus.NOT_FOUND),
    ITEM_CONFLICT(HttpStatus.CONFLICT),
    ITEM_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_ENTITY);
    private final HttpStatus status;
    ItemErrorCode(HttpStatus status) {
        this.status = status;
    }
    public HttpStatus status() {
        return status;
    }
    public String title() {
        return "Item request failed";
    }
}
