package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.SkinBadgeGroup;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface SkinBadgeGroupRepository extends JpaRepository<SkinBadgeGroup, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from SkinBadgeGroup g where g.id = :id")
    Optional<SkinBadgeGroup> lock(UUID id);
}
