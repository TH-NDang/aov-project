package com.wikiaov.hero.internal.application;
import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;
public enum HeroErrorCode implements ApiErrorCode {
    HERO_NOT_FOUND(HttpStatus.NOT_FOUND),
    HERO_REVISION_NOT_FOUND(HttpStatus.NOT_FOUND),
    HERO_CODE_EXISTS(HttpStatus.CONFLICT),
    HERO_DRAFT_EXISTS(HttpStatus.CONFLICT),
    HERO_REVISION_VERSION_CONFLICT(HttpStatus.CONFLICT),
    HERO_REVISION_NOT_EDITABLE(HttpStatus.CONFLICT),
    HERO_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_ENTITY),
    HERO_INVALID_MEDIA(HttpStatus.UNPROCESSABLE_ENTITY),
    HERO_PATCH_CHANGE_CONFLICT(HttpStatus.CONFLICT);
    private final HttpStatus status;
    HeroErrorCode(HttpStatus status) {
        this.status = status;
    }
    public HttpStatus status() {
        return status;
    }
    public String title() {
        return "Hero request failed";
    }
}
