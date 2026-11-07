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
import com.wikiaov.media.internal.provenance.persistence.entity.MediaProvenance;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
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
        return details(asset, versions.findByAssetIdOrderByVersionNoDesc(asset.getId()),
                provenance.findByAssetIdOrderByCreatedAtAscIdAsc(asset.getId()));
    }

    /** Details of several assets in the given order, reading each table once rather than once per asset. */
    public List<MediaAssetDetails> details(List<MediaAsset> assets) {
        if (assets.isEmpty()) {
            return List.of();
        }

        List<UUID> ids = assets.stream().map(MediaAsset::getId).toList();
        var versionsOf = versions.findByAssetIdInOrderByVersionNoDesc(ids).stream()
                .collect(Collectors.groupingBy(MediaAssetVersion::getAssetId));
        var provenanceOf = provenance.findByAssetIdInOrderByCreatedAtAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(MediaProvenance::getAssetId));

        return assets.stream()
                .map(asset -> details(asset, versionsOf.getOrDefault(asset.getId(), List.of()),
                        provenanceOf.getOrDefault(asset.getId(), List.of())))
                .toList();
    }

    private MediaAssetDetails details(MediaAsset asset, List<MediaAssetVersion> assetVersions,
            List<MediaProvenance> assetProvenance) {
        List<MediaVersionDetails> versionDetails = assetVersions.stream()
                .map(version -> versionDetails(asset, version))
                .toList();
        List<ProvenanceDetails> provenanceDetails = assetProvenance.stream()
                .map(record -> new ProvenanceDetails(record.getId(), record.getAssetVersionId(),
                        record.getSourceType(), record.getSourceLabel(), record.getSourceUrl(),
                        record.getObservedAt(), record.getNote(), record.getOwnerName(), record.getContactUrl(),
                        record.getOwnerId(), record.getOwnerPageId(), record.getRelatedPageId(),
                        record.getReferenceVersion()))
                .toList();
        return new MediaAssetDetails(asset.getId(), asset.getSemanticType(), asset.getLifecycleState(),
                asset.getLockVersion(), asset.getCurrentVersionId(), versionDetails, provenanceDetails,
                asset.getCreatedAt(), asset.getUpdatedAt());
    }

    public MediaVersionDetails versionDetails(MediaAsset asset, MediaAssetVersion version) {
        return new MediaVersionDetails(version.getId(), version.getVersionNo(), version.getState(),
                version.getMimeType(), version.getWidth(), version.getHeight(), version.getSizeBytes(),
                version.getSha256(), urls.publicUrl(version), version.getId().equals(asset.getCurrentVersionId()),
                version.getCreatedAt(), version.getActivatedAt(), version.focalPoint());
    }

    public MediaVersionResult result(MediaAsset asset, MediaAssetVersion version, boolean duplicate) {
        return new MediaVersionResult(asset.getId(), version.getId(), version.getVersionNo(), version.getState(),
                version.getMimeType(), version.getWidth(), version.getHeight(), version.getSizeBytes(),
                version.getSha256(), urls.publicUrl(version), version.getId().equals(asset.getCurrentVersionId()),
                duplicate);
    }
}
