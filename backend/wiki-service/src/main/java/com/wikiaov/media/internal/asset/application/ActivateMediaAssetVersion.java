package com.wikiaov.media.internal.asset.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAssetVersion;
import com.wikiaov.media.internal.query.application.MediaAssetViews;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serves another version of the same asset (03 section 33), e.g. a 4K re-export of the same artwork.
 * Owners that bind the asset (hero revisions) do not change: they show the new bytes automatically.
 */
@Service
public class ActivateMediaAssetVersion {

    private final MediaAssetVersionRepository versions;
    private final MediaAssetAccess assetAccess;
    private final MediaAssetViews assetViews;
    private final CurrentActor currentActor;
    private final AuditLog auditLog;
    private final Clock clock;

    ActivateMediaAssetVersion(MediaAssetVersionRepository versions, MediaAssetAccess assetAccess,
            MediaAssetViews assetViews, CurrentActor currentActor,
            AuditLog auditLog, Clock clock) {
        this.versions = versions;
        this.assetAccess = assetAccess;
        this.assetViews = assetViews;
        this.currentActor = currentActor;
        this.auditLog = auditLog;
        this.clock = clock;
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public MediaAssetDetails execute(UUID assetId, UUID versionId, long expectedVersion) {
        Actor actor = currentActor.require();
        MediaAsset asset = assetAccess.requireAsset(assetId);
        MediaWritePolicy.checkExpectedVersion(asset, expectedVersion);
        MediaWritePolicy.requireActive(asset);
        MediaAssetVersion version = versions.findById(versionId)
                .filter(candidate -> candidate.getAssetId().equals(assetId))
                .orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_VERSION_NOT_FOUND,
                        "Version " + versionId + " does not exist for this asset."));
        if (!version.isReady()) {
            throw new ApiException(MediaErrorCode.MEDIA_VERSION_NOT_READY,
                    "Only READY versions can be activated.", Map.of("state", version.getState().name()));
        }
        if (versionId.equals(asset.getCurrentVersionId())) {
            return assetViews.details(asset);
        }

        UUID previousVersionId = asset.getCurrentVersionId();
        asset.activate(version, clock.instant());
        MediaAsset saved = assetAccess.flush(asset);
        auditLog.record(
                new AuditEntry(actor, "MEDIA_VERSION_ACTIVATED", MediaWritePolicy.AUDIT_AGGREGATE, assetId, null,
                        expectedVersion, saved.getLockVersion(), null, MediaWritePolicy.metadata("versionId",
                                versionId.toString(), "previousVersionId",
                                previousVersionId == null ? null : previousVersionId.toString())));
        return assetViews.details(saved);
    }
}
