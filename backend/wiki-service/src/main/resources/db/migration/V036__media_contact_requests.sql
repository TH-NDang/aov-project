CREATE TABLE media.media_contact_request (
    id UUID PRIMARY KEY,
    asset_id UUID REFERENCES media.media_asset(id),
    version_id UUID REFERENCES media.media_asset_version(id),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(254) NOT NULL,
    topic VARCHAR(32) NOT NULL,
    message VARCHAR(4000) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    CHECK ((asset_id IS NULL) = (version_id IS NULL)),
    FOREIGN KEY (version_id, asset_id) REFERENCES media.media_asset_version(id, asset_id),
    CHECK (topic IN ('SOURCE', 'RIGHTS', 'OTHER')),
    CHECK (status IN ('OPEN', 'RESOLVED'))
);
CREATE INDEX media_contact_request_created_idx ON media.media_contact_request(created_at DESC);
