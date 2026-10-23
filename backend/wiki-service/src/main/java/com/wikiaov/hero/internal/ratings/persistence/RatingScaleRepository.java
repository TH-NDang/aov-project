package com.wikiaov.hero.internal.ratings.persistence;

import com.wikiaov.hero.internal.ratings.persistence.entity.RatingScale;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RatingScaleRepository extends JpaRepository<RatingScale, String> {
}
