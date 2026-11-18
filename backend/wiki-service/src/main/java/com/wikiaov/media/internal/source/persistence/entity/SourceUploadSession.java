package com.wikiaov.media.internal.source.persistence.entity;

import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.domain.model.UploadState;
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
 * A direct upload of a source file that the backend has authorized but not accepted yet. It has the same life cycle
 * as a media upload (02 section 17): only a validated complete turns the bytes into a file of the collection.
 */
@Entity
@Table(name = "source_upload_session", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SourceUploadSession extends AssignedIdEntity {

    @Id
    private UUID id;

    @Column(name = "collection_id", nullable = false, updatable = false)
    private UUID collectionId;

    @Column(name = "path", nullable = false, updatable = false)
    private String path;

    @Column(name = "replace_file_id", updatable = false)
    private @Nullable UUID replaceFileId;

    @Column(name = "replace_expected_version", updatable = false)
    private @Nullable Long replaceExpectedVersion;

    @Column(name = "declared_sha256", nullable = false, length = 64, updatable = false)
    private String declaredSha256;

    @Column(name = "declared_size_bytes", nullable = false, updatable = false)
    private long declaredSizeBytes;

    @Column(name = "content_type", nullable = false, length = 64, updatable = false)
    private String contentType;

    @Column(name = "object_key", nullable = false, updatable = false)
    private String objectKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    private UploadState state;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "validation_started_at")
    private @Nullable Instant validationStartedAt;

    @Column(name = "completed_at")
    private @Nullable Instant completedAt;

    @Column(name = "error_code", length = 64)
    private @Nullable String errorCode;

    @Column(name = "file_id")
    private @Nullable UUID fileId;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by_issuer", nullable = false, updatable = false)
    private String createdByIssuer;

    @Column(name = "created_by_subject", nullable = false, updatable = false)
    private String createdBySubject;

    public static SourceUploadSession request(UUID id, UUID collectionId, String path, @Nullable UUID replaceFileId,
            @Nullable Long replaceExpectedVersion, String declaredSha256, long declaredSizeBytes, String contentType,
            String objectKey, Instant expiresAt, ActorRef createdBy, Instant now) {
        SourceUploadSession session = new SourceUploadSession();
        session.id = id;
        session.collectionId = collectionId;
        session.path = path;
        session.replaceFileId = replaceFileId;
        session.replaceExpectedVersion = replaceExpectedVersion;
        session.declaredSha256 = declaredSha256;
        session.declaredSizeBytes = declaredSizeBytes;
        session.contentType = contentType;
        session.objectKey = objectKey;
        session.state = UploadState.REQUESTED;
        session.expiresAt = expiresAt;
        session.createdAt = now;
        session.createdByIssuer = createdBy.issuer();
        session.createdBySubject = createdBy.subject();

        return session;
    }

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

    /** Lets the client retry after a temporary failure: object not uploaded yet, storage outage, bytes being purged. */
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

    public void complete(UUID createdFileId, Instant now) {
        requireOpen();
        state = UploadState.READY;
        fileId = createdFileId;
        completedAt = now;
    }

    private void requireOpen() {
        if (!isOpen()) {
            throw new IllegalStateException("Source upload " + id + " is already " + state);
        }
    }
}
