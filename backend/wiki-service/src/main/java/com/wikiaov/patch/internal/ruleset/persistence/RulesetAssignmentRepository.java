package com.wikiaov.patch.internal.ruleset.persistence;

import com.wikiaov.patch.internal.ruleset.persistence.entity.RulesetAssignment;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface RulesetAssignmentRepository extends JpaRepository<RulesetAssignment, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from RulesetAssignment e where e.id = :id")
    Optional<RulesetAssignment> lockById(UUID id);

    List<RulesetAssignment> findByRegionIdOrderByValidFromDesc(UUID regionId);

    @Query("select count(a)>0 from RulesetAssignment a where a.regionId=:regionId and a.rulesetId=:rulesetId "
            + "and a.validFrom<=:at and (a.validTo is null or a.validTo>:at)")
    boolean appliesAt(UUID regionId, UUID rulesetId, Instant at);
}
