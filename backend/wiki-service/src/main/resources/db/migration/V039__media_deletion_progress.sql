ALTER TABLE media.media_asset ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE TABLE media.media_deletion (
    asset_id UUID PRIMARY KEY REFERENCES media.media_asset(id),
    expected_version BIGINT NOT NULL,
    object_keys JSONB NOT NULL,
    public_urls JSONB NOT NULL,
    state VARCHAR(32) NOT NULL CHECK (state IN ('PREPARED', 'ORIGIN_DELETED', 'COMPLETE')),
    last_error VARCHAR(100),
    lease_until TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    lock_version BIGINT NOT NULL
);
