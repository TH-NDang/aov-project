package com.wikiaov.video.internal.domain;

/**
 * {@link #PUBLISHED} is public, {@link #DRAFT} waits for review, and {@link #HIDDEN} was rejected. Hidden rows are kept so
 * that importing the same data again does not bring them back.
 */
public enum VideoStatus {
    PUBLISHED,
    DRAFT,
    HIDDEN
}
