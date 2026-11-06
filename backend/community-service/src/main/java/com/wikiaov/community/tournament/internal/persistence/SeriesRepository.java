package com.wikiaov.community.tournament.internal.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SeriesRepository extends JpaRepository<SeriesRecord, UUID> {
    @Query("""
        SELECT row FROM SeriesRecord row
         WHERE (lower(row.name) LIKE lower(concat('%',:query,'%')) OR lower(row.code) LIKE lower(concat('%',:query,'%')))
           AND (:tournamentId IS NULL OR row.tournamentId=:tournamentId)
           AND (:state='ALL' OR (:state='ACTIVE' AND row.deletedAt IS NULL) OR (:state='DELETED' AND row.deletedAt IS NOT NULL))
        """)
    Page<SeriesRecord> search(String query, UUID tournamentId, String state, Pageable page);

    /** Per-tournament counters, so a list of tournaments never has to load every match. */
    @Query(nativeQuery = true, value = """
        SELECT s.tournament_id AS tournamentId,
               count(*) AS matches,
               count(*) FILTER (WHERE jsonb_typeof(s.content->'result') = 'object') AS played,
               (SELECT count(DISTINCT side.team)
                  FROM tournament.series other,
                       LATERAL (VALUES (other.content->>'teamAId'), (other.content->>'teamBId')) AS side(team)
                 WHERE other.tournament_id = s.tournament_id AND other.deleted_at IS NULL) AS teams
          FROM tournament.series s
         WHERE s.deleted_at IS NULL AND s.tournament_id IS NOT NULL
         GROUP BY s.tournament_id
        """)
    List<TournamentStatsRow> stats();

    interface TournamentStatsRow {
        UUID getTournamentId();

        long getTeams();

        long getMatches();

        long getPlayed();
    }
}
