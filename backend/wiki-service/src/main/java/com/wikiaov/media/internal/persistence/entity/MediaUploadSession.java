package com.wikiaov.media.internal.persistence.entity;

import com.wikiaov.media.internal.domain.image.ImageFormat;
import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.domain.model.UploadState;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;

/**
 * A direct upload to object storage that the backend has authorized but not yet accepted.
 * A finished upload is not a READY version until the backend has validated the bytes.
 */
@Entity
@Table(name = "media_upload_session", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaUploadSession extends AssignedIdEntity {

    @Id
    private UUID id;

    @Column(name = "asset_id", nullable = false, updatable = false)
    private UUID assetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    private UploadState state;

    @Column(name = "object_key", nullable = false, updatable = false)
    private String objectKey;

    @Column(name = "file_name", length = 255, updatable = false)
    private @Nullable String fileName;

    /** What the client said it would upload; the verified type is stored on the version. */
    @Column(name = "declared_mime_type", nullable = false, length = 64, updatable = false)
    private String declaredMimeType;

    @Column(name = "declared_size_bytes", nullable = false, updatable = false)
    private long declaredSizeBytes;

    /** Completing the upload after this instant is refused. */
    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "validation_started_at")
    private @Nullable Instant validationStartedAt;

    @Column(name = "completed_at")
    private @Nullable Instant completedAt;

    @Column(name = "error_code", length = 64)
    private @Nullable String errorCode;

    @Column(name = "version_id")
    private @Nullable UUID versionId;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by_issuer", nullable = false, updatable = false)
    private String createdByIssuer;

    @Column(name = "created_by_subject", nullable = false, updatable = false)
    private String createdBySubject;

    public static MediaUploadSession request(UUID id, UUID assetId, String objectKey, @Nullable String fileName,
            ImageFormat declaredFormat, long declaredSizeBytes, Instant expiresAt, ActorRef createdBy,
            Instant now) {
        MediaUploadSession session = new MediaUploadSession();
        session.id = id;
        session.assetId = assetId;
        session.state = UploadState.REQUESTED;
        session.objectKey = objectKey;
        session.fileName = fileName;
        session.declaredMimeType = declaredFormat.mimeType();
        session.declaredSizeBytes = declaredSizeBytes;
        session.expiresAt = expiresAt;
        session.createdAt = now;
        session.createdByIssuer = createdBy.issuer();
        session.createdBySubject = createdBy.subject();
        return session;
    }

    /** Still waiting for (or in the middle of) completion. */
    public boolean isOpen() {
        return state == UploadState.REQUESTED || state == UploadState.VALIDATING;
    }

    public boolean isPastDeadline(Instant now) {
        return isOpen() && !now.isBefore(expiresAt);
    }

    /** True while another request is validating this upload; a validation older than {@code timeout} is stale. */
    public boolean isValidationRunning(Instant now, Duration timeout) {
        return state == UploadState.VALIDATING && validationStartedAt != null
                && now.isBefore(validationStartedAt.plus(timeout));
    }

    public void startValidation(Instant now) {
        requireOpen();
        state = UploadState.VALIDATING;
        validationStartedAt = now;
    }

    /** Allows the client to retry after a temporary failure (object not uploaded yet, storage outage). */
    public void reopen() {
        if (state == UploadState.VALIDATING) {
            state = UploadState.REQUESTED;
            validationStartedAt = null;
        }
    }

    public void expire() {
        requireOpen();
        state = UploadState.EXPIRED;
    }

    public void reject(String reason, Instant now) {
        requireOpen();
        state = UploadState.REJECTED;
        errorCode = reason;
        completedAt = now;
    }

    public void complete(UUID createdVersionId, Instant now) {
        requireOpen();
        state = UploadState.READY;
        versionId = createdVersionId;
        completedAt = now;
    }

    private void requireOpen() {
        if (!isOpen()) {
            throw new IllegalStateException("Upload " + id + " is already " + state);
        }
    }
}
