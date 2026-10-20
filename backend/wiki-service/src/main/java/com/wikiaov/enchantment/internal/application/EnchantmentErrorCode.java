package com.wikiaov.enchantment.internal.application;
import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;
public enum EnchantmentErrorCode implements ApiErrorCode {
    ENCHANTMENT_NOT_FOUND(HttpStatus.NOT_FOUND),
    ENCHANTMENT_REVISION_NOT_FOUND(HttpStatus.NOT_FOUND),
    ENCHANTMENT_CONFLICT(HttpStatus.CONFLICT),
    ENCHANTMENT_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_ENTITY);
    private final HttpStatus status;
    EnchantmentErrorCode(HttpStatus status) {
        this.status = status;
    }
    public HttpStatus status() {
        return status;
    }
    public String title() {
        return "Enchantment request failed";
    }
}
