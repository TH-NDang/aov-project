package com.wikiaov.arcana.internal.catalog.persistence.entity;

import com.wikiaov.arcana.internal.domain.ArcanaContent;
import com.wikiaov.platform.CatalogCause;
import com.wikiaov.platform.RevisionState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "arcana", name = "arcana_revision")
public class ArcanaRevision {
    @Id
    private UUID id;
    private UUID ownerId;
    private UUID rulesetId;
    private long revisionNo;
    @Enumerated(EnumType.STRING)
    private RevisionState state;
    private long version;
    private Long publicationSequence;
    private Instant publishedAt;
    @Enumerated(EnumType.STRING)
    private CatalogCause cause;
    private UUID effectiveFromPatchVariantId;
    private UUID sourceRevisionId;
    private UUID iconAssetId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private ArcanaContent gameplay;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdByIssuer;
    private String createdBySubject;
    private String updatedByIssuer;
    private String updatedBySubject;
}
