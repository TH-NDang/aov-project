package com.wikiaov.patch.internal.authoring.persistence.entity;

import jakarta.persistence.*;
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

    private String status;

    private Instant publishedAt;

    private Instant createdAt;

}
