package com.wikiaov.community.platform;

/** Errors that no business module owns: parsing, versioning, storage conflicts and failures. */
public enum PlatformErrorCode implements ApiErrorCode {
    INVALID_REQUEST(400),
    INVALID_QUERY_PARAMETER(400),
    INVALID_API_VERSION(400),
    MISSING_API_VERSION(400),
    RESOURCE_NOT_FOUND(404),
    METHOD_NOT_ALLOWED(405),
    NOT_ACCEPTABLE(406),
    VERSION_CONFLICT(409),
    /**
     * A unique constraint refused the row. The name predates this enum and is kept because Admin and Stream branch
     * on it for pages as well as tournament records.
     */
    TOURNAMENT_DUPLICATE_CODE(409),
    PAYLOAD_TOO_LARGE(413),
    UNSUPPORTED_MEDIA_TYPE(415),
    INTERNAL_ERROR(500);

    private final int status;

    PlatformErrorCode(int status) {
        this.status = status;
    }

    @Override
    public int status() {
        return status;
    }
}
