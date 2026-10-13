package com.wikiaov.media.internal.domain.model;

/** State of one stored byte version. Whether it is served is decided by {@code MediaAsset.currentVersionId}. */
public enum MediaVersionState {
    /** Validated and stored under its immutable key. */
    READY,
    /** Kept for history; must not be activated again. */
    DEPRECATED,
    /** Withdrawn; must not be served. */
    BLOCKED
}
