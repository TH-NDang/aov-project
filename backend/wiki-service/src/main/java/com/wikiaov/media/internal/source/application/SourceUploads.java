package com.wikiaov.media.internal.source.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.MediaProperties;
import com.wikiaov.media.internal.domain.model.MediaObjectKeys;
import com.wikiaov.media.internal.domain.model.UploadState;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.media.internal.source.domain.SourceContentTypes;
import com.wikiaov.media.internal.source.domain.SourceDigest;
import com.wikiaov.media.internal.source.domain.SourceRejection;
import com.wikiaov.media.internal.source.persistence.SourceFileRepository;
import com.wikiaov.media.internal.source.persistence.SourceObjectRepository;
import com.wikiaov.media.internal.source.persistence.SourceUploadSessionRepository;
import com.wikiaov.media.internal.source.persistence.entity.SourceFile;
import com.wikiaov.media.internal.source.persistence.entity.SourceObject;
import com.wikiaov.media.internal.source.persistence.entity.SourceUploadSession;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import com.wikiaov.media.internal.storage.application.port.PresignedRequest;
import com.wikiaov.media.internal.storage.application.port.StoredObject;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import com.wikiaov.platform.PlatformErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Uploads of private source files (03, ADR-030 section 5). Bytes go straight to storage with a presigned PUT; complete
 * reads them once to check the declared SHA-256, size and type, then copies them to {@code sources/<sha256>}.
 *
 * <p>No transaction is held while storage is called. Placing a file locks the row of its bytes, which serializes it
 * with purging orphaned bytes: a file is never placed on bytes that are being deleted.
 */
@Service
public class SourceUploads {

    /** Content-addressed bytes never change, so a browser may keep them as long as it likes. */
    static final String PRIVATE_IMMUTABLE = "private, max-age=31536000, immutable";
    private static final String UPLOAD_AGGREGATE = "SOURCE_UPLOAD";
    private static final Logger log = LoggerFactory.getLogger(SourceUploads.class);

    private final SourceCollections collections;
    private final SourceFileRepository files;
    private final SourceObjectRepository objects;
    private final SourceUploadSessionRepository sessions;
    private final ObjectStorage storage;
    private final MediaProperties media;
    private final SourceProperties properties;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final TransactionTemplate transaction;
    private final Clock clock;

    SourceUploads(SourceCollections collections, SourceFileRepository files, SourceObjectRepository objects,
            SourceUploadSessionRepository sessions, ObjectStorage storage, MediaProperties media,
            SourceProperties properties, CurrentActor actors, AuditLog audit, TransactionTemplate transaction,
            Clock clock) {
        this.collections = collections;
        this.files = files;
        this.objects = objects;
        this.sessions = sessions;
        this.storage = storage;
        this.media = media;
        this.properties = properties;
        this.actors = actors;
        this.audit = audit;
        this.transaction = transaction;
        this.clock = clock;
    }

    /** What the caller wants to replace; both values come from the file it showed to the user. */
    public record Replace(
            UUID fileId,
            long expectedVersion
    ) {
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    public SourceFileViews.UploadResult request(UUID collectionId, SourceCommands.UploadCommand command) {
        @Nullable
        String rawPath = command.path();
        @Nullable
        String rawSha256 = command.sha256();
        long sizeBytes = command.sizeBytes();
        @Nullable
        String rawContentType = command.contentType();
        @Nullable
        Replace replace = command.replace() == null
                ? null
                : new Replace(command.replace().fileId(), command.replace().expectedVersion());
        Actor actor = actors.require();
        String path = SourceErrors.requirePath(rawPath, "path");
        String sha256 = SourceErrors.requireSha256(rawSha256, "sha256");
        String contentType = contentType(rawContentType);
        requireSize(sizeBytes);

        UUID uploadId = UUID.randomUUID();
        SourceFileViews.File stored = transaction.execute(status -> {
            collections.require(collectionId);
            Optional<SourceFile> existing = files.findByCollectionIdAndPath(collectionId, path);
            if (existing.isPresent() && existing.get().getSha256().equals(sha256)) {
                return SourceFiles.view(existing.get(),
                        objects.findById(sha256).orElseThrow(SourceUploads::missingObject));
            }
            checkReplace(existing, replace);

            Optional<SourceObject> object = objects.lockById(sha256);
            if (object.isPresent()) {
                if (!object.get().isReady()) {
                    throw SourceErrors.objectBusy();
                }
                return SourceFiles.view(place(existing, collectionId, path, sha256, actor), object.get());
            }

            Instant now = clock.instant();
            sessions.save(SourceUploadSession.request(uploadId, collectionId, path,
                    replace == null ? null : replace.fileId(), replace == null ? null : replace.expectedVersion(),
                    sha256, sizeBytes, contentType, MediaObjectKeys.incoming(uploadId),
                    now.plus(media.completionWindow()), MediaWritePolicy.ref(actor), now));
            return null;
        });
        if (stored != null) {
            return new SourceFileViews.UploadResult(SourceFileViews.UploadStatus.STORED, stored, null);
        }

        PresignedRequest put = storage.presignPut(MediaObjectKeys.incoming(uploadId), contentType,
                media.uploadUrlValidity());
        return new SourceFileViews.UploadResult(SourceFileViews.UploadStatus.UPLOAD_REQUIRED, null,
                new SourceFileViews.Ticket(uploadId, put.method(), put.url().toString(), put.headers(),
                        put.expiresAt()));
    }

    private static String contentType(@Nullable String rawContentType) {
        return SourceContentTypes.normalize(rawContentType)
                .orElseThrow(() -> new ApiException(MediaErrorCode.SOURCE_FILE_TYPE_NOT_ALLOWED,
                        "Only images, JSON, CSV, Markdown, plain text and ZIP files can be stored.",
                        Map.of("contentType", String.valueOf(rawContentType))));
    }

    private void requireSize(long sizeBytes) {
        long maxBytes = properties.maxUploadSize().toBytes();
        if (sizeBytes < 0) {
            throw new ApiException(PlatformErrorCode.INVALID_REQUEST, "The size cannot be negative.",
                    List.of(new ApiFieldError("sizeBytes", "MIN", "must be at least 0")));
        }
        if (sizeBytes > maxBytes) {
            throw new ApiException(MediaErrorCode.SOURCE_FILE_TOO_LARGE, "The file is larger than allowed.",
                    Map.of("maxBytes", maxBytes));
        }
    }

    @Transactional(readOnly = true)
    public SourceFileViews.Upload status(UUID uploadId) {
        SourceUploadSession session = sessions.findById(uploadId)
                .orElseThrow(() -> SourceErrors.uploadNotFound(uploadId));
        UploadState state = session.isPastDeadline(clock.instant()) ? UploadState.EXPIRED : session.getState();
        return new SourceFileViews.Upload(session.getId(), session.getCollectionId(), session.getPath(), state,
                session.getErrorCode(), session.getExpiresAt(), session.getFileId());
    }

    /** Safe to retry: completing an upload that already succeeded returns the same file. */
    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    public SourceFileViews.Completed complete(UUID uploadId) {
        Actor actor = actors.require();
        Claim claim = claim(uploadId);
        if (claim.completedFileId() != null) {
            return transaction.execute(status -> {
                SourceFile file = files.findById(claim.completedFileId())
                        .orElseThrow(() -> SourceErrors.fileNotFound(claim.completedFileId()));
                return new SourceFileViews.Completed(
                        SourceFiles.view(file,
                                objects.findById(file.getSha256()).orElseThrow(SourceUploads::missingObject)));
            });
        }

        SourceFileViews.File file;
        try {
            verify(claim);
            file = placeVerified(claim, actor);
        } catch (Rejection rejection) {
            reject(claim, rejection.reason, actor);
            throw SourceErrors.uploadRejected(rejection.reason.name());
        } catch (RuntimeException ex) {
            reopen(uploadId);
            throw ex;
        }

        deleteIncomingQuietly(claim.objectKey());
        return new SourceFileViews.Completed(file);
    }

    private void checkReplace(Optional<SourceFile> existing, @Nullable Replace replace) {
        if (existing.isEmpty()) {
            if (replace != null) {
                throw SourceErrors.fileVersionConflict(null);
            }
            return;
        }

        SourceFile file = existing.get();
        if (replace == null) {
            throw SourceErrors.pathTaken(file.getId(), file.getSha256(), file.getLockVersion());
        }
        if (!replace.fileId().equals(file.getId()) || replace.expectedVersion() != file.getLockVersion()) {
            throw SourceErrors.fileVersionConflict(file.getLockVersion());
        }
    }

    /** Runs in the caller's transaction, which holds the lock on the row of the bytes. */
    private SourceFile place(Optional<SourceFile> existing, UUID collectionId, String path, String sha256,
            Actor actor) {
        Instant now = clock.instant();
        if (existing.isPresent()) {
            SourceFile file = existing.get();
            String previous = file.getSha256();
            file.pointTo(sha256, now);
            SourceFile saved = saveOrConflict(file);
            audit.record(new AuditEntry(actor, "SOURCE_FILE_REPLACED", SourceFiles.AUDIT_AGGREGATE, saved.getId(),
                    null, saved.getLockVersion() - 1, saved.getLockVersion(), null, MediaWritePolicy.metadata(
                            "collectionId", collectionId.toString(), "path", path, "previousSha256", previous,
                            "sha256", sha256)));
            return saved;
        }

        SourceFile saved;
        try {
            saved = files.saveAndFlush(SourceFile.place(UUID.randomUUID(), collectionId, path, sha256,
                    MediaWritePolicy.ref(actor), now));
        } catch (DataIntegrityViolationException ex) {
            SourceFile winner = files.findByCollectionIdAndPath(collectionId, path).orElseThrow(() -> ex);
            throw SourceErrors.pathTaken(winner.getId(), winner.getSha256(), winner.getLockVersion());
        }
        audit.record(new AuditEntry(actor, "SOURCE_FILE_ADDED", SourceFiles.AUDIT_AGGREGATE, saved.getId(), null,
                null, saved.getLockVersion(), null, MediaWritePolicy.metadata("collectionId", collectionId.toString(),
                        "path", path, "sha256", sha256)));
        return saved;
    }

    private SourceFile saveOrConflict(SourceFile file) {
        try {
            return files.saveAndFlush(file);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw SourceErrors.fileVersionConflict(null);
        }
    }

    /** Moves the upload to VALIDATING in its own transaction, so two completions of one upload never both run. */
    private Claim claim(UUID uploadId) {
        Claim claim;
        try {
            claim = transaction.execute(status -> {
                SourceUploadSession session = sessions.findById(uploadId)
                        .orElseThrow(() -> SourceErrors.uploadNotFound(uploadId));
                Instant now = clock.instant();
                switch (session.getState()) {
                    case READY -> {
                        return Claim.completed(session);
                    }
                    case REJECTED -> throw SourceErrors.uploadRejected(String.valueOf(session.getErrorCode()));
                    case EXPIRED -> throw SourceErrors.uploadExpired(session.getExpiresAt());
                    default -> {
                        // REQUESTED or VALIDATING: continue below.
                    }
                }

                if (session.isPastDeadline(now)) {
                    session.expire();
                    return Claim.expired(session);
                }
                if (session.isValidationRunning(now, media.validationTimeout())) {
                    throw SourceErrors.uploadInProgress();
                }

                session.startValidation(now);
                return Claim.open(session);
            });
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw SourceErrors.uploadInProgress();
        }
        Objects.requireNonNull(claim, "claim");
        if (claim.expiredAt() != null) {
            // Thrown after the commit, so the EXPIRED state is saved.
            throw SourceErrors.uploadExpired(claim.expiredAt());
        }

        return claim;
    }

    /** Reads the uploaded bytes once; storage is reached without a transaction. */
    private void verify(Claim claim) {
        Optional<StoredObject> stat = storage.stat(claim.objectKey());
        if (stat.isEmpty()) {
            throw SourceErrors.notUploaded();
        }
        if (stat.get().sizeBytes() != claim.sizeBytes()) {
            throw new Rejection(SourceRejection.SIZE_MISMATCH);
        }

        SourceDigest digest;
        try (InputStream content = storage.open(claim.objectKey())) {
            digest = SourceDigest.read(content);
        } catch (ApiException ex) {
            throw ex.getErrorCode() == MediaErrorCode.MEDIA_OBJECT_NOT_FOUND ? SourceErrors.notUploaded() : ex;
        } catch (IOException ex) {
            throw new ApiException(MediaErrorCode.STORAGE_UNAVAILABLE, "Reading the uploaded file failed.", ex);
        }

        if (digest.sizeBytes() != claim.sizeBytes()) {
            throw new Rejection(SourceRejection.SIZE_MISMATCH);
        }
        if (!digest.sha256().equals(claim.sha256())) {
            throw new Rejection(SourceRejection.SHA256_MISMATCH);
        }
        if (!SourceContentTypes.matchesSignature(claim.contentType(), digest.head())) {
            throw new Rejection(SourceRejection.TYPE_MISMATCH);
        }
    }

    private SourceFileViews.File placeVerified(Claim claim, Actor actor) {
        SourceFileViews.File placed = transaction.execute(status -> objects.lockById(claim.sha256())
                .map(object -> finish(claim, object, actor))
                .orElse(null));
        if (placed != null) {
            return placed;
        }

        storage.copy(claim.objectKey(), MediaObjectKeys.source(claim.sha256()),
                SourceContentTypes.storedHeader(claim.contentType()), PRIVATE_IMMUTABLE);
        return transaction.execute(status -> {
            objects.insertIfAbsent(claim.sha256(), MediaObjectKeys.source(claim.sha256()),
                    MediaObjectKeys.STORAGE_ALIAS, claim.sizeBytes(), claim.contentType(), claim.path(),
                    clock.instant(), actor.issuer(), actor.subject());
            return finish(claim, objects.lockById(claim.sha256()).orElseThrow(SourceUploads::missingObject), actor);
        });
    }

    /** Places the verified bytes at the path of the upload; runs with the row of the bytes locked. */
    private SourceFileViews.File finish(Claim claim, SourceObject object, Actor actor) {
        if (!object.isReady()) {
            throw SourceErrors.objectBusy();
        }
        SourceUploadSession session = sessions.findById(claim.uploadId())
                .orElseThrow(() -> SourceErrors.uploadNotFound(claim.uploadId()));

        Optional<SourceFile> existing = files.findByCollectionIdAndPath(claim.collectionId(), claim.path());
        SourceFile file;
        if (existing.isPresent() && existing.get().getSha256().equals(claim.sha256())) {
            file = existing.get();
        } else {
            Replace replace = session.getReplaceFileId() == null
                    ? null
                    : new Replace(session.getReplaceFileId(),
                            Objects.requireNonNull(session.getReplaceExpectedVersion()));
            checkReplace(existing, replace);
            file = place(existing, claim.collectionId(), claim.path(), claim.sha256(), actor);
        }

        session.complete(file.getId(), clock.instant());
        sessions.save(session);
        return SourceFiles.view(file, object);
    }

    private void reject(Claim claim, SourceRejection reason, Actor actor) {
        transaction.executeWithoutResult(status -> sessions.findById(claim.uploadId()).ifPresent(session -> {
            session.reject(reason.name(), clock.instant());
            sessions.save(session);
            audit.record(new AuditEntry(actor, "SOURCE_UPLOAD_REJECTED", UPLOAD_AGGREGATE, claim.uploadId(), null,
                    null, null, null, MediaWritePolicy.metadata("collectionId", claim.collectionId().toString(),
                            "path", claim.path(), "reason", reason.name())));
        }));
        deleteIncomingQuietly(claim.objectKey());
    }

    private void reopen(UUID uploadId) {
        transaction.executeWithoutResult(status -> sessions.findById(uploadId).ifPresent(session -> {
            session.reopen();
            sessions.save(session);
        }));
    }

    /** The bytes now live under sources/, or were refused; the incoming copy is no longer needed. */
    private void deleteIncomingQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException ex) {
            log.warn("Could not delete incoming source object {}: {}", key, ex.getMessage());
        }
    }

    /** Every stored source file and finished upload names a stored object; a missing one is a broken invariant. */
    private static IllegalStateException missingObject() {
        return new IllegalStateException("A source file names an object that does not exist.");
    }

    /** Bytes that do not match the declaration; the upload is refused for good. */
    private static final class Rejection extends RuntimeException {

        private final SourceRejection reason;

        Rejection(SourceRejection reason) {
            super(reason.name(), null, false, false);
            this.reason = reason;
        }
    }

    private record Claim(
            UUID uploadId,
            UUID collectionId,
            String path,
            String sha256,
            long sizeBytes,
            String contentType,
            String objectKey,
            @Nullable UUID completedFileId,
            @Nullable Instant expiredAt
    ) {

        static Claim open(SourceUploadSession session) {
            return new Claim(session.getId(), session.getCollectionId(), session.getPath(), session.getDeclaredSha256(),
                    session.getDeclaredSizeBytes(), session.getContentType(), session.getObjectKey(), null, null);
        }

        static Claim completed(SourceUploadSession session) {
            return new Claim(session.getId(), session.getCollectionId(), session.getPath(), session.getDeclaredSha256(),
                    session.getDeclaredSizeBytes(), session.getContentType(), session.getObjectKey(),
                    session.getFileId(), null);
        }

        static Claim expired(SourceUploadSession session) {
            return new Claim(session.getId(), session.getCollectionId(), session.getPath(), session.getDeclaredSha256(),
                    session.getDeclaredSizeBytes(), session.getContentType(), session.getObjectKey(), null,
                    session.getExpiresAt());
        }
    }
}
