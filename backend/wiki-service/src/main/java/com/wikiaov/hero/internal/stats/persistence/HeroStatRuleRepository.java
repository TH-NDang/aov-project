package com.wikiaov.hero.internal.stats.persistence;

import com.wikiaov.hero.internal.stats.persistence.entity.HeroStatRule;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface HeroStatRuleRepository extends JpaRepository<HeroStatRule, UUID> {
    List<HeroStatRule> findAllByOrderByStatKey();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<HeroStatRule> findByStatKey(String statKey);
}
