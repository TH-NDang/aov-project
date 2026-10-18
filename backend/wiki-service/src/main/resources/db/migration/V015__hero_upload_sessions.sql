CREATE TABLE hero.upload_session (
    id uuid PRIMARY KEY,
    owner_issuer text NOT NULL,
    owner_subject text NOT NULL,
    state_json text NOT NULL,
    version bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL
);
CREATE INDEX upload_session_owner ON hero.upload_session(owner_issuer, owner_subject, updated_at DESC);
