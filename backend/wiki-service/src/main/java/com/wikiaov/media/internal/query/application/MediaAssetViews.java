package com.wikiaov.media.internal.query.application;

import com.wikiaov.media.internal.application.response.*;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.application.response.MediaVersionDetails;
import com.wikiaov.media.internal.application.response.MediaVersionResult;
import com.wikiaov.media.internal.application.response.ProvenanceDetails;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAssetVersion;
import com.wikiaov.media.internal.provenance.persistence.MediaProvenanceRepository;
import java.util.List;
import org.springframework.stereotype.Component;

/** Reads version and provenance data only when an asset view is requested. */
@Component
public class MediaAssetViews {
    private final MediaAssetVersionRepository versions;
    private final MediaProvenanceRepository provenance;
    private final MediaUrls urls;

    public MediaAssetViews(MediaAssetVersionRepository versions, MediaProvenanceRepository provenance, MediaUrls urls) {
        this.versions = versions;
        this.provenance = provenance;
        this.urls = urls;
    }

    public MediaAssetDetails details(MediaAsset asset) {
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

    public MediaVersionDetails versionDetails(MediaAsset asset, MediaAssetVersion version) {
        return new MediaVersionDetails(version.getId(), version.getVersionNo(), version.getState(),
                version.getMimeType(), version.getWidth(), version.getHeight(), version.getSizeBytes(),
                version.getSha256(), urls.publicUrl(version), version.getId().equals(asset.getCurrentVersionId()),
                version.getCreatedAt(), version.getActivatedAt());
    }

    public MediaVersionResult result(MediaAsset asset, MediaAssetVersion version, boolean duplicate) {
        return new MediaVersionResult(asset.getId(), version.getId(), version.getVersionNo(), version.getState(),
                version.getMimeType(), version.getWidth(), version.getHeight(), version.getSizeBytes(),
                version.getSha256(), urls.publicUrl(version), version.getId().equals(asset.getCurrentVersionId()),
                duplicate);
    }
}
