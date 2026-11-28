package com.wikiaov.video.internal.domain;

/**
 * Why a reader would watch this video. The three patch purposes belong to patch videos only: a preview of the test
 * server, an overview of the official notes, and a review once the patch has been played.
 */
public enum VideoPurpose {
    INTRO,
    GUIDE_BASIC,
    GUIDE_ADVANCED,
    SKILL_DEMO,
    SKIN_SHOWCASE,
    SKIN_TRAILER,
    LORE,
    PATCH_CHANGE,
    PATCH_PREVIEW,
    PATCH_OVERVIEW,
    PATCH_REVIEW,
    OTHER;

    public boolean patchOnly() {
        return this == PATCH_PREVIEW || this == PATCH_OVERVIEW || this == PATCH_REVIEW;
    }
}
