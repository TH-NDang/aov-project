package com.wikiaov.media.internal.contact.persistence.entity;

import com.wikiaov.media.internal.shared.persistence.entity.AssignedIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "media_contact_request", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaContactRequest extends AssignedIdEntity {
    @Id
    private UUID id;
    @Column(name = "asset_id")
    private @Nullable UUID assetId;
    @Column(name = "version_id")
    private @Nullable UUID versionId;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(nullable = false, length = 254)
    private String email;
    @Column(nullable = false, length = 32)
    private String topic;
    @Column(nullable = false, length = 4000)
    private String message;
    @Column(nullable = false, length = 16)
    private String status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "resolved_at")
    private @Nullable Instant resolvedAt;

    public static MediaContactRequest create(@Nullable UUID assetId, @Nullable UUID versionId, String name,
            String email, String topic, String message, Instant now) {
        var entry = new MediaContactRequest();
        entry.id = UUID.randomUUID();
        entry.assetId = assetId;
        entry.versionId = versionId;
        entry.name = name;
        entry.email = email;
        entry.topic = topic;
        entry.message = message;
        entry.status = "OPEN";
        entry.createdAt = now;
        return entry;
    }

    public void resolve(Instant now) {
        if (resolvedAt == null) {
            status = "RESOLVED";
            resolvedAt = now;
        }
    }
}
