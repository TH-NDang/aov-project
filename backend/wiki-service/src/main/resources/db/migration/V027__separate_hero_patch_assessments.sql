CREATE TABLE hero.hero_patch_assessment (
 change_set_id UUID PRIMARY KEY REFERENCES hero.hero_patch_change_set(id),
 kind VARCHAR(32) NOT NULL CHECK(kind IN ('BUFF','NERF','ADJUSTMENT','REWORK','FIX','OTHER')),
 version BIGINT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL,
 updated_by_issuer TEXT NOT NULL, updated_by_subject TEXT NOT NULL
);
