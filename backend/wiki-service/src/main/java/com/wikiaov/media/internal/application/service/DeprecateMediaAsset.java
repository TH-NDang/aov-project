package com.wikiaov.media.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.persistence.entity.MediaAsset;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Retires an asset without deleting it (03 section 36). Refused while a current revision still shows it;
 * drafts and historical revisions keep working, but the asset can no longer be bound.
 */
@Service
public class DeprecateMediaAsset {

    private final FindMediaUsages usages;
    private final MediaSupport support;
    private final CurrentActor currentActor;
    private final AuditLog auditLog;
    private final Clock clock;

    DeprecateMediaAsset(FindMediaUsages usages, MediaSupport support, CurrentActor currentActor, AuditLog auditLog,
            Clock clock) {
        this.usages = usages;
        this.support = support;
        this.currentActor = currentActor;
        this.auditLog = auditLog;
        this.clock = clock;
    }

    @PreAuthorize(MediaSupport.CAN_WRITE_MEDIA)
    @Transactional
    public MediaAssetDetails execute(UUID assetId, long expectedVersion, @Nullable String reason) {
        Actor actor = currentActor.require();
        MediaAsset asset = support.requireAsset(assetId);
        MediaSupport.checkExpectedVersion(asset, expectedVersion);
        if (!asset.isActive()) {
            return support.details(asset);
        }
        long currentUsages = usages.collect(assetId).stream()
                .filter(usage -> usage.scope() == MediaUsageScope.CURRENT)
                .count();
        if (currentUsages > 0) {
            throw new ApiException(MediaErrorCode.MEDIA_ASSET_IN_USE,
                    "The asset is shown by " + currentUsages + " current revision(s).",
                    Map.of("currentUsages", currentUsages));
        }

        asset.deprecate(clock.instant());
        MediaAsset saved = support.flush(asset);
        auditLog.record(new AuditEntry(actor, "MEDIA_ASSET_DEPRECATED", MediaSupport.AUDIT_AGGREGATE, assetId, null,
                expectedVersion, saved.getLockVersion(), reason, Map.of()));
        return support.details(saved);
    }
}
