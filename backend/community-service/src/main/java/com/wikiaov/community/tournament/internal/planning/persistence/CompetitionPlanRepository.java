package com.wikiaov.community.tournament.internal.planning.persistence;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface CompetitionPlanRepository extends JpaRepository<CompetitionPlanRecord, UUID> {
    /** A plan as a list names it, counted by the database so no plan document is loaded. */
    interface IndexRow {
        UUID getId();

        int getEntrants();

        int getMatches();

        @Nullable
        Instant getPublishedAt();

        @Nullable
        String getCircuit();

        @Nullable
        UUID getCircuitPageId();
    }

    /** A published competition for a list; its snapshot leaves out what only the competition's own page shows. */
    interface ListedRow {
        UUID getId();

        Instant getPublishedAt();

        String getSnapshot();
    }

    /** A team, player or person of published competitions, as the newest of them names it. */
    interface ParticipantRow {
        UUID getId();

        String getContent();

        int getCompetitions();

        UUID getCompetitionId();

        String getCompetitionName();

        /** The team a player was registered with, or a person worked for, in that competition. */
        @Nullable
        UUID getTeamId();

        @Nullable
        String getTeam();

        /** What a person did in that competition, as role names joined by commas. */
        @Nullable
        String getRoles();
    }

    /**
     * The participants a search finds, each as the newest competition names it; a competition without a start date
     * counts as the oldest. A snapshot holds its dates as [year, month, day], which do not sort as text, so the date
     * function of V013 reads them. A snapshot is large, so each is opened only once, for its date and its members.
     * Native: unfolds the maps of the jsonb published snapshots.
     */
    String PARTICIPANTS = """
        WITH competition AS MATERIALIZED (
          SELECT p.id, p.published_snapshot #> '{tournament,startsOn}' AS starts,
                 p.published_snapshot -> :collection AS members
            FROM tournament.competition_plan p
           WHERE p.published_at IS NOT NULL
        ), seen AS (
          SELECT e.key AS id, e.value AS content, c.id AS competition,
                 tournament.document_date(c.starts) AS starts_on,
                 count(*) OVER (PARTITION BY e.key) AS competitions,
                 row_number() OVER (PARTITION BY e.key
                   ORDER BY tournament.document_date(c.starts) DESC NULLS LAST, c.id) AS newest
            FROM competition c
            CROSS JOIN LATERAL jsonb_each(c.members) e
        ), participant AS (
          SELECT s.*, lower(coalesce(s.content->>'name', s.content->>'nickname')) AS label
            FROM seen s
           WHERE s.newest = 1 AND (:country = '' OR s.content->>'country' = :country)
             AND lower(concat_ws(' ', s.content->>'name', s.content->>'shortName', s.content->>'nickname',
                                 s.content->>'aliases')) LIKE lower(concat('%', :query, '%'))
        )
        """;

    /**
     * Who takes part in published competitions: {@code collection} is the part of a snapshot to read, teams, players or
     * people. Each stands once, as the newest competition names it, those seen last first. The rows of the page are
     * chosen before their team and roles are looked up, which reads the whole snapshot of each. Native: unfolds the maps
     * of the jsonb published snapshots.
     */
    @Query(value = PARTICIPANTS + """
        , chosen AS (
          SELECT * FROM participant
           ORDER BY starts_on DESC NULLS LAST, competitions DESC, label, id
           LIMIT :size OFFSET :start
        )
        SELECT CAST(s.id AS uuid) AS id, CAST(s.content AS text) AS content, s.competitions AS competitions,
               s.competition AS competitionId, p.published_snapshot #>> '{tournament,name}' AS competitionName,
               CAST(side.team_id AS uuid) AS teamId,
               CAST(p.published_snapshot -> 'teams' -> side.team_id AS text) AS team, done.roles AS roles
          FROM chosen s
          JOIN tournament.competition_plan p ON p.id = s.competition
          LEFT JOIN LATERAL (
            SELECT line.value->>'teamId' AS team_id
              FROM jsonb_array_elements(coalesce(p.published_snapshot -> 'rosters', '[]')
                                        || coalesce(p.published_snapshot #> '{tournament,staff}', '[]')) line
             WHERE s.id IN (line.value->>'playerId', line.value->>'pageId') LIMIT 1
          ) side ON true
          LEFT JOIN LATERAL (
            SELECT string_agg(DISTINCT line.value->>'role', ',') AS roles
              FROM (SELECT l.value FROM jsonb_array_elements(coalesce(p.published_snapshot #> '{tournament,staff}', '[]')
                                        || coalesce(p.published_snapshot #> '{tournament,broadcast}', '[]')) l
                    UNION ALL
                    SELECT l.value FROM jsonb_each(coalesce(p.published_snapshot -> 'series', '{}')) match,
                           jsonb_array_elements(coalesce(match.value -> 'broadcast', '[]')) l) line
             WHERE line.value->>'pageId' = s.id
          ) done ON :collection = 'people'
         ORDER BY s.starts_on DESC NULLS LAST, s.competitions DESC, s.label, s.id
        """, nativeQuery = true)
    List<ParticipantRow> participants(String collection, String query, String country, int size, long start);

    /** How many {@link #participants} finds in all. Native: unfolds the maps of the jsonb published snapshots. */
    @Query(value = PARTICIPANTS + "SELECT count(*) FROM participant", nativeQuery = true)
    long countParticipants(String collection, String query, String country);

    /** Native for the jsonb counts. A tournament in the trash takes its plan with it. */
    @Query(value = """
        SELECT p.id AS id,
               jsonb_array_length(coalesce(p.content->'entrants', '[]')) AS entrants,
               jsonb_array_length(coalesce(p.content->'matches', '[]')) AS matches,
               p.published_at AS publishedAt,
               p.content->>'circuit' AS circuit,
               p.circuit_page_id AS circuitPageId
          FROM tournament.competition_plan p
          JOIN tournament.tournament t ON t.id = p.id
         WHERE t.deleted_at IS NULL
         ORDER BY p.id
        """, nativeQuery = true)
    List<IndexRow> index();

    /**
     * The seasons of an organizer or circuit, in the order of the tournament list. A tournament in the trash takes its
     * plan with it. A part of a main event is a season of a page only when its main event is not one already: a
     * qualifier run by the same organizer comes with its main event instead of standing beside it. Native: orders by
     * the recency views of V013 and V016, which PostgreSQL functions compute.
     */
    @Query(value = """
        SELECT p.* FROM tournament.competition_plan p
          JOIN tournament.tournament t ON t.id = p.id
          JOIN tournament.tournament_window w ON w.id = p.id
          LEFT JOIN tournament.event_window e ON e.id = p.id
          LEFT JOIN tournament.competition_plan main ON main.id = t.parent_id
        WHERE t.deleted_at IS NULL
          AND (:organizer = '' OR (p.organizer_page_id = CAST(NULLIF(:organizer, '') AS uuid)
                                   AND p.organizer_page_id IS DISTINCT FROM main.organizer_page_id))
          AND (:circuit = '' OR (p.circuit_page_id = CAST(NULLIF(:circuit, '') AS uuid)
                                 AND p.circuit_page_id IS DISTINCT FROM main.circuit_page_id))
        ORDER BY CASE WHEN e.id IS NULL THEN w.recency_rank ELSE e.recency_rank END,
                 CASE WHEN e.id IS NULL THEN w.recency_distance ELSE e.recency_distance END,
                 lower(t.name), p.id
        """, countQuery = """
        SELECT count(*) FROM tournament.competition_plan p
          JOIN tournament.tournament t ON t.id = p.id
          LEFT JOIN tournament.competition_plan main ON main.id = t.parent_id
        WHERE t.deleted_at IS NULL
          AND (:organizer = '' OR (p.organizer_page_id = CAST(NULLIF(:organizer, '') AS uuid)
                                   AND p.organizer_page_id IS DISTINCT FROM main.organizer_page_id))
          AND (:circuit = '' OR (p.circuit_page_id = CAST(NULLIF(:circuit, '') AS uuid)
                                 AND p.circuit_page_id IS DISTINCT FROM main.circuit_page_id))
        """, nativeQuery = true)
    Page<CompetitionPlanRecord> summaries(String organizer, String circuit, Pageable pageable);

    Page<CompetitionPlanRecord> findByPublishedAtIsNotNullOrderByPublishedAtDesc(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from CompetitionPlanRecord p where p.id = :id")
    Optional<CompetitionPlanRecord> lock(UUID id);

    /** Native for the jsonb path over the entrants. */
    @Query(value = "select count(*) from tournament.competition_plan p where jsonb_path_exists(p.content, '$.entrants[*] ? (@.teamId == $id)', jsonb_build_object('id', cast(:id as text)))", nativeQuery = true)
    long countTeamReferences(String id);

    /**
     * Plans and plan history that name a record. The plan of the record's own tournament (its series, games and roster
     * rows belong to it too) is left out while it has never been published: such a draft is part of the tournament and
     * goes to the trash with it. Once published or withdrawn ({@code publicActions} names the revision actions that say
     * so), the plan and its history keep protecting the record. The plans and history of tournaments in the trash are
     * counted only when {@code includeTrash} asks for them. Native: looks for the id in the text of the jsonb
     * documents.
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
                            WHERE r.tournament_id = p.id AND r.action IN (:publicActions))
        ), trashed AS (
          SELECT t.id FROM tournament.tournament t WHERE t.deleted_at IS NOT NULL AND NOT :includeTrash
        )
        SELECT (SELECT count(*) FROM tournament.competition_plan p
                WHERE p.id NOT IN (SELECT id FROM own_draft) AND p.id NOT IN (SELECT id FROM trashed)
                  AND (CAST(p.id AS text) = :id OR CAST(p.content AS text) LIKE concat('%', :id, '%')
                       OR CAST(p.published_snapshot AS text) LIKE concat('%', :id, '%')))
             + (SELECT count(*) FROM tournament.plan_revision r
                WHERE r.tournament_id NOT IN (SELECT id FROM own_draft)
                  AND r.tournament_id NOT IN (SELECT id FROM trashed)
                  AND CAST(r.content AS text) LIKE concat('%', :id, '%'))
        """, nativeQuery = true)
    long countReferences(String kind, String id, Collection<String> publicActions, boolean includeTrash);

    /** Native: looks for the image path in the text of the jsonb documents. */
    @Query(value = "select (select count(*) from tournament.competition_plan where cast(published_snapshot as text) like concat('%/', :id, '/%')) + (select count(*) from tournament.plan_revision where cast(content as text) like concat('%/', :id, '/%'))", nativeQuery = true)
    long countMedia(String id);

    /** Native: finds image paths in the jsonb documents with a PostgreSQL regular expression. */
    @Query(value = """
        SELECT pairs.asset FROM (
        SELECT DISTINCT found.owner, lower(m[2]) AS asset FROM (
            SELECT id AS owner, published_snapshot AS body FROM tournament.competition_plan
            UNION ALL SELECT id, content FROM tournament.plan_revision
        ) found, LATERAL regexp_matches(CAST(found.body AS text), '/(assets|media)/([0-9a-fA-F-]{36})/', 'g') m
        ) pairs
        """, nativeQuery = true)
    List<String> allMedia();

    /** Native: filters by ids inside the jsonb published snapshot. */
    @Query(value = """
        SELECT * FROM tournament.competition_plan WHERE published_at IS NOT NULL
          AND (:team = '' OR jsonb_exists(published_snapshot->'teams', :team))
          AND (:player = '' OR jsonb_exists(published_snapshot->'players', :player))
          AND (:person = '' OR jsonb_exists(published_snapshot->'people', :person))
          AND (:organizer = '' OR published_snapshot->'plan'->>'organizerPageId' = :organizer)
          AND (:circuit = '' OR published_snapshot->'plan'->>'circuitPageId' = :circuit)
        ORDER BY published_at DESC, id
        """, nativeQuery = true)
    Page<CompetitionPlanRecord> published(String team, String player, String person, String organizer, String circuit,
            Pageable pageable);

    /**
     * The same competitions without series, rosters, players and people, which make up two thirds of a snapshot. Native:
     * filters and cuts the jsonb published snapshot.
     */
    @Query(value = """
        SELECT id AS id, published_at AS publishedAt,
               CAST(published_snapshot || jsonb_build_object('series', jsonb_build_object(), 'players',
                   jsonb_build_object(), 'people', jsonb_build_object(), 'rosters', jsonb_build_array()) AS text)
                   AS snapshot
          FROM tournament.competition_plan
         WHERE published_at IS NOT NULL
           AND (:team = '' OR jsonb_exists(published_snapshot->'teams', :team))
           AND (:player = '' OR jsonb_exists(published_snapshot->'players', :player))
          AND (:person = '' OR jsonb_exists(published_snapshot->'people', :person))
           AND (:organizer = '' OR published_snapshot->'plan'->>'organizerPageId' = :organizer)
           AND (:circuit = '' OR published_snapshot->'plan'->>'circuitPageId' = :circuit)
         ORDER BY published_at DESC, id
        """, countQuery = """
        SELECT count(*) FROM tournament.competition_plan WHERE published_at IS NOT NULL
          AND (:team = '' OR jsonb_exists(published_snapshot->'teams', :team))
          AND (:player = '' OR jsonb_exists(published_snapshot->'players', :player))
          AND (:person = '' OR jsonb_exists(published_snapshot->'people', :person))
          AND (:organizer = '' OR published_snapshot->'plan'->>'organizerPageId' = :organizer)
          AND (:circuit = '' OR published_snapshot->'plan'->>'circuitPageId' = :circuit)
        """, nativeQuery = true)
    Page<ListedRow> listed(String team, String player, String person, String organizer, String circuit,
            Pageable pageable);
}
