package com.wikiaov.community.platform;

import org.springframework.http.HttpStatus;

/** Errors that no business module owns: parsing, versioning, security, storage conflicts and failures. */
public enum PlatformErrorCode implements ApiErrorCode {
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "Invalid request"),
    INVALID_QUERY_PARAMETER(HttpStatus.BAD_REQUEST, "Invalid query parameter"),
    INVALID_API_VERSION(HttpStatus.BAD_REQUEST, "Unsupported API version"),
    MISSING_API_VERSION(HttpStatus.BAD_REQUEST, "Missing API version"),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "Unauthenticated"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "Forbidden"),
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND, "Resource not found"),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed"),
    NOT_ACCEPTABLE(HttpStatus.NOT_ACCEPTABLE, "Not acceptable"),
    VERSION_CONFLICT(HttpStatus.CONFLICT, "Version conflict"),
    /** A unique constraint refused the row, in any module: a code, a slug or a linked profile is already taken. */
    DUPLICATE_RECORD(HttpStatus.CONFLICT, "Duplicate record"),
    PAYLOAD_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "Payload too large"),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported media type"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Internal error");

    private final HttpStatus status;
    private final String title;

    PlatformErrorCode(HttpStatus status, String title) {
        this.status = status;
        this.title = title;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String title() {
        return title;
    }
}
