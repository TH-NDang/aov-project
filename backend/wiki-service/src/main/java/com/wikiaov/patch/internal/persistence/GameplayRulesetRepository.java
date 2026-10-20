package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.RulesetReference;
import com.wikiaov.patch.internal.persistence.entity.GameplayRuleset;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface GameplayRulesetRepository extends JpaRepository<GameplayRuleset, UUID> {
    @Query("select new com.wikiaov.patch.RulesetReference(r.id,r.code) from GameplayRuleset r "
            + "where r.lifecycleState='ACTIVE' order by r.code,r.id")
    List<RulesetReference> activeReferences();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from GameplayRuleset e where e.id = :id")
    Optional<GameplayRuleset> lockById(UUID id);
}
