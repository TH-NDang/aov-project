package com.wikiaov.media;

/** Which revisions of the owner reference an asset. */
public enum MediaUsageScope {
    /** Referenced by a published, currently effective revision. */
    CURRENT,
    /** Referenced by an unpublished draft. */
    DRAFT,
    /** Referenced by an older published revision kept for history. */
    HISTORICAL
}
