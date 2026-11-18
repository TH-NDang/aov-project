package com.wikiaov.platform;

/**
 * Lifecycle of a catalog revision shared by heroes, their sections, the four warehouse catalogs and game modes. The
 * names are stored as text ({@code @Enumerated(EnumType.STRING)}) and sent as text in JSON.
 */
public enum RevisionState {
    /** Editable; not visible to readers. */
    DRAFT,
    /** Visible to readers from its publication; never edited again. */
    PUBLISHED,
    /** Abandoned draft; kept for history. */
    DISCARDED
}
