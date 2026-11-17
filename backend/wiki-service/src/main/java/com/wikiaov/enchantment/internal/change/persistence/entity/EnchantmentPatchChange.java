package com.wikiaov.enchantment.internal.change.persistence.entity;

import com.wikiaov.platform.CatalogChanges.Kind;
import com.wikiaov.platform.CatalogChanges.Summary;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "enchantment", name = "enchantment_patch_change_set")
public class EnchantmentPatchChange {
    @Id
    private UUID id;
    private UUID ownerId;
    private UUID rulesetId;
    private UUID patchVariantId;
    private UUID fromRevisionId;
    private UUID toRevisionId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Kind> kinds;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Summary> translations;
    private String sourceUrl;
    private Instant recordedAt;
    private String recordedByIssuer;
    private String recordedBySubject;
}
