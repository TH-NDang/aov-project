package com.wikiaov.media.internal.provenance.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.SourceInput;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.asset.application.MediaAssetAccess;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.provenance.persistence.MediaProvenanceRepository;
import com.wikiaov.media.internal.query.application.MediaAssetViews;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Adds attribution without replacing bytes or changing references in published content. */
@Service
public class AddMediaSource {
    private final MediaAssetAccess assets;
    private final MediaAssetVersionRepository versions;
    private final MediaProvenanceRepository provenance;
    private final MediaAssetViews views;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public AddMediaSource(MediaAssetAccess assets, MediaAssetVersionRepository versions,
            MediaProvenanceRepository provenance, MediaAssetViews views, CurrentActor actors, AuditLog audit,
            Clock clock) {
        this.assets = assets;
        this.versions = versions;
        this.provenance = provenance;
        this.views = views;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public MediaAssetDetails execute(UUID assetId, UUID versionId, SourceInput source) {
        var actor = actors.require();
        var asset = assets.requireActiveAsset(assetId);
        versions.findById(versionId).filter(version -> assetId.equals(version.getAssetId()))
                .orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_VERSION_NOT_FOUND,
                        "Media version does not exist."));

        boolean exists = provenance.findByAssetIdOrderByCreatedAtAsc(assetId).stream()
                .anyMatch(record -> versionId.equals(record.getAssetVersionId())
                        && source.type() == record.getSourceType()
                        && source.label().equals(record.getSourceLabel())
                        && Objects.equals(source.url(), record.getSourceUrl())
                        && Objects.equals(source.note(), record.getNote())
                        && Objects.equals(source.observedAt(), record.getObservedAt())
                        && Objects.equals(source.ownerName(), record.getOwnerName())
                        && Objects.equals(source.contactUrl(), record.getContactUrl()));
        if (!exists) {
            var saved = provenance.save(source.toProvenance(assetId, versionId, clock.instant()));
            audit.record(new AuditEntry(actor, "MEDIA_SOURCE_ADDED", MediaWritePolicy.AUDIT_AGGREGATE, assetId,
                    null, null, null, null, MediaWritePolicy.metadata("versionId", versionId.toString(),
                            "sourceId", saved.getId().toString())));
        }
        return views.details(asset);
    }
}
