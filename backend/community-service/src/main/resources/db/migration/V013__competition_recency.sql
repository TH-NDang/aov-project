-- Recency of competition results: the rules are written down in spec 04.
-- Dates and names become typed columns so ranking never has to open a document, and the ranking rules live here, next
-- to them, because every list and picker orders by them. Nothing is stored that could drift: the columns are generated
-- from the documents and the views are read when asked, so "today" is always today.

-- Documents hold a LocalDate as [year, month, day] and an Instant as epoch seconds. The text forms are what the same
-- values look like if the JSON mapper is ever set to ISO dates; a column must not silently turn empty then.
CREATE FUNCTION tournament.document_date(value jsonb) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT CASE jsonb_typeof(value)
        WHEN 'array' THEN make_date(CAST(value ->> 0 AS int), CAST(value ->> 1 AS int), CAST(value ->> 2 AS int))
        WHEN 'string' THEN make_date(CAST(substr(value #>> '{}', 1, 4) AS int),
                                     CAST(substr(value #>> '{}', 6, 2) AS int),
                                     CAST(substr(value #>> '{}', 9, 2) AS int))
    END;
$function$;

CREATE FUNCTION tournament.document_instant(value jsonb) RETURNS timestamptz
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT CASE jsonb_typeof(value)
        WHEN 'number' THEN to_timestamp(CAST(value #>> '{}' AS double precision))
        WHEN 'string' THEN CAST(value #>> '{}' AS timestamptz)
    END;
$function$;

CREATE FUNCTION tournament.document_ids(value jsonb, field text) RETURNS uuid[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT coalesce(array_agg(DISTINCT CAST(entry ->> field AS uuid)) FILTER (WHERE entry ->> field IS NOT NULL), '{}')
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(value) = 'array' THEN value ELSE '[]'::jsonb END) AS entry;
$function$;

CREATE FUNCTION tournament.alias_array(value jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT coalesce(array_agg(alias), '{}')
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(value) = 'array' THEN value ELSE '[]'::jsonb END) AS entry(alias);
$function$;

-- A name as searches compare it: folded like reference_search, with punctuation between words read as a space.
CREATE FUNCTION tournament.search_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $function$
    SELECT btrim(regexp_replace(
        translate(tournament.normalize_reference_search(value), '-_.·:/()|', '         '), ' +', ' ', 'g'));
$function$;

-- Every name of a record between bars, so that the whole of a name and the start of one can be told apart.
CREATE FUNCTION tournament.search_names(names text[]) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT '|' || coalesce(string_agg(tournament.search_key(name), '|'), '') || '|'
      FROM unnest(names) AS entry(name)
     WHERE name IS NOT NULL;
$function$;

-- 0 the whole of a name, 1 its start, 2 the start of a word inside it, 3 anywhere else. An empty search ranks all alike.
CREATE FUNCTION tournament.name_match_rank(search_key text, search_names text) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT CASE
        WHEN search_key = '' THEN 0
        WHEN position('|' || search_key || '|' IN search_names) > 0 THEN 0
        WHEN position('|' || search_key IN search_names) > 0 THEN 1
        WHEN position(' ' || search_key IN search_names) > 0 THEN 2
        ELSE 3
    END;
$function$;

ALTER TABLE tournament.team
    ADD COLUMN search_names text GENERATED ALWAYS AS (
        tournament.search_names(ARRAY[name, code, content ->> 'shortName'] || tournament.alias_array(content -> 'aliases'))
    ) STORED;

ALTER TABLE tournament.player
    ADD COLUMN search_names text GENERATED ALWAYS AS (
        tournament.search_names(ARRAY[name, code] || tournament.alias_array(content -> 'aliases'))
    ) STORED;

ALTER TABLE tournament.tournament
    ADD COLUMN starts_on date GENERATED ALWAYS AS (tournament.document_date(content -> 'startsOn')) STORED,
    ADD COLUMN ends_on date GENERATED ALWAYS AS (tournament.document_date(content -> 'endsOn')) STORED,
    ADD COLUMN season_year integer GENERATED ALWAYS AS (CAST(content ->> 'year' AS integer)) STORED,
    ADD COLUMN status varchar(20) GENERATED ALWAYS AS (coalesce(content ->> 'status', 'UNKNOWN')) STORED,
    ADD COLUMN placement_team_ids uuid[] GENERATED ALWAYS AS (tournament.document_ids(content -> 'placements', 'teamId')) STORED,
    ADD COLUMN search_names text GENERATED ALWAYS AS (tournament.search_names(ARRAY[name, code])) STORED;

ALTER TABLE tournament.series
    ADD COLUMN scheduled_at timestamptz GENERATED ALWAYS AS (tournament.document_instant(content -> 'scheduledAt')) STORED,
    ADD COLUMN team_a_id uuid GENERATED ALWAYS AS (CAST(content ->> 'teamAId' AS uuid)) STORED,
    ADD COLUMN team_b_id uuid GENERATED ALWAYS AS (CAST(content ->> 'teamBId' AS uuid)) STORED,
    ADD COLUMN decided boolean GENERATED ALWAYS AS (coalesce(jsonb_typeof(content -> 'result') = 'object', false)) STORED,
    ADD COLUMN search_names text GENERATED ALWAYS AS (tournament.search_names(ARRAY[name, code])) STORED;

ALTER TABLE tournament.game
    ADD COLUMN started_at timestamptz GENERATED ALWAYS AS (tournament.document_instant(content -> 'startedAt')) STORED;

ALTER TABLE tournament.roster_membership
    ADD COLUMN status varchar(20) GENERATED ALWAYS AS (coalesce(content ->> 'status', 'UNKNOWN')) STORED,
    ADD COLUMN lane varchar(20) GENERATED ALWAYS AS (content ->> 'lane') STORED;

ALTER TABLE tournament.competition_plan
    ADD COLUMN entrant_team_ids uuid[] GENERATED ALWAYS AS (tournament.document_ids(content -> 'entrants', 'teamId')) STORED,
    ADD COLUMN organizer_page_id uuid GENERATED ALWAYS AS (CAST(content ->> 'organizerPageId' AS uuid)) STORED,
    ADD COLUMN circuit_page_id uuid GENERATED ALWAYS AS (CAST(content ->> 'circuitPageId' AS uuid)) STORED;

CREATE INDEX series_schedule ON tournament.series (tournament_id, scheduled_at, id) WHERE deleted_at IS NULL;
CREATE INDEX series_team_a ON tournament.series (team_a_id, tournament_id) WHERE deleted_at IS NULL;
CREATE INDEX series_team_b ON tournament.series (team_b_id, tournament_id) WHERE deleted_at IS NULL;
CREATE INDEX game_series_started ON tournament.game (series_id, started_at) WHERE deleted_at IS NULL;
CREATE INDEX roster_membership_team_tournament ON tournament.roster_membership (team_id, tournament_id, player_id) WHERE deleted_at IS NULL;
CREATE INDEX competition_plan_organizer ON tournament.competition_plan (organizer_page_id) WHERE organizer_page_id IS NOT NULL;
CREATE INDEX competition_plan_circuit ON tournament.competition_plan (circuit_page_id) WHERE circuit_page_id IS NOT NULL;

-- The first and last day a game of this tournament can count for: its dates, or its year where only that is known.
CREATE FUNCTION tournament.opens_on(starts_on date, ends_on date, season_year integer) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT coalesce(starts_on,
        CASE WHEN coalesce(season_year, CAST(extract(year FROM ends_on) AS int)) BETWEEN 1 AND 9999
             THEN make_date(coalesce(season_year, CAST(extract(year FROM ends_on) AS int)), 1, 1) END);
$function$;

CREATE FUNCTION tournament.closes_on(starts_on date, ends_on date, season_year integer) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT coalesce(ends_on,
        CASE WHEN coalesce(season_year, CAST(extract(year FROM starts_on) AS int)) BETWEEN 1 AND 9999
             THEN make_date(coalesce(season_year, CAST(extract(year FROM starts_on) AS int)), 12, 31) END);
$function$;

-- 0 in progress, 1 starting within 30 days, 2 anything else dated, 3 no date at all. A status only speaks where the
-- dates are silent, or to say that a tournament is over even though its dates are still running.
CREATE FUNCTION tournament.recency_rank(status text, starts_on date, ends_on date, season_year integer, today date) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT CASE
        WHEN starts_on IS NULL AND ends_on IS NULL THEN
            CASE WHEN status = 'ONGOING' THEN 0
                 WHEN status IN ('UPCOMING', 'ANNOUNCED') THEN 1
                 WHEN season_year IS NOT NULL THEN 2
                 ELSE 3 END
        WHEN status = 'FINISHED' THEN 2
        WHEN coalesce(starts_on, ends_on) > today + 30 THEN 2
        WHEN coalesce(starts_on, ends_on) > today THEN 1
        WHEN coalesce(ends_on, starts_on) >= today OR (ends_on IS NULL AND status = 'ONGOING') THEN 0
        ELSE 2
    END;
$function$;

-- How far the tournament sits from today within its rank, in days: in progress by how soon it ends, starting soon by
-- how soon it starts, the rest by distance either way, so a far-future season sits among seasons as far in the past.
CREATE FUNCTION tournament.recency_distance(starts_on date, ends_on date, season_year integer, today date) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT GREATEST(
        coalesce(starts_on, ends_on, tournament.opens_on(starts_on, ends_on, season_year)) - today,
        today - coalesce(ends_on, starts_on, tournament.closes_on(starts_on, ends_on, season_year)),
        CASE WHEN ends_on IS NOT NULL AND coalesce(starts_on, ends_on) <= today THEN ends_on - today ELSE 0 END);
$function$;

-- Each tournament's place in time, worked out once per tournament. entered_on dates taking part without a dated game:
-- the tournament's end, or today while it runs or starts within 30 days.
CREATE VIEW tournament.tournament_window AS
SELECT id, deleted_at, opens_on, closes_on,
       CASE WHEN closes_on IS NULL OR opens_on > CURRENT_DATE + 30 THEN NULL
            ELSE LEAST(closes_on, CURRENT_DATE) END AS entered_on,
       tournament.recency_rank(status, starts_on, ends_on, season_year, CURRENT_DATE) AS recency_rank,
       CASE WHEN opens_on IS NOT NULL THEN tournament.recency_distance(starts_on, ends_on, season_year, CURRENT_DATE) END AS recency_distance
  FROM (SELECT t.*, tournament.opens_on(starts_on, ends_on, season_year) AS opens_on,
               tournament.closes_on(starts_on, ends_on, season_year) AS closes_on
          FROM tournament.tournament t) AS dated;

-- Which teams belong to a tournament: a side of a series, a roster, a final standing or a registration.
CREATE VIEW tournament.tournament_team AS
SELECT tournament_id, team_a_id AS team_id FROM tournament.series WHERE deleted_at IS NULL AND team_a_id IS NOT NULL
UNION ALL
SELECT tournament_id, team_b_id FROM tournament.series WHERE deleted_at IS NULL AND team_b_id IS NOT NULL
UNION ALL
SELECT tournament_id, team_id FROM tournament.roster_membership WHERE deleted_at IS NULL
UNION ALL
SELECT t.id, placed.team_id FROM tournament.tournament t, unnest(t.placement_team_ids) AS placed(team_id)
UNION ALL
SELECT p.id, entered.team_id FROM tournament.competition_plan p, unnest(p.entrant_team_ids) AS entered(team_id);

-- One row per team and tournament, dated by the last game it played there. A date after the tournament's end cannot
-- count (imported data holds series a year late, spec 04), nor can one after today. A date before its start stands:
-- those are real qualifiers, and an early date cannot lift a team anyway. Being in the tournament without a dated game
-- dates the team by entered_on.
CREATE VIEW tournament.team_tournament_activity AS
WITH played AS (
    SELECT side.team_id, s.tournament_id,
           max(CASE WHEN s.decided OR g.series_id IS NOT NULL
                         OR CAST(GREATEST(s.scheduled_at, g.last_started_at) AT TIME ZONE 'UTC' AS date) <= CURRENT_DATE
                    THEN CAST(GREATEST(s.scheduled_at, g.last_started_at) AT TIME ZONE 'UTC' AS date) END) AS last_day
      FROM tournament.series s
      LEFT JOIN (SELECT series_id, max(started_at) AS last_started_at
                   FROM tournament.game WHERE deleted_at IS NULL GROUP BY series_id) g ON g.series_id = s.id
     CROSS JOIN LATERAL (VALUES (s.team_a_id), (s.team_b_id)) AS side(team_id)
     WHERE s.deleted_at IS NULL AND side.team_id IS NOT NULL
     GROUP BY side.team_id, s.tournament_id
), entered AS (
    SELECT DISTINCT team_id, tournament_id FROM tournament.tournament_team
)
SELECT e.team_id, e.tournament_id,
       CASE WHEN p.last_day IS NOT NULL THEN LEAST(p.last_day, w.closes_on, CURRENT_DATE) ELSE w.entered_on END AS active_on
  FROM entered e
  JOIN tournament.tournament_window w ON w.id = e.tournament_id AND w.deleted_at IS NULL
  LEFT JOIN played p ON p.team_id = e.team_id AND p.tournament_id = e.tournament_id;

CREATE VIEW tournament.team_activity AS
SELECT DISTINCT ON (team_id) team_id, tournament_id, active_on
  FROM tournament.team_tournament_activity
 ORDER BY team_id, active_on DESC NULLS LAST, tournament_id;

-- A player takes the date of the team whose roster they were on: only part of the games name their line-up, and every
-- line-up recorded so far also has a roster line. Someone who left that roster only counts up to its first day.
CREATE VIEW tournament.player_tournament_activity AS
SELECT m.player_id, m.team_id, m.tournament_id, m.lane, m.status,
       CASE WHEN m.status = 'INACTIVE' AND w.opens_on < a.active_on THEN w.opens_on ELSE a.active_on END AS active_on
  FROM tournament.roster_membership m
  JOIN tournament.tournament_window w ON w.id = m.tournament_id AND w.deleted_at IS NULL
  JOIN tournament.team_tournament_activity a ON a.team_id = m.team_id AND a.tournament_id = m.tournament_id
 WHERE m.deleted_at IS NULL;

CREATE VIEW tournament.player_activity AS
SELECT DISTINCT ON (player_id) player_id, team_id, tournament_id, active_on
  FROM tournament.player_tournament_activity
 ORDER BY player_id, active_on DESC NULLS LAST, tournament_id;

-- What the community module may read about a page's competition activity; it keeps it from reaching for the tables
-- above. A team or player is found by the identity its page stands for, an organizer or circuit by the page itself.
CREATE VIEW tournament.page_activity AS
SELECT 'TEAM' AS kind, team_id AS key_id, active_on FROM tournament.team_activity
UNION ALL
SELECT 'PLAYER', player_id, active_on FROM tournament.player_activity
UNION ALL
SELECT 'ORGANIZATION', p.organizer_page_id, max(w.entered_on)
  FROM tournament.competition_plan p
  JOIN tournament.tournament_window w ON w.id = p.id AND w.deleted_at IS NULL
 WHERE p.organizer_page_id IS NOT NULL
 GROUP BY p.organizer_page_id
UNION ALL
SELECT 'CIRCUIT', p.circuit_page_id, max(w.entered_on)
  FROM tournament.competition_plan p
  JOIN tournament.tournament_window w ON w.id = p.id AND w.deleted_at IS NULL
 WHERE p.circuit_page_id IS NOT NULL
 GROUP BY p.circuit_page_id;

-- A person has no games of their own; the last dated line of their history stands in for them.
CREATE FUNCTION community.history_last_on(history jsonb) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $function$
    SELECT max(coalesce(tournament.document_date(line -> 'endsOn'), tournament.document_date(line -> 'startsOn')))
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(history) = 'array' THEN history ELSE '[]'::jsonb END) AS line;
$function$;

ALTER TABLE community.page
    ADD COLUMN search_names text GENERATED ALWAYS AS (
        tournament.search_names(ARRAY[content ->> 'name', code, content ->> 'shortName'])
    ) STORED,
    ADD COLUMN history_last_on date GENERATED ALWAYS AS (community.history_last_on(content -> 'history')) STORED;

-- A rewritten table has no statistics for its new columns until enough of it changes, and these lists plan on them.
ANALYZE tournament.team;
ANALYZE tournament.player;
ANALYZE tournament.tournament;
ANALYZE tournament.series;
ANALYZE tournament.game;
ANALYZE tournament.roster_membership;
ANALYZE tournament.competition_plan;
ANALYZE community.page;
