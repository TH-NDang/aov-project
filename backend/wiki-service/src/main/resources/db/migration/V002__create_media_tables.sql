-- Media module (01 section 12-13, 02 section 14-18).
-- Bytes live in object storage; these tables hold metadata and object keys only.
-- lock_version is the optimistic lock column (JPA @Version), exposed to clients as "version".

CREATE TABLE media.media_asset (
    id                 UUID         PRIMARY KEY,
    semantic_type      VARCHAR(64)  NOT NULL,
    lifecycle_state    VARCHAR(16)  NOT NULL CHECK (lifecycle_state IN ('ACTIVE', 'DEPRECATED', 'BLOCKED')),
    current_version_id UUID         NULL,
    last_version_no    BIGINT       NOT NULL CHECK (last_version_no >= 0),
    lock_version       BIGINT       NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL,
    created_by_issuer  TEXT         NOT NULL,
    created_by_subject TEXT         NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL
);

CREATE INDEX ix_media_asset_semantic_type ON media.media_asset (semantic_type, created_at DESC);

CREATE TABLE media.media_asset_version (
    id                    UUID         PRIMARY KEY,
    asset_id              UUID         NOT NULL REFERENCES media.media_asset (id),
    version_no            BIGINT       NOT NULL CHECK (version_no > 0),
    state                 VARCHAR(16)  NOT NULL CHECK (state IN ('READY', 'DEPRECATED', 'BLOCKED')),
    storage_alias         VARCHAR(64)  NOT NULL,
    object_key            TEXT         NOT NULL,
    object_version        TEXT         NULL,
    sha256                VARCHAR(64)  NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    mime_type             VARCHAR(64)  NOT NULL,
    width                 INTEGER      NOT NULL CHECK (width > 0),
    height                INTEGER      NOT NULL CHECK (height > 0),
    size_bytes            BIGINT       NOT NULL CHECK (size_bytes > 0),
    activated_at          TIMESTAMPTZ  NULL,
    supersedes_version_id UUID         NULL REFERENCES media.media_asset_version (id),
    lock_version          BIGINT       NOT NULL,
    created_at            TIMESTAMPTZ  NOT NULL,
    created_by_issuer     TEXT         NOT NULL,
    created_by_subject    TEXT         NOT NULL,
    CONSTRAINT uq_media_asset_version_no UNIQUE (asset_id, version_no),
    -- The same bytes are stored once per asset; re-uploading them returns the existing version.
    CONSTRAINT uq_media_asset_version_sha256 UNIQUE (asset_id, sha256),
    CONSTRAINT uq_media_asset_version_object UNIQUE (storage_alias, object_key),
    -- Target of the composite foreign key below.
    CONSTRAINT uq_media_asset_version_asset UNIQUE (id, asset_id)
);

-- The current version must be a version of the same asset.
ALTER TABLE media.media_asset
    ADD CONSTRAINT fk_media_asset_current_version
    FOREIGN KEY (current_version_id, id) REFERENCES media.media_asset_version (id, asset_id);

CREATE TABLE media.media_upload_session (
    id                    UUID         PRIMARY KEY,
    asset_id              UUID         NOT NULL REFERENCES media.media_asset (id),
    state                 VARCHAR(16)  NOT NULL
                          CHECK (state IN ('REQUESTED', 'VALIDATING', 'READY', 'REJECTED', 'EXPIRED')),
    object_key            TEXT         NOT NULL UNIQUE,
    file_name             VARCHAR(255) NULL,
    declared_mime_type    VARCHAR(64)  NOT NULL,
    declared_size_bytes   BIGINT       NOT NULL CHECK (declared_size_bytes > 0),
    expires_at            TIMESTAMPTZ  NOT NULL,
    validation_started_at TIMESTAMPTZ  NULL,
    completed_at          TIMESTAMPTZ  NULL,
    error_code            VARCHAR(64)  NULL,
    version_id            UUID         NULL REFERENCES media.media_asset_version (id),
    lock_version          BIGINT       NOT NULL,
    created_at            TIMESTAMPTZ  NOT NULL,
    created_by_issuer     TEXT         NOT NULL,
    created_by_subject    TEXT         NOT NULL
);

CREATE INDEX ix_media_upload_session_asset ON media.media_upload_session (asset_id, created_at DESC);

CREATE TABLE media.media_provenance (
    id               UUID         PRIMARY KEY,
    asset_id         UUID         NOT NULL REFERENCES media.media_asset (id),
    asset_version_id UUID         NULL REFERENCES media.media_asset_version (id),
    source_type      VARCHAR(32)  NOT NULL CHECK (source_type IN ('OFFICIAL', 'GAME_CLIENT', 'COMMUNITY', 'OTHER')),
    source_label     TEXT         NOT NULL,
    source_url       TEXT         NULL,
    observed_at      TIMESTAMPTZ  NULL,
    note             TEXT         NULL,
    created_at       TIMESTAMPTZ  NOT NULL
);

CREATE INDEX ix_media_provenance_asset ON media.media_provenance (asset_id);
