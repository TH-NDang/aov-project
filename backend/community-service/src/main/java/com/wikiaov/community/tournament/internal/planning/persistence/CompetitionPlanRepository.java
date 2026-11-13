package com.wikiaov.community.tournament.internal.planning.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface CompetitionPlanRepository extends JpaRepository<CompetitionPlanRecord, UUID> {
    /**
     * The seasons of an organizer or circuit, in the order of the tournament list. A tournament in the trash takes its
     * plan with it.
     */
    @Query(value = """
        SELECT p.* FROM tournament.competition_plan p
          JOIN tournament.tournament t ON t.id = p.id
          JOIN tournament.tournament_window w ON w.id = p.id
        WHERE t.deleted_at IS NULL
          AND (:organizer = '' OR p.organizer_page_id = CAST(NULLIF(:organizer, '') AS uuid))
          AND (:circuit = '' OR p.circuit_page_id = CAST(NULLIF(:circuit, '') AS uuid))
        ORDER BY w.recency_rank, w.recency_distance, lower(t.name), p.id
        """, countQuery = """
        SELECT count(*) FROM tournament.competition_plan p
          JOIN tournament.tournament t ON t.id = p.id
        WHERE t.deleted_at IS NULL
          AND (:organizer = '' OR p.organizer_page_id = CAST(NULLIF(:organizer, '') AS uuid))
          AND (:circuit = '' OR p.circuit_page_id = CAST(NULLIF(:circuit, '') AS uuid))
        """, nativeQuery = true)
    Page<CompetitionPlanRecord> summaries(String organizer, String circuit, Pageable pageable);

    Page<CompetitionPlanRecord> findByPublishedAtIsNotNullOrderByPublishedAtDesc(Pageable pageable);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from CompetitionPlanRecord p where p.id = :id")
    Optional<CompetitionPlanRecord> lock(UUID id);

    @Query(value = "select count(*) from tournament.competition_plan p where jsonb_path_exists(p.content, '$.entrants[*] ? (@.teamId == $id)', jsonb_build_object('id', cast(:id as text)))", nativeQuery = true)
    long countTeamReferences(String id);

    /**
     * Plans and plan history that name a record. The plan of the record's own tournament (its series, games and roster
     * rows belong to it too) is left out while it has never been published: such a draft is part of the tournament and
     * goes to the trash with it. Once published or withdrawn, the plan and its history keep protecting the record.
     */
    @Query(value = """
        WITH owner AS (
          SELECT CASE :kind
            WHEN 'TOURNAMENT' THEN :id
            WHEN 'SERIES' THEN (SELECT s.content->>'tournamentId' FROM tournament.series s WHERE CAST(s.id AS text) = :id)
            WHEN 'GAME' THEN (SELECT s.content->>'tournamentId' FROM tournament.game g
                                JOIN tournament.series s ON s.id = g.series_id WHERE CAST(g.id AS text) = :id)
            WHEN 'ROSTER_MEMBERSHIP' THEN (SELECT CAST(r.tournament_id AS text) FROM tournament.roster_membership r
                                             WHERE CAST(r.id AS text) = :id)
          END AS tournament_id
        ), own_draft AS (
          SELECT p.id FROM tournament.competition_plan p, owner
          WHERE CAST(p.id AS text) = owner.tournament_id AND p.published_snapshot IS NULL
            AND NOT EXISTS (SELECT 1 FROM tournament.plan_revision r
                            WHERE r.tournament_id = p.id AND r.action IN ('PUBLISH', 'WITHDRAW'))
        )
        SELECT (SELECT count(*) FROM tournament.competition_plan p
                WHERE p.id NOT IN (SELECT id FROM own_draft)
                  AND (CAST(p.id AS text) = :id OR CAST(p.content AS text) LIKE concat('%', :id, '%')
                       OR CAST(p.published_snapshot AS text) LIKE concat('%', :id, '%')))
             + (SELECT count(*) FROM tournament.plan_revision r
                WHERE r.tournament_id NOT IN (SELECT id FROM own_draft)
                  AND CAST(r.content AS text) LIKE concat('%', :id, '%'))
        """, nativeQuery = true)
    long countReferences(String kind, String id);

    @Query(value = "select (select count(*) from tournament.competition_plan where cast(published_snapshot as text) like concat('%/', :id, '/%')) + (select count(*) from tournament.plan_revision where cast(content as text) like concat('%/', :id, '/%'))", nativeQuery = true)
    long countMedia(String id);

    @Query(value = """
        SELECT pairs.asset FROM (
        SELECT DISTINCT found.owner, lower(m[2]) AS asset FROM (
            SELECT id AS owner, published_snapshot AS body FROM tournament.competition_plan
            UNION ALL SELECT id, content FROM tournament.plan_revision
        ) found, LATERAL regexp_matches(CAST(found.body AS text), '/(assets|media)/([0-9a-fA-F-]{36})/', 'g') m
        ) pairs
        """, nativeQuery = true)
    List<String> allMedia();

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
