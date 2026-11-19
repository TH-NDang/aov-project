package com.wikiaov.media.internal.source.domain;

/** Why uploaded source bytes were refused; stored on the upload as its name and sent to the client in the error. */
public enum SourceRejection {
    /** The stored object is not as large as the client declared. */
    SIZE_MISMATCH,
    /** The bytes do not hash to the declared SHA-256. */
    SHA256_MISMATCH,
    /** The bytes do not start like the declared content type. */
    TYPE_MISMATCH
}
