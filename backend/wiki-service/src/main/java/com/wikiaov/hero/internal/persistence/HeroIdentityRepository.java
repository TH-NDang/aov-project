package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.HeroIdentity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface HeroIdentityRepository extends JpaRepository<HeroIdentity, UUID> {
    @Query("select h from HeroIdentity h where h.code=:code or h.id in (select a.heroId from HeroCodeAlias a where a.legacyCode=:code)")
    Optional<HeroIdentity> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select h from HeroIdentity h where h.id = :id")
    Optional<HeroIdentity> lockById(UUID id);
}
