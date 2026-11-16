package com.wikiaov.media.internal.source.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Stored bytes of a source file, one row per SHA-256 (ADR-030). Rows are inserted with
 * {@code INSERT ... ON CONFLICT DO NOTHING}, so two uploads of the same bytes never fail on each other.
 */
@Entity
@Table(name = "source_object", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SourceObject {

    /** READY while the bytes exist; DELETING while orphaned bytes are being removed from storage. */
    public enum State {
        READY,
        DELETING
    }

    @Id
    @Column(name = "sha256", length = 64)
    private String sha256;

    @Column(name = "object_key", nullable = false, updatable = false)
    private String objectKey;

    @Column(name = "storage_alias", nullable = false, length = 64, updatable = false)
    private String storageAlias;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "content_type", nullable = false, length = 64, updatable = false)
    private String contentType;

    /** Where the bytes were first placed; shown for orphaned bytes, which no path names any more. */
    @Column(name = "first_path", nullable = false, updatable = false)
    private String firstPath;

    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false, length = 16)
    private State state;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by_issuer", nullable = false, updatable = false)
    private String createdByIssuer;

    @Column(name = "created_by_subject", nullable = false, updatable = false)
    private String createdBySubject;

    public boolean isReady() {
        return state == State.READY;
    }

    public void startDeletion() {
        state = State.DELETING;
    }
}
