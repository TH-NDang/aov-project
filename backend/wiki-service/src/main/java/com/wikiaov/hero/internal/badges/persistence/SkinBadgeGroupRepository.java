package com.wikiaov.hero.internal.badges.persistence;

import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadgeGroup;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SkinBadgeGroupRepository extends JpaRepository<SkinBadgeGroup, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from SkinBadgeGroup g where g.id = :id")
    Optional<SkinBadgeGroup> lock(UUID id);
}
