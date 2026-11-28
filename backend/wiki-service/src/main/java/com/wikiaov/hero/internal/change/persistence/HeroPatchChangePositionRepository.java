package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangePosition;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroPatchChangePositionRepository extends JpaRepository<HeroPatchChangePosition, UUID> {
}
