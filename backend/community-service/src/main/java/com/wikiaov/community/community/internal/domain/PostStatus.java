package com.wikiaov.community.community.internal.domain;

/** Where a post stands: written but not shown, shown on the page, or hidden by moderation. */
public enum PostStatus {
    DRAFT,
    PUBLISHED,
    HIDDEN
}
