package com.wikiaov.media;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Public attribution only; internal import notes and file paths are never included.
 *
 * @param unverified recorded without evidence of where the image came from (V074); it never counts as a credit, and
 *                   clients word it themselves instead of showing {@code label}, which a placeholder leaves empty
 */
public record MediaCredit(
        String type,
        String label,
        boolean unverified,
        @Nullable String url,
        @Nullable String ownerName,
        @Nullable String contactUrl,
        @Nullable Instant observedAt,
        @Nullable UUID ownerPageId,
        @Nullable UUID relatedPageId
) {
}
