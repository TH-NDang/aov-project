package com.wikiaov.patch.internal.watch.domain;

/** Why the last check of a source failed. */
public enum PatchNoteFailure {
    /** No answer: DNS, connection, timeout. */
    UNREACHABLE,
    /** The page answered with a status other than 200 or 304. */
    HTTP_STATUS,
    /** The page is larger than the check reads. */
    TOO_LARGE,
    /** The page was read but no post could be found in it; its layout has probably changed. */
    UNREADABLE
}
