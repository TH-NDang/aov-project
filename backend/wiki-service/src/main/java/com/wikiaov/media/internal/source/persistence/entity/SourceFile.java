package com.wikiaov.media.internal.source.persistence.entity;

import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.shared.persistence.entity.AssignedIdEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** A file of a collection: a relative path that names stored bytes (ADR-030). */
@Entity
@Table(name = "source_file", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SourceFile extends AssignedIdEntity {

    @Id
    private UUID id;

    @Column(name = "collection_id", nullable = false, updatable = false)
    private UUID collectionId;

    @Column(name = "path", nullable = false, updatable = false)
    private String path;

    @Column(name = "sha256", nullable = false, length = 64)
    private String sha256;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "created_by_issuer", nullable = false, updatable = false)
    private String createdByIssuer;

    @Column(name = "created_by_subject", nullable = false, updatable = false)
    private String createdBySubject;

    public static SourceFile place(UUID id, UUID collectionId, String path, String sha256, ActorRef createdBy,
            Instant now) {
        SourceFile file = new SourceFile();
        file.id = id;
        file.collectionId = collectionId;
        file.path = path;
        file.sha256 = sha256;
        file.createdAt = now;
        file.updatedAt = now;
        file.createdByIssuer = createdBy.issuer();
        file.createdBySubject = createdBy.subject();
        return file;
    }

    /** Replacing a file points its path at other bytes; the old bytes stay stored until they are purged. */
    public void pointTo(String newSha256, Instant now) {
        this.sha256 = newSha256;
        this.updatedAt = now;
    }
}
