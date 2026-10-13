package com.wikiaov.media.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.MediaProperties;
import com.wikiaov.media.internal.application.port.ObjectStorage;
import com.wikiaov.media.internal.application.port.StoredObject;
import com.wikiaov.media.internal.domain.image.ImageInspection;
import com.wikiaov.media.internal.domain.image.ImageInspector;
import com.wikiaov.media.internal.domain.image.ImageLimits;
import com.wikiaov.media.internal.domain.image.InvalidMediaException;
import com.wikiaov.media.internal.domain.image.InvalidMediaReason;
import com.wikiaov.media.internal.domain.model.MediaObjectKeys;
import com.wikiaov.media.internal.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.persistence.entity.MediaAssetVersion;
import com.wikiaov.platform.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Turns an object in the bucket into a READY version (03 section 32, steps 1-7).
 *
 * <p>Object storage calls run outside any database transaction (01 section 19.2). The flow is:
 * stat, inspect the bytes, look for the same bytes on the asset, copy to the immutable {@code assets/} key,
 * then one short transaction that numbers, stores (and, for the first version, activates) the version.
 */
@Component
class MediaIngestion {

    /** Version keys never change content, so browsers and CDNs may cache them for a year. */
    static final String IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
    private static final int MAX_ATTEMPTS = 3;
    private static final Logger log = LoggerFactory.getLogger(MediaIngestion.class);

    private final ObjectStorage storage;
    private final MediaAssetVersionRepository versions;
    private final MediaSupport support;
    private final AuditLog auditLog;
    private final TransactionTemplate transaction;
    private final ImageLimits limits;
    private final Clock clock;

    MediaIngestion(ObjectStorage storage, MediaAssetVersionRepository versions, MediaSupport support,
            AuditLog auditLog, TransactionTemplate transaction, MediaProperties properties, Clock clock) {
        this.storage = storage;
        this.versions = versions;
        this.support = support;
        this.auditLog = auditLog;
        this.transaction = transaction;
        this.limits = properties.imageLimits();
        this.clock = clock;
    }

    /** Work that must commit together with the version, e.g. closing the upload session. */
    @FunctionalInterface
    interface InSameTransaction {

        void run(MediaAssetVersion version, boolean duplicate);
    }

    record Outcome(
            MediaAsset asset,
            MediaAssetVersion version,
            boolean duplicate
    ) {
    }

    /**
     * @param origin recorded in the audit trail, e.g. {@code UPLOAD} or {@code IMPORT}
     * @throws InvalidMediaException if the bytes break the media policy
     * @throws ApiException          {@code MEDIA_OBJECT_NOT_FOUND}, {@code STORAGE_UNAVAILABLE},
     *                               {@code MEDIA_ASSET_NOT_FOUND}, {@code MEDIA_ASSET_NOT_ACTIVE}
     */
    Outcome ingest(UUID assetId, String sourceKey, Actor actor, String origin, InSameTransaction inSameTransaction) {
        StoredObject object = storage.stat(sourceKey)
                .orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_OBJECT_NOT_FOUND,
                        "No object has been stored for this upload yet."));
        if (object.sizeBytes() > limits.maxBytes()) {
            throw new InvalidMediaException(InvalidMediaReason.TOO_LARGE,
                    "The file must be at most " + limits.maxBytes() + " bytes.");
        }
        ImageInspection image = inspect(sourceKey);

        Optional<Outcome> existing = transaction.execute(status -> findDuplicate(assetId, image, inSameTransaction));
        if (existing.isPresent()) {
            return existing.get();
        }

        UUID versionId = UUID.randomUUID();
        String targetKey = MediaObjectKeys.asset(assetId, versionId, image.format());
        storage.copy(sourceKey, targetKey, image.format().mimeType(), IMMUTABLE_CACHE_CONTROL);
        try {
            return store(assetId, versionId, targetKey, image, actor, origin, inSameTransaction);
        } catch (DataIntegrityViolationException ex) {
            // A concurrent request stored the same bytes first: return its version.
            deleteQuietly(targetKey);
            return transaction.execute(status -> findDuplicate(assetId, image, inSameTransaction))
                    .orElseThrow(() -> ex);
        } catch (RuntimeException ex) {
            deleteQuietly(targetKey);
            throw ex;
        }
    }

    private ImageInspection inspect(String key) {
        try (InputStream content = storage.open(key)) {
            return ImageInspector.inspect(content, limits);
        } catch (IOException ex) {
            throw new ApiException(MediaErrorCode.STORAGE_UNAVAILABLE, "Object storage is temporarily unavailable.",
                    ex);
        }
    }

    private Optional<Outcome> findDuplicate(UUID assetId, ImageInspection image, InSameTransaction inSameTransaction) {
        MediaAsset asset = support.requireActiveAsset(assetId);
        return versions.findByAssetIdAndSha256(assetId, image.sha256()).map(version -> {
            inSameTransaction.run(version, true);
            return new Outcome(asset, version, true);
        });
    }

    /** Retries when a concurrent upload to the same asset took the version number first. */
    private Outcome store(UUID assetId, UUID versionId, String targetKey, ImageInspection image, Actor actor,
            String origin, InSameTransaction inSameTransaction) {
        for (int attempt = 1;; attempt++) {
            try {
                return transaction.execute(status -> {
                    MediaAsset asset = support.requireActiveAsset(assetId);
                    Instant now = clock.instant();
                    long versionNo = asset.reserveVersionNo(now);
                    MediaAssetVersion version = versions.save(MediaAssetVersion.ready(versionId, assetId, versionNo,
                            MediaObjectKeys.STORAGE_ALIAS, targetKey, image, MediaSupport.ref(actor), now));
                    auditLog.record(new AuditEntry(actor, "MEDIA_VERSION_CREATED", MediaSupport.AUDIT_AGGREGATE,
                            assetId, null, null, null, null, MediaSupport.metadata("versionId", versionId.toString(),
                                    "versionNo", versionNo, "sha256", image.sha256(), "mimeType",
                                    image.format().mimeType(), "origin", origin)));
                    // The first version is shown right away; later ones wait for an explicit activation.
                    if (!asset.hasCurrentVersion()) {
                        asset.activate(version, now);
                        auditLog.record(new AuditEntry(actor, "MEDIA_VERSION_ACTIVATED",
                                MediaSupport.AUDIT_AGGREGATE, assetId, null, null, null, null,
                                MediaSupport.metadata("versionId", versionId.toString(), "automatic", true)));
                    }
                    inSameTransaction.run(version, false);
                    return new Outcome(asset, version, false);
                });
            } catch (ObjectOptimisticLockingFailureException ex) {
                if (attempt >= MAX_ATTEMPTS) {
                    throw MediaSupport.versionConflict(null);
                }
            }
        }
    }

    private void deleteQuietly(String key) {
        try {
            storage.delete(key);
        } catch (RuntimeException ex) {
            log.warn("Could not delete unused object {}: {}", key, ex.getMessage());
        }
    }
}
