package com.wikiaov.media.internal.domain.image;

/** Why bytes were refused. Sent to clients as {@code context.reason} of {@code INVALID_MEDIA_OBJECT}. */
public enum InvalidMediaReason {
    EMPTY,
    UNSUPPORTED_FORMAT,
    CORRUPT_IMAGE,
    TOO_LARGE,
    DIMENSION_TOO_LARGE,
    TOO_MANY_PIXELS
}
