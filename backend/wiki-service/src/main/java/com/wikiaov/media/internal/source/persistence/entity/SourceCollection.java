package com.wikiaov.media.internal.source.persistence.entity;

import com.wikiaov.media.internal.domain.model.ActorRef;
import com.wikiaov.media.internal.shared.persistence.entity.AssignedIdEntity;
import com.wikiaov.media.internal.source.domain.SourceCategory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;

/** A set of source files of one function, such as one capture run (ADR-030). Code and category never change. */
@Entity
@Table(name = "source_collection", schema = "media")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SourceCollection extends AssignedIdEntity {

    @Id
    private UUID id;

    @Column(name = "code", nullable = false, length = 120, updatable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 32, updatable = false)
    private SourceCategory category;

    @Column(name = "label", nullable = false, length = 200)
    private String label;

    @Column(name = "note", length = 2000)
    private @Nullable String note;

    /** A calendar day as written by whoever captured the files; never converted between time zones. */
    @Column(name = "captured_on")
    private @Nullable LocalDate capturedOn;

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

    public static SourceCollection create(UUID id, String code, SourceCategory category, String label,
            @Nullable String note, @Nullable LocalDate capturedOn, ActorRef createdBy, Instant now) {
        SourceCollection collection = new SourceCollection();
        collection.id = id;
        collection.code = code;
        collection.category = category;
        collection.label = label;
        collection.note = note;
        collection.capturedOn = capturedOn;
        collection.createdAt = now;
        collection.updatedAt = now;
        collection.createdByIssuer = createdBy.issuer();
        collection.createdBySubject = createdBy.subject();
        return collection;
    }

    public void describe(String label, @Nullable String note, @Nullable LocalDate capturedOn, Instant now) {
        this.label = label;
        this.note = note;
        this.capturedOn = capturedOn;
        this.updatedAt = now;
    }
}
