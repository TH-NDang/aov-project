package com.wikiaov.media.internal.storage.application.port;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** Metadata of an object as reported by the storage. Content type is the declared one, not a verified MIME. */
public record StoredObject(
        String key,
        long sizeBytes,
        @Nullable String contentType,
        @Nullable String eTag,
        @Nullable Instant lastModified
) {
}
