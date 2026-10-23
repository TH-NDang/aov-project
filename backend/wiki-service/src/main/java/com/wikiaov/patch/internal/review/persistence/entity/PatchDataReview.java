package com.wikiaov.patch.internal.review.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "patch_data_review")
public class PatchDataReview {
    @Id
    private UUID patchVariantId;
    private String state;
    private long version;
    private Instant completedAt;
    private Instant updatedAt;
    private String updatedByIssuer;
    private String updatedBySubject;
}
