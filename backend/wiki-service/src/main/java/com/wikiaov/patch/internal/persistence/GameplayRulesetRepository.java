package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.internal.persistence.entity.GameplayRuleset;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface GameplayRulesetRepository extends JpaRepository<GameplayRuleset, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from GameplayRuleset e where e.id = :id")
    Optional<GameplayRuleset> lockById(UUID id);
}
