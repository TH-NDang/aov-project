CREATE TABLE hero.hero_patch_change_set (
 id UUID PRIMARY KEY,patch_variant_id UUID NOT NULL,hero_id UUID NOT NULL REFERENCES hero.hero,
 from_hero_revision_id UUID,to_hero_revision_id UUID NOT NULL,created_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL,UNIQUE(patch_variant_id,hero_id),
 FOREIGN KEY(from_hero_revision_id,hero_id) REFERENCES hero.hero_revision(id,hero_id),
 FOREIGN KEY(to_hero_revision_id,hero_id) REFERENCES hero.hero_revision(id,hero_id),
 CHECK(from_hero_revision_id IS DISTINCT FROM to_hero_revision_id)
);
CREATE TABLE hero.hero_patch_change_translation (
 change_set_id UUID NOT NULL REFERENCES hero.hero_patch_change_set,locale VARCHAR(16) NOT NULL,summary TEXT NOT NULL,PRIMARY KEY(change_set_id,locale)
);
CREATE TABLE hero.hero_stat_change (
 id UUID PRIMARY KEY,change_set_id UUID NOT NULL REFERENCES hero.hero_patch_change_set,
 change_kind VARCHAR(16) NOT NULL CHECK(change_kind IN ('BUFF','NERF','ADJUSTMENT','REWORK','FIX','OTHER')),sort_order INTEGER NOT NULL,stat_key VARCHAR(64) NOT NULL,old_value NUMERIC,new_value NUMERIC,unit_code VARCHAR(32) NOT NULL,UNIQUE(change_set_id,sort_order)
);
CREATE TABLE hero.hero_skill_change (
 id UUID PRIMARY KEY,change_set_id UUID NOT NULL REFERENCES hero.hero_patch_change_set,
 change_kind VARCHAR(16) NOT NULL CHECK(change_kind IN ('BUFF','NERF','ADJUSTMENT','REWORK','FIX','OTHER')),sort_order INTEGER NOT NULL,skill_key VARCHAR(64) NOT NULL,field_key VARCHAR(64) NOT NULL,old_value TEXT,new_value TEXT,UNIQUE(change_set_id,sort_order)
);
CREATE TABLE hero.hero_role_change (
 id UUID PRIMARY KEY,change_set_id UUID NOT NULL REFERENCES hero.hero_patch_change_set,
 change_kind VARCHAR(16) NOT NULL CHECK(change_kind IN ('BUFF','NERF','ADJUSTMENT','REWORK','FIX','OTHER')),sort_order INTEGER NOT NULL,role_code VARCHAR(16) NOT NULL,added BOOLEAN NOT NULL,UNIQUE(change_set_id,sort_order)
);
CREATE TABLE hero.hero_visual_change (
 id UUID PRIMARY KEY,change_set_id UUID NOT NULL REFERENCES hero.hero_patch_change_set,
 change_kind VARCHAR(16) NOT NULL CHECK(change_kind IN ('BUFF','NERF','ADJUSTMENT','REWORK','FIX','OTHER')),sort_order INTEGER NOT NULL,media_role VARCHAR(32) NOT NULL,old_asset_id UUID,new_asset_id UUID,UNIQUE(change_set_id,sort_order)
);
CREATE TABLE hero.hero_mechanic_change (
 id UUID PRIMARY KEY,change_set_id UUID NOT NULL REFERENCES hero.hero_patch_change_set,
 change_kind VARCHAR(16) NOT NULL CHECK(change_kind IN ('BUFF','NERF','ADJUSTMENT','REWORK','FIX','OTHER')),sort_order INTEGER NOT NULL,mechanic_key VARCHAR(64) NOT NULL,description TEXT NOT NULL,UNIQUE(change_set_id,sort_order)
);
CREATE TABLE hero.hero_other_change (
 id UUID PRIMARY KEY,change_set_id UUID NOT NULL REFERENCES hero.hero_patch_change_set,
 change_kind VARCHAR(16) NOT NULL CHECK(change_kind IN ('BUFF','NERF','ADJUSTMENT','REWORK','FIX','OTHER')),sort_order INTEGER NOT NULL,description TEXT NOT NULL,UNIQUE(change_set_id,sort_order)
);
CREATE INDEX ix_hero_patch_change_subject ON hero.hero_patch_change_set(hero_id,created_at DESC);
CREATE FUNCTION hero.guard_change_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Hero patch history is append only'; END $$;
CREATE TRIGGER trg_hero_patch_change_set_append_only BEFORE UPDATE OR DELETE ON hero.hero_patch_change_set FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
CREATE TRIGGER trg_hero_patch_change_translation_append_only BEFORE UPDATE OR DELETE ON hero.hero_patch_change_translation FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
CREATE TRIGGER trg_hero_stat_change_append_only BEFORE UPDATE OR DELETE ON hero.hero_stat_change FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
CREATE TRIGGER trg_hero_skill_change_append_only BEFORE UPDATE OR DELETE ON hero.hero_skill_change FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
CREATE TRIGGER trg_hero_role_change_append_only BEFORE UPDATE OR DELETE ON hero.hero_role_change FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
CREATE TRIGGER trg_hero_visual_change_append_only BEFORE UPDATE OR DELETE ON hero.hero_visual_change FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
CREATE TRIGGER trg_hero_mechanic_change_append_only BEFORE UPDATE OR DELETE ON hero.hero_mechanic_change FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
CREATE TRIGGER trg_hero_other_change_append_only BEFORE UPDATE OR DELETE ON hero.hero_other_change FOR EACH ROW EXECUTE FUNCTION hero.guard_change_history();
