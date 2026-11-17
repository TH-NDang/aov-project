package com.wikiaov.community.platform;

/**
 * A single field error inside a problem detail ({@code errors[]}).
 *
 * @param path    dot and index path, e.g. {@code content.placements[1].teamId}
 * @param code    stable code, e.g. {@code UNKNOWN_FIELD} or {@code NOT_BLANK}
 * @param message human-readable explanation
 */
public record ApiFieldError(
        String path,
        String code,
        String message
) {
}
