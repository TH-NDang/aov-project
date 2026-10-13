package com.wikiaov.media;

/** Lifecycle of a logical asset. Assets are never hard-deleted while something may reference them. */
public enum MediaAssetState {
    /** Normal state: new versions can be uploaded and the asset can be bound. */
    ACTIVE,
    /** Kept for history; must not be bound again. */
    DEPRECATED,
    /** Withdrawn, e.g. for legal reasons; must not be served or bound. */
    BLOCKED
}
