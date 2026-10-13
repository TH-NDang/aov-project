package com.wikiaov.media.internal.application.response;

import com.wikiaov.media.internal.domain.model.MediaVersionState;

import java.util.UUID;

/**
 * Result of completing an upload or registering an import.
 *
 * @param current   whether this version is now served (the first version of an asset is activated automatically)
 * @param duplicate the asset already had these exact bytes; the existing version is returned and nothing is created
 */
public record MediaVersionResult(
        UUID assetId,
        UUID versionId,
        long versionNo,
        MediaVersionState state,
        String mimeType,
        int width,
        int height,
        long sizeBytes,
        String sha256,
        String url,
        boolean current,
        boolean duplicate
) {
}
