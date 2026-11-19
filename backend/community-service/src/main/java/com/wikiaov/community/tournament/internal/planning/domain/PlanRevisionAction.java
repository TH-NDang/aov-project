package com.wikiaov.community.tournament.internal.planning.domain;

import java.util.Set;

/** What a revision of a competition plan records. */
public enum PlanRevisionAction {
    SAVE,
    MATERIALIZE,
    PUBLISH,
    WITHDRAW;

    /** A plan with a revision of one of these has been public, so its history protects what it names. */
    public static final Set<PlanRevisionAction> PUBLIC_HISTORY = Set.of(PUBLISH, WITHDRAW);
}
