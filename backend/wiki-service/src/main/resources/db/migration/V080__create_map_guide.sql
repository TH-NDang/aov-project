-- Battlefield map of a game mode: objects, lanes and match tempo as one JSON snapshot per revision, with the same
-- draft and publication workflow as the auto-chess guide (spec 01, game modes section).
CREATE TABLE gamemode.map_guide_revision (
    id UUID PRIMARY KEY,
    mode_id UUID NOT NULL REFERENCES gamemode.game_mode (id),
    revision_no BIGINT NOT NULL CHECK (revision_no > 0),
    state VARCHAR(16) NOT NULL CHECK (state IN ('DRAFT', 'PUBLISHED', 'DISCARDED')),
    version BIGINT NOT NULL CHECK (version > 0),
    content JSONB NOT NULL,
    source_revision_id UUID REFERENCES gamemode.map_guide_revision (id),
    change_note VARCHAR(4000),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_issuer VARCHAR(255) NOT NULL,
    created_by_subject VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_by_issuer VARCHAR(255) NOT NULL,
    updated_by_subject VARCHAR(255) NOT NULL,
    CONSTRAINT map_guide_revision_number UNIQUE (mode_id, revision_no),
    CONSTRAINT map_guide_revision_published_at CHECK ((state = 'PUBLISHED') = (published_at IS NOT NULL))
);

CREATE UNIQUE INDEX map_guide_revision_one_draft ON gamemode.map_guide_revision (mode_id) WHERE state = 'DRAFT';
CREATE INDEX map_guide_revision_published_idx ON gamemode.map_guide_revision (mode_id, state, published_at DESC);
