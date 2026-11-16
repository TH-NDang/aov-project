-- A tournament can be a part of a main event: its qualifier, wildcard, weekly stop or show match (spec 04). The link
-- lives in the document; the column lets a list keep to main events and find the parts of one without opening documents.
ALTER TABLE tournament.tournament
    ADD COLUMN parent_id uuid GENERATED ALWAYS AS ((content ->> 'parentTournamentId')::uuid) STORED;

CREATE INDEX tournament_parent ON tournament.tournament (parent_id) WHERE parent_id IS NOT NULL;

-- A main event's place in time counts its parts: a qualifier in progress brings its main event forward even while the
-- main event itself is months away. The member closest to today stands for the whole event.
CREATE VIEW tournament.event_window AS
WITH member AS (
    SELECT id AS event_id, id FROM tournament.tournament WHERE parent_id IS NULL AND deleted_at IS NULL
    UNION ALL
    SELECT parent_id, id FROM tournament.tournament WHERE parent_id IS NOT NULL AND deleted_at IS NULL
)
SELECT m.event_id AS id,
       (array_agg(w.recency_rank ORDER BY w.recency_rank, w.recency_distance NULLS LAST, m.id))[1] AS recency_rank,
       (array_agg(w.recency_distance ORDER BY w.recency_rank, w.recency_distance NULLS LAST, m.id))[1] AS recency_distance
  FROM member m
  JOIN tournament.tournament_window w ON w.id = m.id
 GROUP BY m.event_id;
