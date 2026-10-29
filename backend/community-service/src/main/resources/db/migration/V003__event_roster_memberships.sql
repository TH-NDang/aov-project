CREATE TABLE tournament.roster_membership (
    id uuid PRIMARY KEY,
    version bigint NOT NULL,
    tournament_id uuid NOT NULL REFERENCES tournament.tournament(id),
    team_id uuid NOT NULL REFERENCES tournament.team(id),
    player_id uuid NOT NULL REFERENCES tournament.player(id),
    content jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    edited_by varchar(1000) NOT NULL,
    UNIQUE (tournament_id, team_id, player_id)
);
CREATE INDEX roster_membership_tournament_team ON tournament.roster_membership(tournament_id,team_id,updated_at DESC,id);
CREATE INDEX roster_membership_player ON tournament.roster_membership(player_id,updated_at DESC,id);
CREATE INDEX roster_membership_team ON tournament.roster_membership(team_id,updated_at DESC,id);

DROP INDEX tournament.player_reference_search_idx;
ALTER TABLE tournament.player DROP COLUMN reference_search;
ALTER TABLE tournament.player ADD COLUMN reference_search text GENERATED ALWAYS AS (
    tournament.normalize_reference_search(
        coalesce(name, '') || ' ' || code || ' ' || tournament.reference_alias_text(content->'aliases')
    )
) STORED;
CREATE INDEX player_reference_search_idx ON tournament.player USING gin (reference_search public.gin_trgm_ops);
