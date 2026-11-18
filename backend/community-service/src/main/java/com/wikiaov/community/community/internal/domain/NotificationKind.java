package com.wikiaov.community.community.internal.domain;

import java.util.Set;

/**
 * What a notification tells its reader. The reader's app words each kind in the reader's language from the kind and
 * its parameters; the backend stores no sentence. See spec 04, notifications.
 */
public enum NotificationKind {
    /** A followed page published a post as the page. */
    PAGE_POST_PUBLISHED(NotificationKind.PAGE_NAME),
    /** A followed page started a live broadcast. */
    PAGE_LIVE_STARTED(NotificationKind.PAGE_NAME, NotificationKind.TITLE),
    /** Someone else commented on the reader's post. */
    POST_COMMENTED,
    /** A moderator resolved the reader's report. */
    REPORT_RESOLVED,
    /** An administrator approved the reader's claim to manage the page. */
    PAGE_CLAIM_APPROVED,
    /** An administrator rejected the reader's claim to manage the page. */
    PAGE_CLAIM_REJECTED,
    /** The reader became the owner of the page, by a handover code or a transfer. */
    PAGE_OWNERSHIP_RECEIVED,
    /** The reader no longer manages the page. */
    PAGE_MEMBERSHIP_REVOKED;

    /** The page's published name when the notification was sent. */
    public static final String PAGE_NAME = "pageName";

    /** The title of a live broadcast. */
    public static final String TITLE = "title";

    private final Set<String> parameters;

    NotificationKind(String... parameters) {
        this.parameters = Set.of(parameters);
    }

    /** The parameter names the kind is worded with; a notification carries exactly these. */
    public Set<String> parameters() {
        return parameters;
    }
}
