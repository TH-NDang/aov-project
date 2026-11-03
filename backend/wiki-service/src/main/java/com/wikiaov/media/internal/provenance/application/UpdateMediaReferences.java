package com.wikiaov.media.internal.provenance.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.asset.application.MediaAssetAccess;
import com.wikiaov.media.internal.provenance.persistence.MediaProvenanceRepository;
import com.wikiaov.media.internal.query.application.MediaAssetViews;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.platform.ApiException;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Changes only editorial page links; source attribution and bytes remain intact. */
@Service
public class UpdateMediaReferences {
    private final MediaAssetAccess assets;
    private final MediaProvenanceRepository sources;
    private final MediaAssetViews views;
    private final CurrentActor actors;
    private final AuditLog audit;

    public UpdateMediaReferences(MediaAssetAccess assets, MediaProvenanceRepository sources, MediaAssetViews views,
            CurrentActor actors, AuditLog audit) {
        this.assets = assets;
        this.sources = sources;
        this.views = views;
        this.actors = actors;
        this.audit = audit;
    }

    @Transactional
    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    public MediaAssetDetails execute(UUID assetId, UUID sourceId, long expectedVersion,
            @Nullable UUID ownerPageId, @Nullable UUID relatedPageId) {
        var actor = actors.require();
        var asset = assets.requireActiveAsset(assetId);
        var source = sources.findByAssetIdOrderByCreatedAtAsc(assetId).stream()
                .filter(row -> sourceId.equals(row.getId())).findFirst()
                .orElseThrow(
                        () -> new ApiException(MediaErrorCode.MEDIA_SOURCE_NOT_FOUND, "Media source does not exist."));
        if (source.getReferenceVersion() != expectedVersion)
            throw new ApiException(MediaErrorCode.MEDIA_SOURCE_VERSION_CONFLICT,
                    "Media references have changed. Reload before saving.");

        var before = MediaWritePolicy.metadata("ownerPageId", source.getOwnerPageId(), "relatedPageId",
                source.getRelatedPageId());
        source.reference(ownerPageId, relatedPageId);
        sources.flush();
        audit.record(new AuditEntry(actor, "MEDIA_SOURCE_REFERENCES_UPDATED", MediaWritePolicy.AUDIT_AGGREGATE,
                assetId, null, null, null, null, MediaWritePolicy.metadata("sourceId", sourceId.toString(),
                        "before", before, "ownerPageId", ownerPageId, "relatedPageId", relatedPageId)));
        return views.details(asset);
    }
}
