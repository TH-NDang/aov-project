CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE patch.gameplay_ruleset (
 id UUID PRIMARY KEY, code VARCHAR(64) NOT NULL UNIQUE, description TEXT NOT NULL,
 lifecycle_state VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (lifecycle_state IN ('ACTIVE','LOCKED')),
 created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE patch.region_ruleset_assignment (
 id UUID PRIMARY KEY, region_id UUID NOT NULL REFERENCES patch.region,
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset,
 valid_from TIMESTAMPTZ NOT NULL, valid_to TIMESTAMPTZ,
 CHECK (valid_to IS NULL OR valid_to > valid_from),
 EXCLUDE USING gist (region_id WITH =, tstzrange(valid_from,valid_to,'[)') WITH &&)
);
CREATE TABLE patch.game_patch (
 id UUID PRIMARY KEY, code VARCHAR(64) NOT NULL UNIQUE,
 sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
 status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
 created_at TIMESTAMPTZ NOT NULL, created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL
);
CREATE TABLE patch.game_patch_translation (
 patch_id UUID NOT NULL REFERENCES patch.game_patch, locale VARCHAR(16) NOT NULL,
 title VARCHAR(200) NOT NULL, summary TEXT NOT NULL, description TEXT,
 PRIMARY KEY(patch_id,locale)
);
CREATE TABLE patch.patch_variant (
 id UUID PRIMARY KEY, patch_id UUID NOT NULL REFERENCES patch.game_patch,
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset, variant_code VARCHAR(64) NOT NULL,
 ruleset_ordinal BIGINT NOT NULL CHECK (ruleset_ordinal > 0),
 status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED')),
 published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL,
 UNIQUE(patch_id,ruleset_id), UNIQUE(ruleset_id,ruleset_ordinal),
 CHECK ((status='PUBLISHED') = (published_at IS NOT NULL))
);
CREATE TABLE patch.patch_release (
 id UUID PRIMARY KEY, patch_variant_id UUID NOT NULL REFERENCES patch.patch_variant,
 region_id UUID NOT NULL REFERENCES patch.region, effective_at TIMESTAMPTZ NOT NULL,
 announced_at TIMESTAMPTZ, status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED'
 CHECK(status IN ('DRAFT','SCHEDULED','CANCELLED')), source_url TEXT, created_at TIMESTAMPTZ NOT NULL,
 UNIQUE(patch_variant_id,region_id)
);
CREATE UNIQUE INDEX uq_patch_release_time ON patch.patch_release(region_id,effective_at) WHERE status='SCHEDULED';
CREATE INDEX ix_patch_release_resolve ON patch.patch_release(region_id,effective_at DESC) WHERE status='SCHEDULED';
