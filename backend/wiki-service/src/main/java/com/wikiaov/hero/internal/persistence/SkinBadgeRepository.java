package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.SkinBadge;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface SkinBadgeRepository extends JpaRepository<SkinBadge, UUID> {
    Optional<SkinBadge> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from SkinBadge b where b.id = :id")
    Optional<SkinBadge> lock(UUID id);
}
