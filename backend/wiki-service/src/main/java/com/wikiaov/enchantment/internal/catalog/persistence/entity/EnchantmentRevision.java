package com.wikiaov.enchantment.internal.catalog.persistence.entity;

import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
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
@Table(schema = "enchantment", name = "enchantment_revision")
public class EnchantmentRevision {
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
    private EnchantmentContent gameplay;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdByIssuer;
    private String createdBySubject;
    private String updatedByIssuer;
    private String updatedBySubject;
}
