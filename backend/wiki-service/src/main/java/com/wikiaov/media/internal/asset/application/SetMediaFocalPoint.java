package com.wikiaov.media.internal.asset.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.query.application.MediaAssetViews;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.platform.ApiException;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Records which point of a picture must stay in view when it is cropped, usually a face. It belongs to one version: another
 * version of the same asset can frame its subject differently. The bytes stay untouched, as this only guides how they are shown.
 */
@Service
public class SetMediaFocalPoint {

    private final MediaAssetAccess assets;
    private final MediaAssetVersionRepository versions;
    private final MediaAssetViews views;
    private final CurrentActor actors;
    private final AuditLog audit;

    SetMediaFocalPoint(MediaAssetAccess assets, MediaAssetVersionRepository versions, MediaAssetViews views,
            CurrentActor actors, AuditLog audit) {
        this.assets = assets;
        this.versions = versions;
        this.views = views;
        this.actors = actors;
        this.audit = audit;
    }

    /** Sets the point, or clears it with {@code null}. */
    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public MediaAssetDetails execute(UUID assetId, UUID versionId, MediaAssetReference.@Nullable FocalPoint point) {
        var actor = actors.require();
        var asset = assets.requireActiveAsset(assetId);
        var version = versions.findById(versionId)
                .filter(candidate -> assetId.equals(candidate.getAssetId()))
                .orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_VERSION_NOT_FOUND,
                        "Media version does not exist."));

        version.focusOn(point);
        versions.save(version);

        audit.record(new AuditEntry(actor, "MEDIA_FOCAL_POINT_CHANGED", MediaWritePolicy.AUDIT_AGGREGATE, assetId,
                null, null, null, null, MediaWritePolicy.metadata("versionId", versionId.toString(),
                        "focalPoint", point == null ? null : point.x() + "," + point.y())));
        return views.details(asset);
    }
}
