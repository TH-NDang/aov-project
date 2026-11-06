package com.wikiaov.community.tournament.internal.directory.persistence;

import com.wikiaov.community.tournament.internal.persistence.TeamRecord;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/**
 * Derived figures for the directories of teams, players, organizers and circuits, computed from tournaments, series
 * and rosters. Dates inside tournament documents are stored as [year, month, day], so a tournament's order is read
 * from those parts, falling back to its year.
 */
public interface DirectoryRepository extends Repository<TeamRecord, UUID> {
    String DAYS = """
        days AS (
            SELECT id,
                   coalesce(
                       CAST(content->'startsOn'->>0 AS int) * 10000
                           + CAST(content->'startsOn'->>1 AS int) * 100
                           + CAST(content->'startsOn'->>2 AS int),
                       CAST(content->>'year' AS int) * 10000,
                       0) AS day
              FROM tournament.tournament
             WHERE deleted_at IS NULL
        )
        """;

    String PLACEMENTS = """
        placements AS (
            SELECT t.id AS tournament_id, pl->>'teamId' AS team_id, pl->>'place' AS place,
                   CASE WHEN jsonb_typeof(pl->'prizeUsd') = 'number' THEN CAST(pl->>'prizeUsd' AS numeric) END AS prize
              FROM tournament.tournament t, jsonb_array_elements(coalesce(t.content->'placements', '[]')) pl
             WHERE t.deleted_at IS NULL AND pl->>'teamId' IS NOT NULL
        )
        """;

    String PLAYER_ACTIVITY = """
        played AS (
            SELECT m.player_id, m.team_id, m.tournament_id, m.content->>'lane' AS lane, d.day
              FROM tournament.roster_membership m
              JOIN days d ON d.id = m.tournament_id
             WHERE m.deleted_at IS NULL
        ),
        lanes AS (
            SELECT DISTINCT ON (player_id) player_id, lane
              FROM played
             WHERE lane IS NOT NULL
             ORDER BY player_id, day DESC, tournament_id
        )
        """;

    String PLAYER_FILTER = """
        p.deleted_at IS NULL
        AND p.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
        AND (:country = '' OR p.content->>'country' = :country)
        AND (:lane = '' OR coalesce(p.content->>'lane', l.lane) = :lane)
        AND (:status = '' OR coalesce(p.content->>'careerStatus', 'UNKNOWN') = :status)
        """;

    @Query(nativeQuery = true, value = "WITH " + DAYS + ", " + PLACEMENTS + ", " + PLAYER_ACTIVITY + """
        ,
        totals AS (
            SELECT g.player_id, count(DISTINCT g.tournament_id) AS tournaments,
                   count(DISTINCT g.tournament_id) FILTER (WHERE w.team_id IS NOT NULL) AS titles,
                   max(g.day) AS last_day
              FROM played g
              LEFT JOIN placements w
                ON w.place = '1' AND w.tournament_id = g.tournament_id AND w.team_id = CAST(g.team_id AS text)
             GROUP BY g.player_id
        ),
        latest AS (
            SELECT DISTINCT ON (player_id) player_id, team_id, tournament_id
              FROM played
             ORDER BY player_id, day DESC, tournament_id
        )
        SELECT p.id AS id,
               coalesce(t.tournaments, 0) AS tournaments,
               coalesce(t.titles, 0) AS titles,
               coalesce(p.content->>'lane', l.lane) AS lane,
               x.team_id AS teamId,
               x.tournament_id AS tournamentId
          FROM tournament.player p
          LEFT JOIN totals t ON t.player_id = p.id
          LEFT JOIN latest x ON x.player_id = p.id
          LEFT JOIN lanes l ON l.player_id = p.id
         WHERE
        """ + PLAYER_FILTER + """
         ORDER BY CASE WHEN :sort = 'NAME' THEN lower(p.content->>'nickname') END,
                  CASE WHEN :sort = 'TITLES' THEN coalesce(t.titles, 0) END DESC,
                  CASE WHEN :sort IN ('TITLES', 'TOURNAMENTS') THEN coalesce(t.tournaments, 0) END DESC,
                  coalesce(t.last_day, 0) DESC,
                  lower(p.content->>'nickname'),
                  p.id
        """, countQuery = "WITH " + DAYS + ", " + PLAYER_ACTIVITY + """
        SELECT count(*)
          FROM tournament.player p
          LEFT JOIN lanes l ON l.player_id = p.id
         WHERE
        """ + PLAYER_FILTER)
    Page<PlayerRow> players(String query, String country, String lane, String status, String sort, Pageable page);

    @Query(nativeQuery = true, value = "WITH " + DAYS + ", " + PLACEMENTS + """
        ,
        sides AS (
            SELECT CAST(s.content->>'teamAId' AS uuid) AS team_id, s.tournament_id,
                   CAST(s.content->'result'->>'scoreA' AS int) AS own,
                   CAST(s.content->'result'->>'scoreB' AS int) AS rival
              FROM tournament.series s
             WHERE s.deleted_at IS NULL AND s.content->>'teamAId' IS NOT NULL
            UNION ALL
            SELECT CAST(s.content->>'teamBId' AS uuid), s.tournament_id,
                   CAST(s.content->'result'->>'scoreB' AS int),
                   CAST(s.content->'result'->>'scoreA' AS int)
              FROM tournament.series s
             WHERE s.deleted_at IS NULL AND s.content->>'teamBId' IS NOT NULL
        ),
        records AS (
            SELECT team_id,
                   count(*) FILTER (WHERE own IS NOT NULL) AS matches,
                   count(*) FILTER (WHERE own > rival) AS wins,
                   count(*) FILTER (WHERE own < rival) AS losses
              FROM sides
             GROUP BY team_id
        ),
        entered AS (
            SELECT team_id, tournament_id FROM sides WHERE tournament_id IS NOT NULL
            UNION
            SELECT team_id, tournament_id FROM tournament.roster_membership WHERE deleted_at IS NULL
            UNION
            SELECT CAST(team_id AS uuid), tournament_id FROM placements
        ),
        entries AS (
            SELECT e.team_id, count(*) AS tournaments, max(d.day) AS last_day
              FROM entered e
              JOIN days d ON d.id = e.tournament_id
             GROUP BY e.team_id
        ),
        latest AS (
            SELECT DISTINCT ON (e.team_id) e.team_id, e.tournament_id
              FROM entered e
              JOIN days d ON d.id = e.tournament_id
             ORDER BY e.team_id, d.day DESC, e.tournament_id
        ),
        honours AS (
            SELECT CAST(team_id AS uuid) AS team_id, count(*) FILTER (WHERE place = '1') AS titles, sum(prize) AS prize
              FROM placements
             GROUP BY team_id
        )
        SELECT t.id AS id,
               coalesce(e.tournaments, 0) AS tournaments,
               coalesce(r.matches, 0) AS matches,
               coalesce(r.wins, 0) AS wins,
               coalesce(r.losses, 0) AS losses,
               coalesce(h.titles, 0) AS titles,
               h.prize AS prizeUsd,
               x.tournament_id AS tournamentId
          FROM tournament.team t
          LEFT JOIN entries e ON e.team_id = t.id
          LEFT JOIN records r ON r.team_id = t.id
          LEFT JOIN honours h ON h.team_id = t.id
          LEFT JOIN latest x ON x.team_id = t.id
         WHERE t.deleted_at IS NULL
           AND t.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
           AND (:country = '' OR t.content->>'country' = :country)
         ORDER BY CASE WHEN :sort = 'NAME' THEN lower(t.content->>'name') END,
                  CASE WHEN :sort = 'PRIZE' THEN coalesce(h.prize, 0) END DESC,
                  CASE WHEN :sort = 'TITLES' THEN coalesce(h.titles, 0) END DESC,
                  CASE WHEN :sort IN ('TITLES', 'TOURNAMENTS') THEN coalesce(e.tournaments, 0) END DESC,
                  coalesce(e.last_day, 0) DESC,
                  lower(t.content->>'name'),
                  t.id
        """, countQuery = """
        SELECT count(*)
          FROM tournament.team t
         WHERE t.deleted_at IS NULL
           AND t.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
           AND (:country = '' OR t.content->>'country' = :country)
        """)
    Page<TeamRow> teams(String query, String country, String sort, Pageable page);

    /** Roster lines of the given teams in every tournament; callers keep the tournament they want to show. */
    @Query(nativeQuery = true, value = "WITH " + DAYS + """
        SELECT m.team_id AS teamId, m.tournament_id AS tournamentId, m.player_id AS playerId,
               m.content->>'lane' AS lane, m.content->>'status' AS status, d.day AS day
          FROM tournament.roster_membership m
          JOIN days d ON d.id = m.tournament_id
         WHERE m.deleted_at IS NULL AND CAST(m.team_id AS text) = ANY(string_to_array(:teams, ','))
        """)
    List<LineupRow> lineups(String teams);

    @Query(nativeQuery = true, value = "WITH " + DAYS + """
        ,
        plans AS (
            SELECT p.id AS tournament_id, p.content->>'organizerPageId' AS organizer,
                   p.content->>'circuitPageId' AS circuit, t.content->>'tier' AS tier,
                   CAST(t.content->>'year' AS int) AS year, d.day
              FROM tournament.competition_plan p
              JOIN tournament.tournament t ON t.id = p.id AND t.deleted_at IS NULL
              JOIN days d ON d.id = t.id
        ),
        links AS (
            SELECT organizer AS page_id, tournament_id, tier, year, day FROM plans WHERE organizer IS NOT NULL
            UNION ALL
            SELECT circuit, tournament_id, tier, year, day FROM plans WHERE circuit IS NOT NULL
        )
        SELECT CAST(page_id AS uuid) AS pageId,
               count(DISTINCT tournament_id) AS tournaments,
               min(year) AS firstYear,
               max(year) AS lastYear,
               string_agg(DISTINCT tier, ',') AS tiers,
               (array_agg(tournament_id ORDER BY day DESC, tournament_id))[1] AS latestTournamentId
          FROM links
         GROUP BY page_id
        """)
    List<CompetitionPageRow> competitionPages();

    interface PlayerRow {
        UUID getId();

        long getTournaments();

        long getTitles();

        String getLane();

        UUID getTeamId();

        UUID getTournamentId();
    }

    interface TeamRow {
        UUID getId();

        long getTournaments();

        long getMatches();

        long getWins();

        long getLosses();

        long getTitles();

        BigDecimal getPrizeUsd();

        UUID getTournamentId();
    }

    interface LineupRow {
        UUID getTeamId();

        UUID getTournamentId();

        UUID getPlayerId();

        String getLane();

        String getStatus();

        int getDay();
    }

    interface CompetitionPageRow {
        UUID getPageId();

        long getTournaments();

        Integer getFirstYear();

        Integer getLastYear();

        String getTiers();

        UUID getLatestTournamentId();
    }
}
