package com.wikiaov.media.internal.deletion.application;

import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.response.MediaDeletionView;
import com.wikiaov.media.internal.deletion.application.port.CompetitionMediaGuard;
import com.wikiaov.media.internal.deletion.application.port.MediaCachePurge;
import com.wikiaov.media.internal.deletion.domain.MediaDeletionState;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import com.wikiaov.platform.ApiException;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Durable checkpoints keep a failed origin deletion or CDN purge retryable without holding a DB transaction. */
@Service
public class DeleteMediaAsset {
    private final MediaDeletionRecords records;
    private final ObjectStorage storage;
    private final MediaCachePurge cache;
    private final CompetitionMediaGuard competition;
    private final CurrentActor currentActor;

    DeleteMediaAsset(MediaDeletionRecords records, ObjectStorage storage, MediaCachePurge cache,
            CompetitionMediaGuard competition, CurrentActor currentActor) {
        this.records = records;
        this.storage = storage;
        this.cache = cache;
        this.competition = competition;
        this.currentActor = currentActor;
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional(propagation = Propagation.NEVER)
    public MediaDeletionView execute(UUID assetId, long expectedVersion, String reason) {
        var actor = currentActor.require();
        if (records.complete(assetId)) {
            return records.get(assetId);
        }
        cache.requireConfigured();
        competition.requireUnused(assetId);

        var work = records.prepare(assetId, expectedVersion, reason, actor);
        if (work.state() == MediaDeletionState.COMPLETE) {
            return records.get(assetId);
        }
        try {
            competition.retire(assetId);
            if (work.state() != MediaDeletionState.ORIGIN_DELETED) {
                for (String key : work.keys()) {
                    storage.delete(key);
                }
                records.originDeleted(assetId);
            }
            cache.purge(work.urls());
            return records.finish(assetId, actor);
        } catch (RuntimeException exception) {
            String code = exception instanceof ApiException api ? api.getErrorCode().name() : "MEDIA_DELETION_FAILED";
            records.failed(assetId, code);
            throw exception;
        }
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    public MediaDeletionView status(UUID assetId) {
        return records.get(assetId);
    }
}
