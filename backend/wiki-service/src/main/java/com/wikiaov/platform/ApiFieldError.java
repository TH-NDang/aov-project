package com.wikiaov.platform;

/**
 * A single field error inside a ProblemDetail ({@code errors[]}).
 *
 * @param path    dot/index path, e.g. {@code content.skills[1].translations[0].description}
 * @param code    stable code, e.g. {@code NOT_BLANK} or {@code HERO_PORTRAIT_REQUIRED}
 * @param message human-readable explanation
 */
public record ApiFieldError(
        String path,
        String code,
        String message
) {
}
