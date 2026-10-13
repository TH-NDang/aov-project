CREATE SCHEMA IF NOT EXISTS user_profile;

CREATE TABLE user_profile.profile (
    id UUID PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    biography VARCHAR(1000) NOT NULL DEFAULT '',
    locale VARCHAR(35) NOT NULL,
    time_zone VARCHAR(64) NOT NULL,
    avatar_asset_id UUID,
    version BIGINT NOT NULL CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (issuer, subject)
);
CREATE INDEX ix_user_profile_avatar ON user_profile.profile (avatar_asset_id) WHERE avatar_asset_id IS NOT NULL;
CREATE INDEX ix_user_profile_created ON user_profile.profile (created_at DESC, id);
