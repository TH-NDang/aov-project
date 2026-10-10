package com.wikiaov.platform;

import org.springframework.http.HttpStatus;

/**
 * Contract for stable error codes that clients branch on.
 *
 * <p>Each module declares its own enum implementing this interface (e.g. {@code HeroErrorCode});
 * platform never imports business codes. Codes must be unique across all modules.
 */
public interface ApiErrorCode {

    /** Stable code, e.g. {@code HERO_NOT_FOUND}. Enums provide it through {@code name()}. */
    String name();

    HttpStatus status();

    /** Short human-readable title of the error type; wording may change, never branch on it. */
    String title();
}
