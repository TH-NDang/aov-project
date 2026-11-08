-- Game mode catalog, the auto-chess guide and lineup interactions (ADR-023). The schema exists since V000.
CREATE TABLE gamemode.game_mode (
    id UUID PRIMARY KEY,
    code VARCHAR(120) NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_issuer VARCHAR(255) NOT NULL,
    created_by_subject VARCHAR(255) NOT NULL
);

CREATE TABLE gamemode.game_mode_revision (
    id UUID PRIMARY KEY,
    mode_id UUID NOT NULL REFERENCES gamemode.game_mode (id),
    revision_no BIGINT NOT NULL CHECK (revision_no > 0),
    state VARCHAR(16) NOT NULL CHECK (state IN ('DRAFT', 'PUBLISHED', 'DISCARDED')),
    version BIGINT NOT NULL CHECK (version > 0),
    content JSONB NOT NULL,
    source_revision_id UUID REFERENCES gamemode.game_mode_revision (id),
    change_note VARCHAR(4000),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_issuer VARCHAR(255) NOT NULL,
    created_by_subject VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by_issuer VARCHAR(255) NOT NULL,
    updated_by_subject VARCHAR(255) NOT NULL,
    CONSTRAINT game_mode_revision_number UNIQUE (mode_id, revision_no),
    CONSTRAINT game_mode_revision_published_at CHECK ((state = 'PUBLISHED') = (published_at IS NOT NULL))
);

CREATE UNIQUE INDEX game_mode_revision_one_draft ON gamemode.game_mode_revision (mode_id) WHERE state = 'DRAFT';
CREATE INDEX game_mode_revision_published_idx ON gamemode.game_mode_revision (mode_id, state, published_at DESC);

CREATE TABLE gamemode.auto_chess_revision (
    id UUID PRIMARY KEY,
    mode_id UUID NOT NULL REFERENCES gamemode.game_mode (id),
    revision_no BIGINT NOT NULL CHECK (revision_no > 0),
    state VARCHAR(16) NOT NULL CHECK (state IN ('DRAFT', 'PUBLISHED', 'DISCARDED')),
    version BIGINT NOT NULL CHECK (version > 0),
    content JSONB NOT NULL,
    source_revision_id UUID REFERENCES gamemode.auto_chess_revision (id),
    change_note VARCHAR(4000),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_issuer VARCHAR(255) NOT NULL,
    created_by_subject VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by_issuer VARCHAR(255) NOT NULL,
    updated_by_subject VARCHAR(255) NOT NULL,
    CONSTRAINT auto_chess_revision_number UNIQUE (mode_id, revision_no),
    CONSTRAINT auto_chess_revision_published_at CHECK ((state = 'PUBLISHED') = (published_at IS NOT NULL))
);

CREATE UNIQUE INDEX auto_chess_revision_one_draft ON gamemode.auto_chess_revision (mode_id) WHERE state = 'DRAFT';
CREATE INDEX auto_chess_revision_published_idx ON gamemode.auto_chess_revision (mode_id, state, published_at DESC);

CREATE TABLE gamemode.community_lineup (
    id UUID PRIMARY KEY,
    mode_id UUID NOT NULL REFERENCES gamemode.game_mode (id),
    author_issuer VARCHAR(255) NOT NULL,
    author_subject VARCHAR(255) NOT NULL,
    name VARCHAR(60) NOT NULL CHECK (length(btrim(name)) > 0),
    note VARCHAR(280),
    units JSONB NOT NULL,
    emblems JSONB NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('VISIBLE', 'HIDDEN')),
    hidden_reason VARCHAR(500),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT community_lineup_hidden_reason CHECK (status = 'HIDDEN' OR hidden_reason IS NULL)
);

CREATE INDEX community_lineup_public_idx ON gamemode.community_lineup (mode_id, status, updated_at DESC);
CREATE INDEX community_lineup_author_idx ON gamemode.community_lineup (mode_id, author_issuer, author_subject);

-- Editorial lineup ids live inside the published guide content, so lineup_id has no foreign key.
CREATE TABLE gamemode.lineup_like (
    lineup_id UUID NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    mode_id UUID NOT NULL REFERENCES gamemode.game_mode (id),
    lineup_source VARCHAR(16) NOT NULL CHECK (lineup_source IN ('EDITORIAL', 'COMMUNITY')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (lineup_id, issuer, subject)
);

CREATE INDEX lineup_like_mode_lineup_idx ON gamemode.lineup_like (mode_id, lineup_id);
CREATE INDEX lineup_like_mode_recent_idx ON gamemode.lineup_like (mode_id, created_at);
