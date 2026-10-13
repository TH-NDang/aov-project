package com.wikiaov.media.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.MediaProperties;
import com.wikiaov.media.internal.application.port.ObjectStorage;
import com.wikiaov.media.internal.application.response.MediaVersionResult;
import com.wikiaov.media.internal.domain.image.InvalidMediaException;
import com.wikiaov.media.internal.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.persistence.MediaUploadSessionRepository;
import com.wikiaov.media.internal.persistence.entity.MediaAssetVersion;
import com.wikiaov.media.internal.persistence.entity.MediaUploadSession;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Validates an uploaded object and turns it into a READY version (03 section 32).
 *
 * <p>Safe to retry: completing an upload that already succeeded returns the same version, and a temporary
 * failure (object not uploaded yet, storage outage) leaves the upload open for another attempt.
 */
@Service
public class CompleteMediaUpload {

    private static final Logger log = LoggerFactory.getLogger(CompleteMediaUpload.class);

    private final MediaUploadSessionRepository sessions;
    private final MediaAssetVersionRepository versions;
    private final MediaIngestion ingestion;
    private final ObjectStorage storage;
    private final MediaSupport support;
    private final MediaProperties properties;
    private final CurrentActor currentActor;
    private final AuditLog auditLog;
    private final TransactionTemplate transaction;
    private final Clock clock;

    CompleteMediaUpload(MediaUploadSessionRepository sessions, MediaAssetVersionRepository versions,
            MediaIngestion ingestion, ObjectStorage storage, MediaSupport support, MediaProperties properties,
            CurrentActor currentActor, AuditLog auditLog, TransactionTemplate transaction, Clock clock) {
        this.sessions = sessions;
        this.versions = versions;
        this.ingestion = ingestion;
        this.storage = storage;
        this.support = support;
        this.properties = properties;
        this.currentActor = currentActor;
        this.auditLog = auditLog;
        this.transaction = transaction;
        this.clock = clock;
    }

    @PreAuthorize(MediaSupport.CAN_WRITE_MEDIA)
    public MediaVersionResult execute(UUID uploadId) {
        return perform(uploadId);
    }

    public MediaVersionResult avatar(UUID uploadId) {
        Actor actor = currentActor.require();
        var session = requireSession(uploadId);
        var asset = support.requireAsset(session.getAssetId());
        if (actor.type() != com.wikiaov.access.ActorType.HUMAN
                || asset.getSemanticType() != com.wikiaov.media.MediaSemanticType.USER_AVATAR
                || !session.getCreatedByIssuer().equals(actor.issuer())
                || !session.getCreatedBySubject().equals(actor.subject())) {
            throw new ApiException(com.wikiaov.platform.PlatformErrorCode.FORBIDDEN,
                    "Avatar upload is not owned by this caller.");
        }
        return perform(uploadId);
    }

    private MediaVersionResult perform(UUID uploadId) {
        Actor actor = currentActor.require();
        Claim claim = claim(uploadId);
        if (claim.completedVersionId() != null) {
            return transaction.execute(status -> {
                MediaAssetVersion version = versions.findById(claim.completedVersionId()).orElseThrow();
                return support.result(support.requireAsset(claim.assetId()), version, false);
            });
        }

        MediaIngestion.Outcome outcome;
        try {
            outcome = ingestion.ingest(claim.assetId(), claim.objectKey(), actor, "UPLOAD",
                    (version, duplicate) -> requireSession(uploadId).complete(version.getId(), clock.instant()));
        } catch (InvalidMediaException ex) {
            transaction.executeWithoutResult(status -> {
                requireSession(uploadId).reject(ex.reason().name(), clock.instant());
                auditLog.record(new AuditEntry(actor, "MEDIA_UPLOAD_REJECTED", MediaSupport.AUDIT_AGGREGATE,
                        claim.assetId(), null, null, null, null,
                        MediaSupport.metadata("uploadId", uploadId.toString(), "reason", ex.reason().name())));
            });
            throw MediaSupport.invalidMedia(ex);
        } catch (RuntimeException ex) {
            transaction.executeWithoutResult(status -> requireSession(uploadId).reopen());
            throw ex;
        }

        deleteIncomingQuietly(claim.objectKey());
        return support.result(outcome.asset(), outcome.version(), outcome.duplicate());
    }

    /**
     * Moves the session to VALIDATING in its own short transaction, so concurrent completions of the same upload
     * do not both run (the optimistic lock lets only one of them commit).
     */
    private Claim claim(UUID uploadId) {
        Claim claim;
        try {
            claim = transaction.execute(status -> {
                MediaUploadSession session = requireSession(uploadId);
                Instant now = clock.instant();
                switch (session.getState()) {
                    case READY -> {
                        return new Claim(session.getAssetId(), session.getObjectKey(), session.getVersionId(), null);
                    }
                    case REJECTED -> throw new ApiException(MediaErrorCode.MEDIA_UPLOAD_REJECTED,
                            "The uploaded file was rejected; request a new upload.",
                            Map.of("reason", String.valueOf(session.getErrorCode())));
                    case EXPIRED -> throw expired(session.getExpiresAt());
                    default -> {
                        // REQUESTED or VALIDATING: continue below.
                    }
                }
                if (session.isPastDeadline(now)) {
                    session.expire();
                    return new Claim(session.getAssetId(), session.getObjectKey(), null, session.getExpiresAt());
                }
                if (session.isValidationRunning(now, properties.validationTimeout())) {
                    throw inProgress();
                }
                session.startValidation(now);
                return new Claim(session.getAssetId(), session.getObjectKey(), null, null);
            });
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw inProgress();
        }
        if (claim.expiredAt() != null) {
            // Thrown after the commit so the EXPIRED state is saved.
            throw expired(claim.expiredAt());
        }
        return claim;
    }

    private MediaUploadSession requireSession(UUID uploadId) {
        return sessions.findById(uploadId).orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_UPLOAD_NOT_FOUND,
                "Upload " + uploadId + " does not exist."));
    }

    private static ApiException expired(Instant expiresAt) {
        return new ApiException(MediaErrorCode.MEDIA_UPLOAD_EXPIRED, "The upload expired; request a new upload.",
                Map.of("expiresAt", expiresAt.toString()));
    }

    private static ApiException inProgress() {
        return new ApiException(MediaErrorCode.MEDIA_UPLOAD_IN_PROGRESS,
                "Another request is completing this upload; check its status and retry later.");
    }

    /** The bytes now live under assets/; the incoming copy is no longer needed. */
    private void deleteIncomingQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException ex) {
            log.warn("Could not delete incoming object {}: {}", key, ex.getMessage());
        }
    }

    /** Outcome of the claim step: proceed, already completed ({@code completedVersionId}) or just expired. */
    private record Claim(
            UUID assetId,
            String objectKey,
            @Nullable UUID completedVersionId,
            @Nullable Instant expiredAt
    ) {
    }
}
