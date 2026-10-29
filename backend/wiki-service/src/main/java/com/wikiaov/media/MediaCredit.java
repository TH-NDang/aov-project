package com.wikiaov.media;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** Public attribution only; internal import notes and file paths are never included. */
public record MediaCredit(
        String type,
        String label,
        @Nullable String url,
        @Nullable String ownerName,
        @Nullable String contactUrl,
        @Nullable Instant observedAt
) {
}
