package com.wikiaov.community.tournament.internal.planning.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface CompetitionPlanRepository extends JpaRepository<CompetitionPlanRecord, UUID> {
    @Query(value = """
        SELECT * FROM tournament.competition_plan
        WHERE (:organizer = '' OR content->>'organizerPageId' = :organizer)
          AND (:circuit = '' OR content->>'circuitPageId' = :circuit)
        ORDER BY id
        """, nativeQuery = true)
    Page<CompetitionPlanRecord> summaries(String organizer, String circuit, Pageable pageable);

    Page<CompetitionPlanRecord> findByPublishedAtIsNotNullOrderByPublishedAtDesc(Pageable pageable);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from CompetitionPlanRecord p where p.id = :id")
    Optional<CompetitionPlanRecord> lock(UUID id);

    @Query(value = "select count(*) from tournament.competition_plan p where jsonb_path_exists(p.content, '$.entrants[*] ? (@.teamId == $id)', jsonb_build_object('id', cast(:id as text)))", nativeQuery = true)
    long countTeamReferences(String id);

    @Query(value = "select (select count(*) from tournament.competition_plan where cast(id as text) = :id or cast(content as text) like concat('%', :id, '%') or cast(published_snapshot as text) like concat('%', :id, '%')) + (select count(*) from tournament.plan_revision where cast(content as text) like concat('%', :id, '%'))", nativeQuery = true)
    long countReferences(String id);

    @Query(value = "select (select count(*) from tournament.competition_plan where cast(published_snapshot as text) like concat('%/', :id, '/%')) + (select count(*) from tournament.plan_revision where cast(content as text) like concat('%/', :id, '/%'))", nativeQuery = true)
    long countMedia(String id);

    @Query(value = """
        SELECT * FROM tournament.competition_plan WHERE published_at IS NOT NULL
          AND (:team = '' OR jsonb_exists(published_snapshot->'teams', :team))
          AND (:player = '' OR jsonb_exists(published_snapshot->'players', :player))
          AND (:organizer = '' OR published_snapshot->'plan'->>'organizerPageId' = :organizer)
          AND (:circuit = '' OR published_snapshot->'plan'->>'circuitPageId' = :circuit)
        ORDER BY published_at DESC, id
        """, nativeQuery = true)
    Page<CompetitionPlanRecord> published(String team, String player, String organizer, String circuit,
            Pageable pageable);
}
