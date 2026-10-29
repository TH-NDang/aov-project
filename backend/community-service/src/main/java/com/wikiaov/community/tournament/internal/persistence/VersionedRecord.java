package com.wikiaov.community.tournament.internal.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class VersionedRecord {
    @Id
    protected UUID id;
    @Version
    protected long version;
    protected Instant createdAt;
    protected Instant updatedAt;
    protected String editedBy;
    protected Instant deletedAt;
    protected String deletedBy;

    protected VersionedRecord() {
    }

    protected VersionedRecord(UUID id, String actor) {
        this.id = id;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
        this.editedBy = actor;
    }

    public UUID getId() {
        return id;
    }

    public long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void delete(String actor) {
        this.deletedAt = Instant.now();
        this.deletedBy = actor;
        touch(actor);
    }

    public void restore(String actor) {
        this.deletedAt = null;
        this.deletedBy = null;
        touch(actor);
    }

    public void touch(String actor) {
        this.updatedAt = Instant.now();
        this.editedBy = actor;
    }
}
