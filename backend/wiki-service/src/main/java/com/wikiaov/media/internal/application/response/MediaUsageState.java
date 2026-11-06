package com.wikiaov.media.internal.application.response;

/** The strongest kind of use an image has, so a list can be filtered down to images nothing shows. */
public enum MediaUsageState {
    /** Some place draws it for readers right now. */
    SHOWN,
    /** Only unpublished drafts draw it; it appears once one of them is published. */
    DRAFT_ONLY,
    /** Only older published revisions draw it, which readers reach through history. */
    HISTORY_ONLY,
    /** Only its id is kept, as for an unchosen image option or a skin head that a portrait replaces. */
    STORED_ONLY,
    /** Nothing references it. */
    NONE
}
