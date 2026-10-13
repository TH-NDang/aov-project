package com.wikiaov.media.internal.persistence.entity;

import com.wikiaov.media.internal.domain.image.ImageInspection;
import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.domain.model.MediaVersionState;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;

/**
 * One validated byte version of an asset (01 section 12.2). Its object key is immutable: the bytes under it are
 * never overwritten, so its public URL can be cached forever.
 */
@Entity
@Table(name = "media_asset_version", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaAssetVersion extends AssignedIdEntity {

    @Id
    private UUID id;

    @Column(name = "asset_id", nullable = false, updatable = false)
    private UUID assetId;

    @Column(name = "version_no", nullable = false, updatable = false)
    private long versionNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    private MediaVersionState state;

    @Column(name = "storage_alias", nullable = false, length = 64, updatable = false)
    private String storageAlias;

    @Column(name = "object_key", nullable = false, updatable = false)
    private String objectKey;

    @Column(name = "object_version", updatable = false)
    private @Nullable String objectVersion;

    @Column(name = "sha256", nullable = false, length = 64, updatable = false)
    private String sha256;

    @Column(name = "mime_type", nullable = false, length = 64, updatable = false)
    private String mimeType;

    @Column(name = "width", nullable = false, updatable = false)
    private int width;

    @Column(name = "height", nullable = false, updatable = false)
    private int height;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "activated_at")
    private @Nullable Instant activatedAt;

    /** Version that was current when this one was last activated. */
    @Column(name = "supersedes_version_id")
    private @Nullable UUID supersedesVersionId;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by_issuer", nullable = false, updatable = false)
    private String createdByIssuer;

    @Column(name = "created_by_subject", nullable = false, updatable = false)
    private String createdBySubject;

    public static MediaAssetVersion ready(UUID id, UUID assetId, long versionNo, String storageAlias,
            String objectKey, ImageInspection image, ActorRef createdBy, Instant now) {
        MediaAssetVersion version = new MediaAssetVersion();
        version.id = id;
        version.assetId = assetId;
        version.versionNo = versionNo;
        version.state = MediaVersionState.READY;
        version.storageAlias = storageAlias;
        version.objectKey = objectKey;
        version.sha256 = image.sha256();
        version.mimeType = image.format().mimeType();
        version.width = image.width();
        version.height = image.height();
        version.sizeBytes = image.sizeBytes();
        version.createdAt = now;
        version.createdByIssuer = createdBy.issuer();
        version.createdBySubject = createdBy.subject();
        return version;
    }

    public boolean isReady() {
        return state == MediaVersionState.READY;
    }

    /** Called by {@link MediaAsset#activate}, which checks the invariants. */
    void markActivated(Instant now, @Nullable UUID previousVersionId) {
        activatedAt = now;
        supersedesVersionId = previousVersionId;
    }
}
