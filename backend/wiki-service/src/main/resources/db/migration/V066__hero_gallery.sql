-- Images attached straight to a hero, for pictures no version of the hero uses (ADR-027).
-- Images that versions use are read from the versions themselves and are not stored here.
CREATE TABLE hero.hero_gallery_item (
    id UUID PRIMARY KEY,
    hero_id UUID NOT NULL REFERENCES hero.hero (id),
    asset_id UUID NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('HERO_ART', 'SKIN', 'SKILL', 'STICKER', 'OTHER')),
    caption TEXT CHECK (caption IS NULL OR length(caption) <= 500),
    part_key VARCHAR(64),
    until_patch_variant_id UUID,
    sort_order INTEGER NOT NULL,
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by_issuer TEXT NOT NULL,
    created_by_subject TEXT NOT NULL,
    UNIQUE (hero_id, asset_id)
);

CREATE INDEX ix_hero_gallery_item_asset ON hero.hero_gallery_item (asset_id);
