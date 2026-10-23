package com.wikiaov.media.internal.asset.persistence.entity;

import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.shared.persistence.entity.AssignedIdEntity;
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
 * Logical asset, e.g. "portrait artwork X of hero Y" (01 section 12.1). Bytes live in its versions.
 *
 * <p>Business rules (who may do what, conflict codes) are checked by the use cases; the methods here only
 * guard invariants that must never break.
 */
@Entity
@Table(name = "media_asset", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaAsset extends AssignedIdEntity {

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "semantic_type", nullable = false, length = 64, updatable = false)
    private MediaSemanticType semanticType;

    @Enumerated(EnumType.STRING)
    @Column(name = "lifecycle_state", nullable = false, length = 16)
    private MediaAssetState lifecycleState;

    @Column(name = "current_version_id")
    private @Nullable UUID currentVersionId;

    /** Last version number handed out; numbers are never reused. */
    @Column(name = "last_version_no", nullable = false)
    private long lastVersionNo;

    /** Optimistic lock, exposed to clients as {@code version} / {@code expectedVersion}. */
    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by_issuer", nullable = false, updatable = false)
    private String createdByIssuer;

    @Column(name = "created_by_subject", nullable = false, updatable = false)
    private String createdBySubject;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static MediaAsset create(UUID id, MediaSemanticType semanticType, ActorRef createdBy, Instant now) {
        MediaAsset asset = new MediaAsset();
        asset.id = id;
        asset.semanticType = semanticType;
        asset.lifecycleState = MediaAssetState.ACTIVE;
        asset.createdAt = now;
        asset.createdByIssuer = createdBy.issuer();
        asset.createdBySubject = createdBy.subject();
        asset.updatedAt = now;
        return asset;
    }

    public boolean isActive() {
        return lifecycleState == MediaAssetState.ACTIVE;
    }

    public boolean hasCurrentVersion() {
        return currentVersionId != null;
    }

    /** Reserves the next version number. Bumps the optimistic lock, so concurrent uploads cannot share one. */
    public long reserveVersionNo(Instant now) {
        lastVersionNo++;
        updatedAt = now;
        return lastVersionNo;
    }

    /** Makes {@code version} the one that is served. */
    public void activate(MediaAssetVersion version, Instant now) {
        if (!version.getAssetId().equals(id)) {
            throw new IllegalArgumentException("Version " + version.getId() + " belongs to another asset");
        }
        if (!isActive() || !version.isReady()) {
            throw new IllegalStateException("Only a READY version of an ACTIVE asset can be activated");
        }
        version.markActivated(now, currentVersionId);
        currentVersionId = version.getId();
        updatedAt = now;
    }

    /** Keeps the asset for history but stops new bindings. No effect unless the asset is ACTIVE. */
    public void deprecate(Instant now) {
        if (isActive()) {
            lifecycleState = MediaAssetState.DEPRECATED;
            updatedAt = now;
        }
    }
}
