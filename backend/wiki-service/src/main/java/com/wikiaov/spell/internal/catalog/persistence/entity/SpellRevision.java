package com.wikiaov.spell.internal.catalog.persistence.entity;

import com.wikiaov.spell.internal.domain.SpellContent;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "spell", name = "spell_revision")
public class SpellRevision {
    @Id
    private UUID id;
    private UUID ownerId;
    private UUID rulesetId;
    private long revisionNo;
    private String state;
    private long version;
    private Long publicationSequence;
    private Instant publishedAt;
    private String cause;
    private UUID effectiveFromPatchVariantId;
    private UUID sourceRevisionId;
    private UUID iconAssetId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private SpellContent gameplay;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdByIssuer;
    private String createdBySubject;
    private String updatedByIssuer;
    private String updatedBySubject;
}
