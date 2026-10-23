package com.wikiaov.patch.internal.review.persistence;

import com.wikiaov.patch.internal.review.persistence.entity.PatchDataReview;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatchDataReviewRepository extends JpaRepository<PatchDataReview, UUID> {
}
