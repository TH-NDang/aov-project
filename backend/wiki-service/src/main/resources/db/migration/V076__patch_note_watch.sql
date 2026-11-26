-- Patch watch (ADR-035): the publishers' patch-note pages are read on a schedule and every post found is kept, so the
-- Admin inbox shows what came out since the last look.

-- One row per source: when it is read (a daily time in Vietnam or every few hours), how the last read went, and the
-- cache validators sent back with the next read.
CREATE TABLE patch.note_source_check (
    source_code VARCHAR(32) PRIMARY KEY,
    schedule_mode VARCHAR(16) NOT NULL DEFAULT 'DAILY' CHECK (schedule_mode IN ('DAILY', 'EVERY_HOURS')),
    daily_at TIME NOT NULL DEFAULT '08:00',
    every_hours INTEGER NOT NULL DEFAULT 6 CHECK (every_hours BETWEEN 1 AND 24),
    paused BOOLEAN NOT NULL DEFAULT false,
    last_checked_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    next_check_at TIMESTAMPTZ NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
    last_failure VARCHAR(32) CHECK (last_failure IN ('UNREACHABLE', 'HTTP_STATUS', 'TOO_LARGE', 'UNREADABLE')),
    last_failure_status INTEGER,
    etag VARCHAR(256),
    last_modified VARCHAR(64),
    schedule_changed_at TIMESTAMPTZ,
    schedule_changed_by_issuer VARCHAR(255),
    schedule_changed_by_subject VARCHAR(255),
    lock_version BIGINT NOT NULL DEFAULT 0
);

-- Every source is read once right after the release, then every morning at 08:00 Vietnam time until an editor
-- changes it.
INSERT INTO patch.note_source_check (source_code, next_check_at)
VALUES ('LIENQUAN_VN', now()), ('ROV_TH', now()), ('MOBA_TW_EXP', now()), ('MOBA_TW', now()), ('GARENA_ID', now());

-- One row per post. The source's own id (post number, slug or guid) keeps a post from being listed twice; a post
-- added by hand uses its link. EARLIER marks posts already old when their source was first read.
CREATE TABLE patch.note_post (
    id UUID PRIMARY KEY,
    source_code VARCHAR(32) NOT NULL,
    external_id VARCHAR(300) NOT NULL,
    region VARCHAR(8) NOT NULL CHECK (region IN ('VN', 'TH', 'TW', 'ID', 'OTHER')),
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('OFFICIAL', 'EXPERIMENTAL')),
    url VARCHAR(1000) NOT NULL,
    title VARCHAR(500),
    published_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL,
    listed_at TIMESTAMPTZ NOT NULL,
    state VARCHAR(16) NOT NULL CHECK (state IN ('NEW', 'DONE', 'DISMISSED', 'EARLIER')),
    state_changed_at TIMESTAMPTZ,
    state_changed_by_issuer VARCHAR(255),
    state_changed_by_subject VARCHAR(255),
    lock_version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_note_post_source_external UNIQUE (source_code, external_id)
);
CREATE INDEX ix_note_post_state_listed ON patch.note_post(state, listed_at DESC);
CREATE INDEX ix_note_post_listed ON patch.note_post(listed_at DESC);
CREATE INDEX ix_note_post_url ON patch.note_post(url);
