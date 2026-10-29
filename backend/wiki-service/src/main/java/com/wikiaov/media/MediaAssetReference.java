package com.wikiaov.media;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * What other modules may know about an asset.
 *
 * @param assetId        asset id
 * @param semanticType   what the asset depicts
 * @param state          lifecycle state
 * @param currentVersion version currently served, or {@code null} before the first upload completes
 */
public record MediaAssetReference(
        UUID assetId,
        MediaSemanticType semanticType,
        MediaAssetState state,
        @Nullable CurrentVersion currentVersion
) {

    public MediaAssetReference {
        Objects.requireNonNull(assetId, "assetId");
        Objects.requireNonNull(semanticType, "semanticType");
        Objects.requireNonNull(state, "state");
    }

    /** An asset can be bound by another module only when it is active and has bytes to show. */
    public boolean usable() {
        return state == MediaAssetState.ACTIVE && currentVersion != null;
    }

    /**
     * @param versionId version id
     * @param mimeType  verified MIME type, e.g. {@code image/webp}
     * @param width     width in pixels
     * @param height    height in pixels
     * @param url       public, immutable URL of the bytes
     */
    public record CurrentVersion(
            UUID versionId,
            String mimeType,
            int width,
            int height,
            String url,
            List<MediaCredit> sources
    ) {

        public CurrentVersion(UUID versionId, String mimeType, int width, int height, String url) {
            this(versionId, mimeType, width, height, url, List.of());
        }

        public CurrentVersion {
            sources = List.copyOf(sources);
        }
    }
}
