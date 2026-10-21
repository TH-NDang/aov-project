package com.wikiaov.hero.internal.application;

import com.wikiaov.platform.ApiErrorCode;
import org.springframework.http.HttpStatus;

public enum HeroErrorCode implements ApiErrorCode {
    HERO_BADGE_GROUP_NOT_FOUND(HttpStatus.NOT_FOUND),
    HERO_BADGE_GROUP_CONFLICT(HttpStatus.CONFLICT),
    HERO_BADGE_NOT_FOUND(HttpStatus.NOT_FOUND),
    HERO_BADGE_CONFLICT(HttpStatus.CONFLICT),
    HERO_IMPORT_JOB_NOT_FOUND(HttpStatus.NOT_FOUND),
    HERO_IMPORT_JOB_CONFLICT(HttpStatus.CONFLICT),
    HERO_SKILL_IMAGE_CONFLICT(HttpStatus.CONFLICT),
    HERO_NOT_FOUND(HttpStatus.NOT_FOUND),
    HERO_REVISION_NOT_FOUND(HttpStatus.NOT_FOUND),
    HERO_CODE_EXISTS(HttpStatus.CONFLICT),
    HERO_DRAFT_EXISTS(HttpStatus.CONFLICT),
    HERO_REVISION_VERSION_CONFLICT(HttpStatus.CONFLICT),
    HERO_REVISION_NOT_EDITABLE(HttpStatus.CONFLICT),
    HERO_INVALID_CONTENT(HttpStatus.UNPROCESSABLE_ENTITY),
    HERO_IMPORT_CONTEXT_CONFLICT(HttpStatus.UNPROCESSABLE_ENTITY),
    HERO_IMPORT_SNAPSHOT_EXISTS(HttpStatus.UNPROCESSABLE_ENTITY),
    HERO_IMPORT_MISSING_BASELINE(HttpStatus.UNPROCESSABLE_ENTITY),
    HERO_IMPORT_DRAFT_CONFLICT(HttpStatus.CONFLICT),
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
