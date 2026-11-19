package com.wikiaov.media.internal.deletion.domain;

/** How far the removal of an asset has gone; a retry resumes from the state it stopped in. */
public enum MediaDeletionState {
    /** The deletion is recorded; no stored object has been removed yet. */
    PREPARED,
    /** The stored objects are gone; the CDN cache may still serve them. */
    ORIGIN_DELETED,
    /** Objects and cached copies are gone. */
    COMPLETE
}
