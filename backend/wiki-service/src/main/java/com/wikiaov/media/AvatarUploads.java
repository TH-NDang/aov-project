package com.wikiaov.media;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Restricted avatar upload contract: callers can complete only their own avatar uploads. */
public interface AvatarUploads {
    Ticket begin(String fileName, String contentType, long sizeBytes);
    Result complete(UUID uploadId);
    boolean canBind(UUID assetId);
    Optional<String> previewUrl(UUID assetId);

    record Ticket(
            UUID uploadId,
            UUID assetId,
            String method,
            URI uploadUrl,
            Map<String, String> headers,
            Instant expiresAt
    ) {
    }
    record Result(
            UUID assetId,
            String avatarUrl
    ) {
    }
}
