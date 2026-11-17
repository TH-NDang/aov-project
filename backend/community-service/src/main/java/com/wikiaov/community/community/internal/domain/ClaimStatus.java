package com.wikiaov.community.community.internal.domain;

/** Where a request to manage a page stands: waiting for review, approved or rejected. */
public enum ClaimStatus {
    PENDING,
    APPROVED,
    REJECTED
}
