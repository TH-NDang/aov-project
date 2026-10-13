package com.wikiaov.media.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.persistence.entity.MediaAssetVersion;
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
    private final MediaSupport support;
    private final CurrentActor currentActor;
    private final AuditLog auditLog;
    private final Clock clock;

    ActivateMediaAssetVersion(MediaAssetVersionRepository versions, MediaSupport support, CurrentActor currentActor,
            AuditLog auditLog, Clock clock) {
        this.versions = versions;
        this.support = support;
        this.currentActor = currentActor;
        this.auditLog = auditLog;
        this.clock = clock;
    }

    @PreAuthorize(MediaSupport.CAN_WRITE_MEDIA)
    @Transactional
    public MediaAssetDetails execute(UUID assetId, UUID versionId, long expectedVersion) {
        Actor actor = currentActor.require();
        MediaAsset asset = support.requireAsset(assetId);
        MediaSupport.checkExpectedVersion(asset, expectedVersion);
        MediaSupport.requireActive(asset);
        MediaAssetVersion version = versions.findById(versionId)
                .filter(candidate -> candidate.getAssetId().equals(assetId))
                .orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_VERSION_NOT_FOUND,
                        "Version " + versionId + " does not exist for this asset."));
        if (!version.isReady()) {
            throw new ApiException(MediaErrorCode.MEDIA_VERSION_NOT_READY,
                    "Only READY versions can be activated.", Map.of("state", version.getState().name()));
        }
        if (versionId.equals(asset.getCurrentVersionId())) {
            return support.details(asset);
        }

        UUID previousVersionId = asset.getCurrentVersionId();
        asset.activate(version, clock.instant());
        MediaAsset saved = support.flush(asset);
        auditLog.record(new AuditEntry(actor, "MEDIA_VERSION_ACTIVATED", MediaSupport.AUDIT_AGGREGATE, assetId, null,
                expectedVersion, saved.getLockVersion(), null, MediaSupport.metadata("versionId",
                        versionId.toString(), "previousVersionId",
                        previousVersionId == null ? null : previousVersionId.toString())));
        return support.details(saved);
    }
}
