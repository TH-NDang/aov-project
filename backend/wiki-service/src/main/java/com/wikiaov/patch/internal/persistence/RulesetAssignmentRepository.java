package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.internal.persistence.entity.RulesetAssignment;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface RulesetAssignmentRepository extends JpaRepository<RulesetAssignment, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from RulesetAssignment e where e.id = :id")
    Optional<RulesetAssignment> lockById(UUID id);
}
