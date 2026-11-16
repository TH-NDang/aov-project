package com.wikiaov.community.tournament.internal.directory.persistence;

import com.wikiaov.community.tournament.internal.persistence.TeamRecord;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/**
 * Derived figures and ranked lists for teams, players, tournaments, organizers and circuits, computed from tournaments,
 * series and rosters when read. Recency comes from the views of migration V013; spec 04 states the rules.
 */
public interface DirectoryRepository extends Repository<TeamRecord, UUID> {
    String DAYS = """
        days AS (
            SELECT id, coalesce(CAST(to_char(starts_on, 'YYYYMMDD') AS int), season_year * 10000, 0) AS day
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

    String PLAYER_LINES = """
        lines AS (
            SELECT player_id, team_id, tournament_id, lane, active_on FROM tournament.player_tournament_activity
        )
        """;

    /** With level MAIN a main event also answers to the names of its parts, which the list leaves out. */
    String TOURNAMENT_FILTER = """
        t.deleted_at IS NULL
        AND (:level <> 'MAIN' OR t.parent_id IS NULL)
        AND (strpos(t.search_names, tournament.search_key(:wanted)) > 0
             OR t.content->>'region' = ANY(string_to_array(:alsoRegions, ','))
             OR (:level = 'MAIN' AND EXISTS (SELECT 1 FROM tournament.tournament part
                                              WHERE part.parent_id = t.id AND part.deleted_at IS NULL
                                                AND strpos(part.search_names, tournament.search_key(:wanted)) > 0)))
        AND (:status = '' OR t.status = :status)
        AND (:tier = '' OR coalesce(t.content->>'tier', 'UNKNOWN') = :tier)
        AND (:region = '' OR t.content->>'region' = :region)
        AND (:year = '' OR t.season_year = CAST(NULLIF(:year, '') AS int))
        """;

    String PLAYER_FILTER = """
        p.deleted_at IS NULL
        AND p.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
        AND (:country = '' OR p.content->>'country' = :country)
        AND (:lane = '' OR coalesce(p.content->>'lane', l.lane) = :lane)
        AND (:status = '' OR coalesce(p.content->>'careerStatus', 'UNKNOWN') = :status)
        """;

    @Query(nativeQuery = true, value = "WITH " + PLACEMENTS + ", " + PLAYER_LINES + """
        ,
        lanes AS (
            SELECT DISTINCT ON (player_id) player_id, lane
              FROM lines
             WHERE lane IS NOT NULL
             ORDER BY player_id, active_on DESC NULLS LAST, tournament_id
        ),
        totals AS (
            SELECT g.player_id, count(DISTINCT g.tournament_id) AS tournaments,
                   count(DISTINCT g.tournament_id) FILTER (WHERE w.team_id IS NOT NULL) AS titles
              FROM lines g
              LEFT JOIN placements w
                ON w.place = '1' AND w.tournament_id = g.tournament_id AND w.team_id = CAST(g.team_id AS text)
             GROUP BY g.player_id
        ),
        latest AS (
            SELECT DISTINCT ON (player_id) player_id, team_id, tournament_id, active_on
              FROM lines
             ORDER BY player_id, active_on DESC NULLS LAST, tournament_id
        )
        SELECT p.id AS id,
               coalesce(t.tournaments, 0) AS tournaments,
               coalesce(t.titles, 0) AS titles,
               coalesce(p.content->>'lane', l.lane) AS lane,
               x.team_id AS teamId,
               x.tournament_id AS tournamentId,
               x.active_on AS lastActiveOn
          FROM tournament.player p
          LEFT JOIN totals t ON t.player_id = p.id
          LEFT JOIN latest x ON x.player_id = p.id
          LEFT JOIN lanes l ON l.player_id = p.id
         WHERE
        """ + PLAYER_FILTER + """
         ORDER BY CASE WHEN :sort = 'NAME' THEN lower(p.content->>'nickname') END,
                  CASE WHEN :sort = 'TITLES' THEN coalesce(t.titles, 0) END DESC,
                  CASE WHEN :sort IN ('TITLES', 'TOURNAMENTS') THEN coalesce(t.tournaments, 0) END DESC,
                  CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), p.search_names) END,
                  x.active_on DESC NULLS LAST,
                  lower(p.content->>'nickname'),
                  p.id
        """, countQuery = """
        WITH lanes AS (
            SELECT DISTINCT ON (player_id) player_id, lane
              FROM tournament.player_tournament_activity
             WHERE lane IS NOT NULL AND :lane <> ''
             ORDER BY player_id, active_on DESC NULLS LAST, tournament_id
        )
        SELECT count(*)
          FROM tournament.player p
          LEFT JOIN lanes l ON l.player_id = p.id
         WHERE
        """ + PLAYER_FILTER)
    Page<PlayerRow> players(String query, String wanted, String country, String lane, String status, String sort,
            Pageable page);

    @Query(nativeQuery = true, value = "WITH " + PLACEMENTS + """
        ,
        sides AS (
            SELECT s.team_a_id AS team_id,
                   CAST(s.content->'result'->>'scoreA' AS int) AS own,
                   CAST(s.content->'result'->>'scoreB' AS int) AS rival
              FROM tournament.series s
             WHERE s.deleted_at IS NULL AND s.team_a_id IS NOT NULL
            UNION ALL
            SELECT s.team_b_id,
                   CAST(s.content->'result'->>'scoreB' AS int),
                   CAST(s.content->'result'->>'scoreA' AS int)
              FROM tournament.series s
             WHERE s.deleted_at IS NULL AND s.team_b_id IS NOT NULL
        ),
        records AS (
            SELECT team_id,
                   count(*) FILTER (WHERE own IS NOT NULL) AS matches,
                   count(*) FILTER (WHERE own > rival) AS wins,
                   count(*) FILTER (WHERE own < rival) AS losses
              FROM sides
             GROUP BY team_id
        ),
        activity AS (
            SELECT team_id, tournament_id, active_on FROM tournament.team_tournament_activity
        ),
        entries AS (
            SELECT team_id, count(*) AS tournaments FROM activity GROUP BY team_id
        ),
        latest AS (
            SELECT DISTINCT ON (team_id) team_id, tournament_id, active_on
              FROM activity
             ORDER BY team_id, active_on DESC NULLS LAST, tournament_id
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
               x.tournament_id AS tournamentId,
               x.active_on AS lastActiveOn
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
                  CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), t.search_names) END,
                  x.active_on DESC NULLS LAST,
                  lower(t.content->>'name'),
                  t.id
        """, countQuery = """
        SELECT count(*)
          FROM tournament.team t
         WHERE t.deleted_at IS NULL
           AND t.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
           AND (:country = '' OR t.content->>'country' = :country)
        """)
    Page<TeamRow> teams(String query, String wanted, String country, String sort, Pageable page);

    /**
     * Teams for a list or picker. An exact name comes first, then the teams of the tournament in context, then the
     * strength of the name match and the last activity. Paging is safe: the id ends every order.
     */
    @Query(nativeQuery = true, value = """
        SELECT t.id AS id, a.active_on AS lastActiveOn,
               CASE WHEN c.team_id IS NOT NULL THEN 'TOURNAMENT' END AS context
          FROM tournament.team t
          LEFT JOIN tournament.team_activity a ON a.team_id = t.id
          LEFT JOIN (SELECT DISTINCT team_id FROM tournament.tournament_team
                      WHERE tournament_id = CAST(NULLIF(:tournamentId, '') AS uuid)) c ON c.team_id = t.id
         WHERE t.deleted_at IS NULL
           AND t.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
         ORDER BY CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), t.search_names) > 0 END,
                  CASE WHEN :sort = 'RECENT' THEN c.team_id IS NULL END,
                  CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), t.search_names) END,
                  CASE WHEN :sort = 'RECENT' THEN a.active_on END DESC NULLS LAST,
                  lower(t.name),
                  t.id
        """, countQuery = """
        SELECT count(*)
          FROM tournament.team t
         WHERE t.deleted_at IS NULL
           AND t.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
        """)
    Page<RankedRow> rankedTeams(String query, String wanted, String sort, String tournamentId, Pageable page);

    /**
     * Players for a list or picker, ordered like {@link #rankedTeams}. The context is closest for the roster of the same
     * team in the same tournament, then that team's other rosters, then other rosters of the tournament.
     */
    @Query(nativeQuery = true, value = """
        SELECT p.id AS id, a.active_on AS lastActiveOn,
               CASE c.closeness WHEN 0 THEN 'TEAM_IN_TOURNAMENT' WHEN 1 THEN 'TEAM' WHEN 2 THEN 'TOURNAMENT' END AS context
          FROM tournament.player p
          LEFT JOIN tournament.player_activity a ON a.player_id = p.id
          LEFT JOIN (SELECT player_id,
                            min(CASE WHEN team_id = CAST(NULLIF(:teamId, '') AS uuid)
                                          AND tournament_id = CAST(NULLIF(:tournamentId, '') AS uuid) THEN 0
                                     WHEN team_id = CAST(NULLIF(:teamId, '') AS uuid) THEN 1
                                     ELSE 2 END) AS closeness
                       FROM tournament.roster_membership
                      WHERE deleted_at IS NULL
                        AND (team_id = CAST(NULLIF(:teamId, '') AS uuid)
                             OR tournament_id = CAST(NULLIF(:tournamentId, '') AS uuid))
                      GROUP BY player_id) c ON c.player_id = p.id
         WHERE p.deleted_at IS NULL
           AND p.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
         ORDER BY CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), p.search_names) > 0 END,
                  CASE WHEN :sort = 'RECENT' THEN c.closeness END NULLS LAST,
                  CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), p.search_names) END,
                  CASE WHEN :sort = 'RECENT' THEN a.active_on END DESC NULLS LAST,
                  lower(p.name),
                  p.id
        """, countQuery = """
        SELECT count(*)
          FROM tournament.player p
         WHERE p.deleted_at IS NULL
           AND p.reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
        """)
    Page<RankedRow> rankedPlayers(String query, String wanted, String sort, String teamId, String tournamentId,
            Pageable page);

    /**
     * Tournaments for a list or picker: RECENT runs from what is in progress outwards in time (V013), STATUS keeps the
     * older grouping by status, and the tournaments of a team or player in context come first in a picker. Level MAIN
     * lists main events only and places each by the member closest to today, its parts included (V016).
     */
    @Query(nativeQuery = true, value = """
        SELECT t.id AS id, CAST(NULL AS date) AS lastActiveOn,
               CASE WHEN c.tournament_id IS NOT NULL THEN 'PARTICIPANT' END AS context
          FROM tournament.tournament t
          JOIN tournament.tournament_window w ON w.id = t.id
          LEFT JOIN tournament.event_window e ON :level = 'MAIN' AND e.id = t.id
          LEFT JOIN (SELECT tournament_id FROM tournament.tournament_team
                      WHERE team_id = CAST(NULLIF(:teamId, '') AS uuid)
                     UNION
                     SELECT tournament_id FROM tournament.roster_membership
                      WHERE deleted_at IS NULL AND player_id = CAST(NULLIF(:playerId, '') AS uuid)) c
            ON c.tournament_id = t.id
         WHERE
        """ + TOURNAMENT_FILTER + """
         ORDER BY CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), t.search_names) > 0 END,
                  CASE WHEN :sort = 'RECENT' THEN c.tournament_id IS NULL END,
                  CASE WHEN :sort = 'RECENT' THEN tournament.name_match_rank(tournament.search_key(:wanted), t.search_names) END,
                  CASE WHEN :sort = 'RECENT' THEN CASE WHEN e.id IS NULL THEN w.recency_rank ELSE e.recency_rank END END,
                  CASE WHEN :sort = 'RECENT'
                       THEN CASE WHEN e.id IS NULL THEN w.recency_distance ELSE e.recency_distance END END,
                  CASE WHEN :sort = 'STATUS' THEN
                      CASE t.status WHEN 'ONGOING' THEN 0 WHEN 'UPCOMING' THEN 1 WHEN 'ANNOUNCED' THEN 2
                                    WHEN 'FINISHED' THEN 4 ELSE 3 END END,
                  CASE WHEN :sort = 'STATUS' THEN t.starts_on END DESC NULLS LAST,
                  CASE WHEN :sort = 'UPDATED' THEN t.updated_at END DESC,
                  lower(t.name),
                  t.id
        """, countQuery = "SELECT count(*) FROM tournament.tournament t WHERE " + TOURNAMENT_FILTER)
    Page<RankedRow> rankedTournaments(String wanted, String alsoRegions, String status, String tier, String region,
            String year, String sort, String level, String teamId, String playerId, Pageable page);

    /** The parts of one main event, or of every main event when none is named, each event's parts in playing order. */
    @Query(nativeQuery = true, value = """
        SELECT t.id
          FROM tournament.tournament t
         WHERE t.deleted_at IS NULL AND t.parent_id IS NOT NULL
           AND (:mainEventId = '' OR t.parent_id = CAST(NULLIF(:mainEventId, '') AS uuid))
         ORDER BY t.parent_id, t.starts_on NULLS LAST, lower(t.name), t.id
        """)
    List<UUID> tournamentParts(String mainEventId);

    /** What a list of tournaments can be narrowed by: its statuses with their counts, its regions and years. */
    @Query(nativeQuery = true, value = """
        WITH listed AS (
            SELECT status, content->>'region' AS region, season_year
              FROM tournament.tournament
             WHERE deleted_at IS NULL AND (:level <> 'MAIN' OR parent_id IS NULL)
        )
        SELECT 'STATUS' AS facet, status AS value, count(*) AS rows FROM listed GROUP BY status
        UNION ALL
        SELECT 'REGION', region, count(*) FROM listed WHERE region IS NOT NULL GROUP BY region
        UNION ALL
        SELECT 'YEAR', CAST(season_year AS text), count(*) FROM listed WHERE season_year IS NOT NULL GROUP BY season_year
        """)
    List<FacetRow> tournamentFacets(String level);

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
            SELECT p.id AS tournament_id, p.organizer_page_id AS organizer,
                   p.circuit_page_id AS circuit, t.content->>'tier' AS tier,
                   t.season_year AS year, d.day,
                   main.organizer_page_id AS main_organizer, main.circuit_page_id AS main_circuit
              FROM tournament.competition_plan p
              JOIN tournament.tournament t ON t.id = p.id AND t.deleted_at IS NULL
              JOIN days d ON d.id = t.id
              LEFT JOIN tournament.competition_plan main ON main.id = t.parent_id
        ),
        links AS (
            SELECT organizer AS page_id, tournament_id, tier, year, day FROM plans
             WHERE organizer IS NOT NULL AND organizer IS DISTINCT FROM main_organizer
            UNION ALL
            SELECT circuit, tournament_id, tier, year, day FROM plans
             WHERE circuit IS NOT NULL AND circuit IS DISTINCT FROM main_circuit
        )
        SELECT page_id AS pageId,
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

        LocalDate getLastActiveOn();
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

        LocalDate getLastActiveOn();
    }

    interface RankedRow {
        UUID getId();

        LocalDate getLastActiveOn();

        String getContext();
    }

    interface FacetRow {
        String getFacet();

        String getValue();

        long getRows();
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
