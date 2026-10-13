package com.wikiaov.media.internal.domain.model;

/**
 * State of an upload session (02 section 17).
 *
 * <pre>
 * REQUESTED --complete--> VALIDATING --valid--> READY
 *     |                       |-----invalid---> REJECTED
 *     |                       '--storage error-> REQUESTED (retry allowed)
 *     '--deadline passed----> EXPIRED
 * </pre>
 */
public enum UploadState {
    REQUESTED,
    VALIDATING,
    READY,
    REJECTED,
    EXPIRED
}
