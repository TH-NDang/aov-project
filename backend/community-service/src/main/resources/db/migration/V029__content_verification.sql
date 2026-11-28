-- The owner's own check of a tournament's data in Admin (spec 04, tournament data verification, 28/11/2026). Most of it
-- was imported or read by AI, so a row says that one version of one part of the tournament was checked by hand, by whom
-- and when. A part is a step of the tournament workspace: its information, one team, the format, the matches of one
-- stage or the final standings. The version is a token Admin derives from what it showed; any change makes a new token,
-- so the part reads as changed since it was checked until someone checks it again. Neither Stream nor the public API
-- reads this table, and it is not part of a published snapshot.
CREATE TABLE tournament.content_verification (
    id uuid PRIMARY KEY,
    version bigint NOT NULL,
    tournament_id uuid NOT NULL REFERENCES tournament.tournament (id),
    part varchar(80) NOT NULL CHECK (part ~ '^(INFO|FORMAT|FINAL|TEAM:[0-9a-f-]{36}|SCHEDULE:[A-Z0-9_]{2,60})$'),
    content_token varchar(128) NOT NULL CHECK (content_token ~ '^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$'),
    label varchar(200),
    note varchar(1000),
    verified_at timestamptz NOT NULL,
    verified_by varchar(1000) NOT NULL,
    verified_by_name varchar(200),
    UNIQUE (tournament_id, part, content_token)
);

CREATE INDEX content_verification_tournament ON tournament.content_verification (tournament_id, verified_at DESC);
