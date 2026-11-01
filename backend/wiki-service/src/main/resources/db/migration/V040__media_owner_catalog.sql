-- ADR-017: one catalog entry per owner, so an owner keeps one spelling across every image.
CREATE TABLE media.media_owner (
    id           UUID          PRIMARY KEY,
    name         VARCHAR(200)  NOT NULL CHECK (btrim(name) <> ''),
    name_key     VARCHAR(200)  NOT NULL UNIQUE,
    contact_url  VARCHAR(2048) NULL,
    lock_version BIGINT        NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ   NOT NULL,
    updated_at   TIMESTAMPTZ   NOT NULL
);

ALTER TABLE media.media_provenance
    ADD COLUMN owner_id UUID NULL REFERENCES media.media_owner (id);

CREATE INDEX ix_media_provenance_owner ON media.media_provenance (owner_id);

-- The key matches the application rule: trimmed, inner whitespace collapsed, lower case.
-- The spelling used most often becomes the owner's display name.
WITH variants AS (
    SELECT regexp_replace(regexp_replace(owner_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g') AS name,
           count(*) AS uses
    FROM media.media_provenance
    WHERE owner_name IS NOT NULL AND owner_name ~ '\S'
    GROUP BY 1
), chosen AS (
    SELECT DISTINCT ON (lower(name)) lower(name) AS name_key, name
    FROM variants
    ORDER BY lower(name), uses DESC, name
)
INSERT INTO media.media_owner (id, name, name_key, created_at, updated_at)
SELECT gen_random_uuid(), name, name_key, now(), now()
FROM chosen;

UPDATE media.media_provenance p
SET owner_id = o.id,
    owner_name = o.name
FROM media.media_owner o
WHERE p.owner_name IS NOT NULL
  AND o.name_key = lower(regexp_replace(regexp_replace(p.owner_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g'));
