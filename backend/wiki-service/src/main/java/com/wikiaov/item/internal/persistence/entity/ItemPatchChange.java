package com.wikiaov.item.internal.persistence.entity;
import com.wikiaov.platform.CatalogChanges.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "item", name = "item_patch_change_set")
public class ItemPatchChange {
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
