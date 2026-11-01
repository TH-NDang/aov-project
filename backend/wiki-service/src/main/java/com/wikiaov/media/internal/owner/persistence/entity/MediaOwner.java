package com.wikiaov.media.internal.owner.persistence.entity;

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
import org.jspecify.annotations.Nullable;

/**
 * Who owns images (ADR-017). Created on first use by a source; sources keep a copy of the display name.
 */
@Entity
@Table(name = "media_owner", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MediaOwner {

    @Id
    private UUID id;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "name_key", nullable = false, length = 200)
    private String nameKey;

    @Column(name = "contact_url", length = 2048)
    private @Nullable String contactUrl;

    /** Optimistic lock, exposed to clients as {@code version} / {@code expectedVersion}. */
    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public void update(String name, String nameKey, @Nullable String contactUrl, Instant now) {
        this.name = name;
        this.nameKey = nameKey;
        this.contactUrl = contactUrl;
        this.updatedAt = now;
    }
}
