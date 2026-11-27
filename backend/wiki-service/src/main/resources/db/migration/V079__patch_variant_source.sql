-- Links to the official notes of a patch variant, shared by every change recorded from them (ADR-016, 2026-11-27).
CREATE TABLE patch.variant_source (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES patch.patch_variant(id),
    position INTEGER NOT NULL CHECK (position >= 0),
    url TEXT NOT NULL CHECK (length(url) <= 2048 AND url ~* '^https?://'),
    label VARCHAR(80) NOT NULL CHECK (btrim(label) <> ''),
    locale VARCHAR(35),
    UNIQUE (variant_id, position),
    UNIQUE (variant_id, url)
);

-- A change set recorded from patch notes may lean on the links of its patch instead of a link of its own; the
-- application requires one of the two.
ALTER TABLE hero.hero_patch_change_set DROP CONSTRAINT hero_patch_change_set_notes_source_check;
