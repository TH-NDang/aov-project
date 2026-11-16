package com.wikiaov.media.internal.storage.application.port;

/** Which bucket holds a key prefix (ADR-014, ADR-030), so reports can name the buckets they describe. */
public interface StorageLayout {

    /** Bucket of validated public assets ({@code assets/}). */
    String assetsBucket();

    /** Private bucket of source files ({@code sources/}). */
    String sourcesBucket();

    /** Private bucket of uploads waiting for validation ({@code incoming/}) and imports. */
    String stagingBucket();
}
