package com.wikiaov.patch.internal.authoring.persistence.entity;

import com.wikiaov.patch.internal.domain.PatchVariantStatus;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "patch_variant")
public class PatchVariant {
    @Id
    private UUID id;

    private UUID patchId;

    private UUID rulesetId;
    private UUID seasonId;

    private String variantCode;

    private long rulesetOrdinal;

    @Enumerated(EnumType.STRING)
    private PatchVariantStatus status;

    private Instant publishedAt;

    private Instant createdAt;

}
