-- Translations of Stream posts made with the Claude API (ADR-037). One row per post and target language. source_hash
-- covers the post's title, body and images, the model and the prompt version, so an edited post, a new model or a new
-- prompt is translated again; the row is then replaced.
CREATE TABLE community.post_translation (
    id UUID PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES community.post(id) ON DELETE CASCADE,
    locale VARCHAR(16) NOT NULL,
    source_hash VARCHAR(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
    source_language VARCHAR(16) NOT NULL,
    title TEXT,
    body TEXT NOT NULL,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    model VARCHAR(64) NOT NULL,
    input_tokens BIGINT NOT NULL CHECK (input_tokens >= 0),
    output_tokens BIGINT NOT NULL CHECK (output_tokens >= 0),
    cost_micros BIGINT NOT NULL CHECK (cost_micros >= 0),
    -- Checks the kept answer still failed after its one retry, for a later look at the prompt.
    failed_checks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (post_id, locale)
);

-- What the Claude API cost per calendar month (UTC), retries included; translation stops when the budget is spent.
CREATE TABLE community.translation_usage (
    month DATE PRIMARY KEY CHECK (extract(day FROM month) = 1),
    calls BIGINT NOT NULL CHECK (calls >= 0),
    input_tokens BIGINT NOT NULL CHECK (input_tokens >= 0),
    output_tokens BIGINT NOT NULL CHECK (output_tokens >= 0),
    cost_micros BIGINT NOT NULL CHECK (cost_micros >= 0),
    updated_at TIMESTAMPTZ NOT NULL
);
