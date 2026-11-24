package com.wikiaov.community.tournament.internal.planning.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlanRevisionRepository extends JpaRepository<PlanRevision, UUID> {
    /** A revision in a list: what its plan holds, counted by the database so the whole snapshot is not loaded. */
    interface Line {
        UUID getId();

        String getAction();

        Instant getCreatedAt();

        int getEntrants();

        int getStages();

        int getMatches();
    }

    /** Native for the jsonb counts. Newest first. */
    @Query(value = """
        SELECT r.id AS id, r.action AS action, r.created_at AS createdAt,
               coalesce(jsonb_array_length(r.content -> 'plan' -> 'entrants'), 0) AS entrants,
               coalesce(jsonb_array_length(r.content -> 'plan' -> 'stages'), 0) AS stages,
               coalesce(jsonb_array_length(r.content -> 'plan' -> 'matches'), 0) AS matches
          FROM tournament.plan_revision r
         WHERE r.tournament_id = :tournamentId
         ORDER BY r.created_at DESC, r.id
        """, countQuery = """
        SELECT count(*) FROM tournament.plan_revision r WHERE r.tournament_id = :tournamentId
        """, nativeQuery = true)
    Page<Line> history(UUID tournamentId, Pageable pageable);
}
