package com.wikiaov.community.tournament.internal.registry.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SeriesRepository extends JpaRepository<SeriesRecord, UUID> {
    /**
     * Inside a tournament matches run in schedule order, undated ones last. Across tournaments the stronger name match
     * comes first, then the most recent. The id ends both orders so that paging never repeats or skips a match.
     * Native for the search functions of V013.
     */
    @Query(nativeQuery = true, value = """
        SELECT s.* FROM tournament.series s
         WHERE strpos(s.search_names, tournament.search_key(:query)) > 0
           AND (:tournamentId = '' OR s.tournament_id = CAST(NULLIF(:tournamentId, '') AS uuid))
           AND (:state = 'ALL' OR (:state = 'ACTIVE' AND s.deleted_at IS NULL)
                OR (:state = 'DELETED' AND s.deleted_at IS NOT NULL))
         ORDER BY CASE WHEN :tournamentId <> '' THEN s.scheduled_at END NULLS LAST,
                  tournament.name_match_rank(tournament.search_key(:query), s.search_names),
                  s.scheduled_at DESC NULLS LAST,
                  s.code,
                  s.id
        """, countQuery = """
        SELECT count(*) FROM tournament.series s
         WHERE strpos(s.search_names, tournament.search_key(:query)) > 0
           AND (:tournamentId = '' OR s.tournament_id = CAST(NULLIF(:tournamentId, '') AS uuid))
           AND (:state = 'ALL' OR (:state = 'ACTIVE' AND s.deleted_at IS NULL)
                OR (:state = 'DELETED' AND s.deleted_at IS NOT NULL))
        """)
    Page<SeriesRecord> search(String query, String tournamentId, String state, Pageable page);

    /** Per-tournament counters, so a list of tournaments never has to load every match. Native: reads the jsonb result. */
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
