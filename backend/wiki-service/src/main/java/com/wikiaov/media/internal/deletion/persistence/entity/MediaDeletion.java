package com.wikiaov.media.internal.deletion.persistence.entity;

import com.wikiaov.media.internal.shared.persistence.entity.AssignedIdEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "media_deletion", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaDeletion extends AssignedIdEntity {
    @Id
    private UUID assetId;
    private long expectedVersion;
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> objectKeys;
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> publicUrls;
    private String state;
    private @Nullable String lastError;
    private @Nullable Instant leaseUntil;
    private Instant requestedAt;
    private @Nullable Instant completedAt;
    @Version
    private long lockVersion;

    @Override
    public UUID getId() {
        return assetId;
    }

    public static MediaDeletion create(UUID assetId, long expectedVersion, List<String> keys, List<String> urls,
            Instant now) {
        var deletion = new MediaDeletion();
        deletion.assetId = assetId;
        deletion.expectedVersion = expectedVersion;
        deletion.objectKeys = List.copyOf(keys);
        deletion.publicUrls = List.copyOf(urls);
        deletion.state = "PREPARED";
        deletion.requestedAt = now;
        return deletion;
    }

    public boolean complete() {
        return "COMPLETE".equals(state);
    }

    public void claim(Instant until) {
        leaseUntil = until;
        lastError = null;
    }

    public void originDeleted() {
        state = "ORIGIN_DELETED";
    }

    public void finish(Instant now) {
        state = "COMPLETE";
        completedAt = now;
        leaseUntil = null;
        lastError = null;
    }

    public void failed(String code) {
        lastError = code;
        leaseUntil = null;
    }
}
