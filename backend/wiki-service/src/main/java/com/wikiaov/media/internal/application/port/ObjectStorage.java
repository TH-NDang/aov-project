package com.wikiaov.media.internal.application.port;

import java.io.InputStream;
import java.time.Duration;
import java.util.Optional;

/**
 * Port for storing media bytes. The only implementation talks to any S3-compatible service (ADR-006).
 *
 * <p>Object keys are immutable: a key that already holds a READY media version is never overwritten.
 * Calls may block on the network, so they must not run inside a long database transaction.
 * Failures are reported as {@link com.wikiaov.platform.ApiException} with a
 * {@link com.wikiaov.media.internal.application.MediaErrorCode}.
 */
public interface ObjectStorage {

    /** Uploads {@code contentLength} bytes from {@code content} to {@code key}. */
    void put(String key, InputStream content, long contentLength, String contentType);

    /** Returns object metadata, or empty if no object exists at {@code key}. */
    Optional<StoredObject> stat(String key);

    /**
     * Opens the object for reading. The caller must close the stream.
     *
     * @throws com.wikiaov.platform.ApiException with {@code MEDIA_OBJECT_NOT_FOUND} if the key does not exist
     */
    InputStream open(String key);

    /** Copies an object inside the bucket, e.g. from {@code incoming/} to {@code assets/}. */
    void copy(String sourceKey, String targetKey);

    /** Deletes the object. Deleting a missing key is not an error. */
    void delete(String key);

    /** Creates a URL that lets a client upload one object directly, without going through the backend. */
    PresignedRequest presignPut(String key, String contentType, Duration validity);

    /** Creates a temporary download URL for a private object. */
    PresignedRequest presignGet(String key, Duration validity);
}
