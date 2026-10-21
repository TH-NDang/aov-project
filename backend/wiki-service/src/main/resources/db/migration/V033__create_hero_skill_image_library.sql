-- Source icons remain associated with a hero even when skill metadata is not collected yet.
-- This inventory never changes an immutable gameplay snapshot or claims historical applicability.
CREATE TABLE hero.hero_skill_image (
    id UUID PRIMARY KEY,
    hero_id UUID NOT NULL REFERENCES hero.hero(id),
    skill_key VARCHAR(64),
    source_slot INTEGER NOT NULL CHECK (source_slot BETWEEN 0 AND 99),
    variant_no INTEGER NOT NULL CHECK (variant_no BETWEEN 1 AND 100),
    asset_id UUID NOT NULL,
    source_filename VARCHAR(255) NOT NULL,
    label VARCHAR(255),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (hero_id, source_slot, variant_no),
    FOREIGN KEY (hero_id, skill_key) REFERENCES hero.hero_skill(hero_id, skill_key)
);
CREATE INDEX hero_skill_image_asset ON hero.hero_skill_image(asset_id);
