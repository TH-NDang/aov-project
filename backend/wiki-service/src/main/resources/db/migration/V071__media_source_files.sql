-- Private source files (ADR-030): evidence captures and import data kept in the private bucket under
-- sources/<sha256>. Bytes are stored once per SHA-256; collections place them at relative paths.
CREATE TABLE media.source_object (
    sha256 VARCHAR(64) PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    object_key TEXT NOT NULL UNIQUE CHECK (object_key = 'sources/' || sha256),
    storage_alias VARCHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    content_type VARCHAR(64) NOT NULL,
    first_path TEXT NOT NULL CHECK (length(first_path) BETWEEN 1 AND 512),
    state VARCHAR(16) NOT NULL CHECK (state IN ('READY', 'DELETING')),
    created_at TIMESTAMPTZ NOT NULL,
    created_by_issuer TEXT NOT NULL,
    created_by_subject TEXT NOT NULL
);

CREATE INDEX ix_source_object_created ON media.source_object (created_at);

CREATE TABLE media.source_collection (
    id UUID PRIMARY KEY,
    code VARCHAR(120) NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    category VARCHAR(32) NOT NULL CHECK (category IN ('HERO_CAPTURE', 'SHOP_CAPTURE', 'BUILD_CAPTURE',
        'RANKING_CAPTURE', 'GAME_MODE_SOURCE', 'ESPORTS_SOURCE', 'IMPORT_DATA', 'ARCHIVE')),
    label VARCHAR(200) NOT NULL CHECK (length(btrim(label)) > 0),
    note VARCHAR(2000),
    captured_on DATE,
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by_issuer TEXT NOT NULL,
    created_by_subject TEXT NOT NULL
);

CREATE INDEX ix_source_collection_browse
    ON media.source_collection (category, captured_on DESC NULLS LAST, code);

CREATE TABLE media.source_file (
    id UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES media.source_collection (id) ON DELETE CASCADE,
    path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 512),
    sha256 VARCHAR(64) NOT NULL REFERENCES media.source_object (sha256),
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by_issuer TEXT NOT NULL,
    created_by_subject TEXT NOT NULL,
    UNIQUE (collection_id, path)
);

CREATE INDEX ix_source_file_sha256 ON media.source_file (sha256);

CREATE TABLE media.source_upload_session (
    id UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES media.source_collection (id) ON DELETE CASCADE,
    path TEXT NOT NULL CHECK (length(path) BETWEEN 1 AND 512),
    replace_file_id UUID,
    replace_expected_version BIGINT,
    declared_sha256 VARCHAR(64) NOT NULL CHECK (declared_sha256 ~ '^[0-9a-f]{64}$'),
    declared_size_bytes BIGINT NOT NULL CHECK (declared_size_bytes >= 0),
    content_type VARCHAR(64) NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    state VARCHAR(16) NOT NULL CHECK (state IN ('REQUESTED', 'VALIDATING', 'READY', 'REJECTED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    validation_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_code VARCHAR(64),
    file_id UUID,
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    created_by_issuer TEXT NOT NULL,
    created_by_subject TEXT NOT NULL,
    CHECK ((replace_file_id IS NULL) = (replace_expected_version IS NULL))
);

CREATE INDEX ix_source_upload_open ON media.source_upload_session (state, expires_at);

-- Listed in 02 section 38 but never created: estimates and lookups by content need it.
CREATE INDEX ix_media_asset_version_sha256 ON media.media_asset_version (sha256);
