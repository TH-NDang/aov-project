-- Videos attached to catalog subjects (ADR-019). Subjects live in other modules, so there are no foreign keys:
-- the owning module confirms a subject through VideoSubjectProvider when a row is written.
CREATE SCHEMA video;

CREATE TABLE video.subject_video (
    id UUID PRIMARY KEY,
    subject_kind VARCHAR(16) NOT NULL
        CHECK (subject_kind IN ('HERO', 'SKILL', 'SKIN', 'ITEM', 'ENCHANTMENT', 'ARCANA', 'SPELL')),
    subject_id UUID NOT NULL,
    subject_key VARCHAR(160),
    purpose VARCHAR(24) NOT NULL
        CHECK (purpose IN ('INTRO', 'GUIDE_BASIC', 'GUIDE_ADVANCED', 'SKILL_DEMO', 'SKIN_SHOWCASE', 'SKIN_TRAILER',
                           'LORE', 'PATCH_CHANGE', 'OTHER')),
    title VARCHAR(300) NOT NULL CHECK (length(btrim(title)) > 0),
    note VARCHAR(1000),
    url VARCHAR(2048) NOT NULL,
    provider VARCHAR(16) NOT NULL CHECK (provider IN ('YOUTUBE', 'FACEBOOK', 'TIKTOK', 'TWITCH', 'OTHER')),
    provider_video_id VARCHAR(64),
    start_seconds INTEGER NOT NULL DEFAULT 0 CHECK (start_seconds >= 0),
    duration_seconds INTEGER CHECK (duration_seconds > 0),
    channel_name VARCHAR(120),
    published_on DATE,
    patch_variant_id UUID,
    display_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PUBLISHED', 'DRAFT', 'HIDDEN')),
    origin VARCHAR(16) NOT NULL CHECK (origin IN ('MANUAL', 'IMPORT')),
    version BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT subject_video_key_matches_kind CHECK ((subject_kind IN ('SKILL', 'SKIN')) = (subject_key IS NOT NULL)),
    -- The same long video may be attached twice from different start points.
    CONSTRAINT subject_video_unique UNIQUE NULLS NOT DISTINCT (subject_kind, subject_id, subject_key, url, start_seconds)
);

CREATE INDEX subject_video_public_idx ON video.subject_video (subject_id, status, display_order);
CREATE INDEX subject_video_review_idx ON video.subject_video (status, updated_at DESC);
