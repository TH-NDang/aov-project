package com.wikiaov.media.internal.application.service;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.internal.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.persistence.entity.MediaAssetVersion;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, MediaAssetReference> findAll(Collection<UUID> assetIds) {
        Set<UUID> requested = Set.copyOf(assetIds);
        if (requested.isEmpty()) {
            return Map.of();
        }
        var found = assets.findByIdIn(requested);
        var versionIds = found.stream().map(MediaAsset::getCurrentVersionId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, MediaAssetVersion> current = versionIds.isEmpty()
                ? Map.of()
                : versions.findByIdIn(versionIds)
                        .stream().collect(Collectors.toMap(MediaAssetVersion::getId, Function.identity()));
        Map<UUID, MediaAssetReference> result = new LinkedHashMap<>();
        for (var asset : found) {
            var version = asset.getCurrentVersionId() == null ? null : current.get(asset.getCurrentVersionId());
            result.put(asset.getId(), new MediaAssetReference(asset.getId(), asset.getSemanticType(),
                    asset.getLifecycleState(), version == null ? null : reference(version)));
        }
        return Map.copyOf(result);
    }

    private MediaAssetReference.@Nullable CurrentVersion currentVersion(MediaAsset asset) {
        if (asset.getCurrentVersionId() == null) {
            return null;
        }
        return versions.findById(asset.getCurrentVersionId())
                .map(this::reference)
                .orElse(null);
    }

    private MediaAssetReference.CurrentVersion reference(MediaAssetVersion version) {
        return new MediaAssetReference.CurrentVersion(version.getId(), version.getMimeType(), version.getWidth(),
                version.getHeight(), urls.publicUrl(version));
    }
}
