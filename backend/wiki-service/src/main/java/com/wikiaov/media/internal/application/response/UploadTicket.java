package com.wikiaov.media.internal.application.response;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Everything the client needs to upload the bytes directly to object storage.
 *
 * @param uploadUrl      presigned URL; send {@code method} with exactly {@code headers}
 * @param expiresAt      the upload URL stops working at this instant
 * @param completeBefore {@code complete} must be called before this instant
 */
public record UploadTicket(
        UUID uploadId,
        UUID assetId,
        String objectKey,
        String method,
        URI uploadUrl,
        Map<String, String> headers,
        Instant expiresAt,
        Instant completeBefore
) {
}
