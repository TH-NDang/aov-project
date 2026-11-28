-- Editors choose the order in which a patch lists its heroes, in Admin and on the public patch page. A change set with
-- no position yet (recorded after the order was set) comes first, newest first, as every list did before.
CREATE TABLE hero.hero_patch_change_position (
    change_set_id UUID PRIMARY KEY REFERENCES hero.hero_patch_change_set(id),
    position INTEGER NOT NULL CHECK (position >= 0),
    lock_version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL,
    updated_by_issuer TEXT NOT NULL,
    updated_by_subject TEXT NOT NULL
);
