package com.wikiaov.media.internal.application.service;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.internal.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.persistence.entity.MediaAsset;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Implements the public {@link MediaAssets} contract for other modules. */
@Service
class MediaAssetLookup implements MediaAssets {

    private final MediaAssetRepository assets;
    private final MediaAssetVersionRepository versions;
    private final MediaUrls urls;

    MediaAssetLookup(MediaAssetRepository assets, MediaAssetVersionRepository versions, MediaUrls urls) {
        this.assets = assets;
        this.versions = versions;
        this.urls = urls;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MediaAssetReference> find(UUID assetId) {
        return assets.findById(assetId).map(asset -> new MediaAssetReference(asset.getId(),
                asset.getSemanticType(), asset.getLifecycleState(), currentVersion(asset)));
    }

    private MediaAssetReference.@Nullable CurrentVersion currentVersion(MediaAsset asset) {
        if (asset.getCurrentVersionId() == null) {
            return null;
        }
        return versions.findById(asset.getCurrentVersionId())
                .map(version -> new MediaAssetReference.CurrentVersion(version.getId(), version.getMimeType(),
                        version.getWidth(), version.getHeight(), urls.publicUrl(version)))
                .orElse(null);
    }
}
