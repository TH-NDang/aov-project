package com.wikiaov.community.tournament.internal.planning.persistence;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanRevisionRepository extends JpaRepository<PlanRevision, UUID> {
}
