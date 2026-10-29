package com.wikiaov.media.internal.upload.persistence.entity;

import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import com.wikiaov.media.internal.domain.model.UploadState;
import com.wikiaov.media.internal.ingestion.domain.image.ImageFormat;
import com.wikiaov.media.internal.shared.persistence.entity.AssignedIdEntity;
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

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 32, updatable = false)
    private @Nullable ProvenanceSourceType sourceType;

    @Column(name = "source_label", length = 200, updatable = false)
    private @Nullable String sourceLabel;

    @Column(name = "source_url", length = 2048, updatable = false)
    private @Nullable String sourceUrl;

    @Column(name = "source_owner_name", length = 200, updatable = false)
    private @Nullable String sourceOwnerName;

    @Column(name = "source_contact_url", length = 2048, updatable = false)
    private @Nullable String sourceContactUrl;

    @Column(name = "source_observed_at", updatable = false)
    private @Nullable Instant sourceObservedAt;

    @Column(name = "source_note", length = 2000, updatable = false)
    private @Nullable String sourceNote;

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

    public void recordSource(ProvenanceSourceType type, String label, @Nullable String url,
            @Nullable String ownerName, @Nullable String contactUrl, @Nullable Instant observedAt,
            @Nullable String note) {
        sourceType = type;
        sourceLabel = label;
        sourceUrl = url;
        sourceOwnerName = ownerName;
        sourceContactUrl = contactUrl;
        sourceObservedAt = observedAt;
        sourceNote = note;
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
