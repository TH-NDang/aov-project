package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.internal.domain.model.UploadState;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Server-side state of an upload, so a client that lost a response can find out what happened. */
public record UploadStatus(
        UUID uploadId,
        UUID assetId,
        UploadState state,
        @Nullable String fileName,
        String declaredMimeType,
        long declaredSizeBytes,
        Instant completeBefore,
        @Nullable UUID versionId,
        @Nullable String errorCode,
        Instant createdAt,
        @Nullable Instant completedAt
) {
}
