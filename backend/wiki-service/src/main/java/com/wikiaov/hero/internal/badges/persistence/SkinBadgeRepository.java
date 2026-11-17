package com.wikiaov.hero.internal.badges.persistence;

import com.wikiaov.hero.internal.badges.persistence.entity.SkinBadge;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface SkinBadgeRepository extends JpaRepository<SkinBadge, UUID> {
    Optional<SkinBadge> findByCode(String code);

    @Query("select b.code from SkinBadge b")
    List<String> codes();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from SkinBadge b where b.id = :id")
    Optional<SkinBadge> lock(UUID id);
}
