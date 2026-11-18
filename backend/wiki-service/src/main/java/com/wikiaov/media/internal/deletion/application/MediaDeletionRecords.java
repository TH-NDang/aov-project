package com.wikiaov.media.internal.deletion.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaDeletionView;
import com.wikiaov.media.internal.asset.application.MediaAssetAccess;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.deletion.persistence.MediaDeletionRepository;
import com.wikiaov.media.internal.deletion.persistence.entity.MediaDeletion;
import com.wikiaov.media.internal.domain.model.UploadState;
import com.wikiaov.media.internal.query.application.FindMediaUsages;
import com.wikiaov.media.internal.query.application.MediaUrls;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.media.internal.upload.persistence.MediaUploadSessionRepository;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MediaDeletionRecords {
    private final MediaDeletionRepository deletions;
    private final MediaAssetAccess assets;
    private final MediaAssetVersionRepository versions;
    private final MediaUploadSessionRepository uploads;
    private final FindMediaUsages usages;
    private final MediaUrls urls;
    private final AuditLog audit;
    private final Clock clock;

    MediaDeletionRecords(MediaDeletionRepository deletions, MediaAssetAccess assets,
            MediaAssetVersionRepository versions, MediaUploadSessionRepository uploads,
            FindMediaUsages usages, MediaUrls urls, AuditLog audit, Clock clock) {
        this.deletions = deletions;
        this.assets = assets;
        this.versions = versions;
        this.uploads = uploads;
        this.usages = usages;
        this.urls = urls;
        this.audit = audit;
        this.clock = clock;
    }

    public record Work(
            UUID assetId,
            String state,
            List<String> keys,
            List<String> urls
    ) {
    }

    @Transactional(readOnly = true)
    public boolean complete(UUID assetId) {
        return deletions.findById(assetId).map(MediaDeletion::complete).orElse(false);
    }

    @Transactional(readOnly = true)
    public MediaDeletionView get(UUID assetId) {
        return view(require(assetId));
    }

    @Transactional
    public Work prepare(UUID assetId, long expectedVersion, String reason, Actor actor) {
        var asset = assets.requireAsset(assetId);
        var existing = deletions.lock(assetId);
        var now = clock.instant();
        MediaDeletion deletion;
        if (existing.isPresent()) {
            deletion = existing.get();
            if (deletion.complete()) {
                return work(deletion);
            }
            if (deletion.getExpectedVersion() != expectedVersion) {
                throw MediaWritePolicy.versionConflict(asset.getLockVersion());
            }
            if (deletion.getLeaseUntil() != null && deletion.getLeaseUntil().isAfter(now)) {
                throw new ApiException(MediaErrorCode.MEDIA_DELETION_IN_PROGRESS,
                        "Another request is deleting this image. Check its progress before retrying.");
            }
        } else {
            MediaWritePolicy.checkExpectedVersion(asset, expectedVersion);
            var references = usages.collect(assetId);
            if (!references.isEmpty()) {
                throw new ApiException(MediaErrorCode.MEDIA_ASSET_IN_USE,
                        "Current, draft or historical records still reference this image.",
                        Map.of("usages", references.size()));
            }
            var sessions = uploads.findByAssetId(assetId);
            if (sessions.stream().anyMatch(session -> session.getState() == UploadState.VALIDATING
                    || session.getState() == UploadState.REQUESTED && !session.isPastDeadline(now))) {
                throw new ApiException(MediaErrorCode.MEDIA_UPLOAD_IN_PROGRESS,
                        "Wait for outstanding uploads to complete or expire before deleting this image.");
            }

            var storedVersions = versions.findByAssetIdOrderByVersionNoDesc(assetId);
            var keys = new ArrayList<String>();
            storedVersions.forEach(version -> keys.add(version.getObjectKey()));
            sessions.forEach(session -> keys.add(session.getObjectKey()));
            deletion = MediaDeletion.create(assetId, expectedVersion, keys.stream().distinct().toList(),
                    storedVersions.stream().map(urls::publicUrl).toList(), now);
            asset.blockForDeletion(now);
            assets.flush(asset);
            audit.record(new AuditEntry(actor, "MEDIA_DELETION_REQUESTED", MediaWritePolicy.AUDIT_AGGREGATE,
                    assetId, null, expectedVersion, asset.getLockVersion(), reason,
                    Map.of("objects", keys.size())));
        }

        deletion.claim(now.plus(Duration.ofMinutes(10)));
        deletions.saveAndFlush(deletion);
        return work(deletion);
    }

    @Transactional
    public void originDeleted(UUID assetId) {
        var deletion = lock(assetId);
        if (!deletion.complete()) {
            deletion.originDeleted();
        }
    }

    @Transactional
    public MediaDeletionView finish(UUID assetId, Actor actor) {
        var asset = assets.requireAsset(assetId);
        var deletion = lock(assetId);
        if (!deletion.complete()) {
            var now = clock.instant();
            asset.markDeleted(now);
            deletion.finish(now);
            audit.record(new AuditEntry(actor, "MEDIA_DELETION_COMPLETED", MediaWritePolicy.AUDIT_AGGREGATE,
                    assetId, null, null, null, null, Map.of("objects", deletion.getObjectKeys().size())));
        }
        return view(deletion);
    }

    @Transactional
    public void failed(UUID assetId, String code) {
        var deletion = lock(assetId);
        if (!deletion.complete()) {
            deletion.failed(code);
        }
    }

    private MediaDeletion require(UUID assetId) {
        return deletions.findById(assetId).orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_DELETION_NOT_FOUND,
                "No deletion was requested for this image."));
    }

    private MediaDeletion lock(UUID assetId) {
        return deletions.lock(assetId).orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_DELETION_NOT_FOUND,
                "No deletion was requested for this image."));
    }

    private static Work work(MediaDeletion deletion) {
        return new Work(deletion.getAssetId(), deletion.getState(), List.copyOf(deletion.getObjectKeys()),
                List.copyOf(deletion.getPublicUrls()));
    }

    private static MediaDeletionView view(MediaDeletion deletion) {
        return new MediaDeletionView(deletion.getAssetId(), deletion.getState(), deletion.getExpectedVersion(),
                deletion.getObjectKeys().size(),
                deletion.getPublicUrls().size(), deletion.getLastError(), deletion.getRequestedAt(),
                deletion.getCompletedAt());
    }
}
