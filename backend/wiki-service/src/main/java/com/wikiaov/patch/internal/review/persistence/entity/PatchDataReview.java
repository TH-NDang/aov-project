package com.wikiaov.patch.internal.review.persistence.entity;

import com.wikiaov.patch.internal.domain.PatchDataReviewState;
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
    @Enumerated(EnumType.STRING)
    private PatchDataReviewState state;
    private long version;
    private Instant completedAt;
    private Instant updatedAt;
    private String updatedByIssuer;
    private String updatedBySubject;
}
