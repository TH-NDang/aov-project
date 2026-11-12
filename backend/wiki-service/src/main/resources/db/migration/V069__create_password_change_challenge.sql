-- One-time email codes that confirm a password change in the identity provider (ADR-024).
-- Only a hash of the code is stored; passwords, emails and tokens never reach this table.
CREATE TABLE user_profile.password_change_challenge (
    id UUID PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    code_hash BYTEA NOT NULL CHECK (octet_length(code_hash) = 32),
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'APPLYING', 'USED', 'SUPERSEDED', 'FAILED')),
    failed_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
    used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK ((status = 'USED') = (used_at IS NOT NULL))
);

CREATE INDEX ix_password_change_challenge_account
    ON user_profile.password_change_challenge (issuer, subject, created_at DESC);
CREATE INDEX ix_password_change_challenge_expiry
    ON user_profile.password_change_challenge (expires_at);
