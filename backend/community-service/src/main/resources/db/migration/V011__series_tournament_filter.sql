-- Lets the Admin load one tournament's matches instead of every match.
ALTER TABLE tournament.series
    ADD COLUMN tournament_id uuid GENERATED ALWAYS AS ((content ->> 'tournamentId')::uuid) STORED;

CREATE INDEX series_tournament ON tournament.series (tournament_id, deleted_at);
