package com.wikiaov.spell.internal.application;
import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;
public enum SpellErrorCode implements ApiErrorCode {
    SPELL_NOT_FOUND(HttpStatus.NOT_FOUND),
    SPELL_REVISION_NOT_FOUND(HttpStatus.NOT_FOUND),
    SPELL_CONFLICT(HttpStatus.CONFLICT),
    SPELL_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_ENTITY);
    private final HttpStatus status;
    SpellErrorCode(HttpStatus status) {
        this.status = status;
    }
    public HttpStatus status() {
        return status;
    }
    public String title() {
        return "Spell request failed";
    }
}
