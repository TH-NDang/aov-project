package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.internal.domain.model.MediaVersionState;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** A stored version as shown to administrators. */
public record MediaVersionDetails(
        UUID id,
        long versionNo,
        MediaVersionState state,
        String mimeType,
        int width,
        int height,
        long sizeBytes,
        String sha256,
        String url,
        boolean current,
        Instant createdAt,
        @Nullable Instant activatedAt
) {
}
