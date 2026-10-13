package com.wikiaov.media.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.Capabilities;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.application.response.MediaVersionDetails;
import com.wikiaov.media.internal.application.response.MediaVersionResult;
import com.wikiaov.media.internal.application.response.ProvenanceDetails;
import com.wikiaov.media.internal.domain.image.InvalidMediaException;
import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.persistence.MediaProvenanceRepository;
import com.wikiaov.media.internal.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.persistence.entity.MediaAssetVersion;
import com.wikiaov.platform.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;

/** Lookups, guards and mappings shared by the media use cases. */
@Component
class MediaSupport {

    /** Layer 2 of the access checks (01 section 20.4): every media write needs {@code media:write}. */
    static final String CAN_WRITE_MEDIA = "hasAuthority('" + Capabilities.MEDIA_WRITE + "')";
    static final String AUDIT_AGGREGATE = "MEDIA_ASSET";

    private final MediaAssetRepository assets;
    private final MediaAssetVersionRepository versions;
    private final MediaProvenanceRepository provenance;
    private final MediaUrls urls;

    MediaSupport(MediaAssetRepository assets, MediaAssetVersionRepository versions,
            MediaProvenanceRepository provenance, MediaUrls urls) {
        this.assets = assets;
        this.versions = versions;
        this.provenance = provenance;
        this.urls = urls;
    }

    MediaAsset requireAsset(UUID assetId) {
        return assets.findById(assetId).orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_ASSET_NOT_FOUND,
                "Media asset " + assetId + " does not exist."));
    }

    MediaAsset requireActiveAsset(UUID assetId) {
        MediaAsset asset = requireAsset(assetId);
        requireActive(asset);
        return asset;
    }

    static void requireActive(MediaAsset asset) {
        if (!asset.isActive()) {
            throw new ApiException(MediaErrorCode.MEDIA_ASSET_NOT_ACTIVE,
                    "Media asset " + asset.getId() + " is " + asset.getLifecycleState() + ".",
                    Map.of("state", asset.getLifecycleState().name()));
        }
    }

    static void checkExpectedVersion(MediaAsset asset, long expectedVersion) {
        if (asset.getLockVersion() != expectedVersion) {
            throw versionConflict(asset.getLockVersion());
        }
    }

    static ApiException versionConflict(@Nullable Long currentVersion) {
        String detail = "The media asset was modified by another request.";
        return currentVersion == null
                ? new ApiException(MediaErrorCode.MEDIA_ASSET_VERSION_CONFLICT, detail)
                : new ApiException(MediaErrorCode.MEDIA_ASSET_VERSION_CONFLICT, detail,
                        Map.of("currentVersion", currentVersion));
    }

    /** Writes pending changes now, so a concurrent modification is reported as a conflict, not a 500. */
    MediaAsset flush(MediaAsset asset) {
        try {
            return assets.saveAndFlush(asset);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw versionConflict(null);
        }
    }

    static ActorRef ref(Actor actor) {
        return new ActorRef(actor.issuer(), actor.subject());
    }

    static ApiException invalidMedia(InvalidMediaException ex) {
        return new ApiException(MediaErrorCode.INVALID_MEDIA_OBJECT, ex.getMessage(), List.of(),
                Map.of("reason", ex.reason().name()), ex);
    }

    /** Audit metadata without null values. */
    static Map<String, Object> metadata(Object... keysAndValues) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            if (keysAndValues[i + 1] != null) {
                metadata.put((String) keysAndValues[i], keysAndValues[i + 1]);
            }
        }
        return metadata;
    }

    MediaAssetDetails details(MediaAsset asset) {
        List<MediaVersionDetails> versionDetails = versions.findByAssetIdOrderByVersionNoDesc(asset.getId()).stream()
                .map(version -> versionDetails(asset, version))
                .toList();
        List<ProvenanceDetails> provenanceDetails = provenance.findByAssetIdOrderByCreatedAtAsc(asset.getId())
                .stream()
                .map(record -> new ProvenanceDetails(record.getId(), record.getAssetVersionId(),
                        record.getSourceType(), record.getSourceLabel(), record.getSourceUrl(),
                        record.getObservedAt(), record.getNote()))
                .toList();
        return new MediaAssetDetails(asset.getId(), asset.getSemanticType(), asset.getLifecycleState(),
                asset.getLockVersion(), asset.getCurrentVersionId(), versionDetails, provenanceDetails,
                asset.getCreatedAt(), asset.getUpdatedAt());
    }

    MediaVersionDetails versionDetails(MediaAsset asset, MediaAssetVersion version) {
        return new MediaVersionDetails(version.getId(), version.getVersionNo(), version.getState(),
                version.getMimeType(), version.getWidth(), version.getHeight(), version.getSizeBytes(),
                version.getSha256(), urls.publicUrl(version), version.getId().equals(asset.getCurrentVersionId()),
                version.getCreatedAt(), version.getActivatedAt());
    }

    MediaVersionResult result(MediaAsset asset, MediaAssetVersion version, boolean duplicate) {
        return new MediaVersionResult(asset.getId(), version.getId(), version.getVersionNo(), version.getState(),
                version.getMimeType(), version.getWidth(), version.getHeight(), version.getSizeBytes(),
                version.getSha256(), urls.publicUrl(version), version.getId().equals(asset.getCurrentVersionId()),
                duplicate);
    }
}
