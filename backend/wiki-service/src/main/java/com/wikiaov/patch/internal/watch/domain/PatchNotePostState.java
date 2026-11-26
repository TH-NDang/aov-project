package com.wikiaov.patch.internal.watch.domain;

/**
 * Where a post stands in the Admin inbox. {@code EARLIER} marks posts that were already old when a source was first
 * read, so the inbox does not open with a page's whole history.
 */
public enum PatchNotePostState {
    NEW,
    DONE,
    DISMISSED,
    EARLIER;

    /** States an editor may move a post to. {@code EARLIER} is only set by the check itself. */
    public boolean chosenByEditor() {
        return this != EARLIER;
    }
}
