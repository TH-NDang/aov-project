CREATE TABLE hero.hero_profile_revision (
 id UUID PRIMARY KEY, hero_id UUID NOT NULL REFERENCES hero.hero,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL, UNIQUE(id,hero_id)
);
ALTER TABLE hero.hero_revision ADD FOREIGN KEY (profile_revision_id,hero_id) REFERENCES hero.hero_profile_revision(id,hero_id);
CREATE TRIGGER trg_profile_immutable BEFORE UPDATE OR DELETE ON hero.hero_profile_revision FOR EACH ROW EXECUTE FUNCTION hero.guard_published_revision();
CREATE TABLE hero.hero_overview_rating_revision (
 id UUID PRIMARY KEY, hero_id UUID NOT NULL REFERENCES hero.hero,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL, UNIQUE(id,hero_id)
);
ALTER TABLE hero.hero_revision ADD FOREIGN KEY (overview_rating_revision_id,hero_id) REFERENCES hero.hero_overview_rating_revision(id,hero_id);
CREATE TRIGGER trg_overview_rating_immutable BEFORE UPDATE OR DELETE ON hero.hero_overview_rating_revision FOR EACH ROW EXECUTE FUNCTION hero.guard_published_revision();
CREATE TABLE hero.hero_combat_stats_revision (
 id UUID PRIMARY KEY, hero_id UUID NOT NULL REFERENCES hero.hero,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL, UNIQUE(id,hero_id)
);
ALTER TABLE hero.hero_revision ADD FOREIGN KEY (combat_stats_revision_id,hero_id) REFERENCES hero.hero_combat_stats_revision(id,hero_id);
CREATE TRIGGER trg_combat_stats_immutable BEFORE UPDATE OR DELETE ON hero.hero_combat_stats_revision FOR EACH ROW EXECUTE FUNCTION hero.guard_published_revision();
CREATE TABLE hero.hero_skill_set_revision (
 id UUID PRIMARY KEY, hero_id UUID NOT NULL REFERENCES hero.hero,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL, UNIQUE(id,hero_id)
);
ALTER TABLE hero.hero_revision ADD FOREIGN KEY (skills_revision_id,hero_id) REFERENCES hero.hero_skill_set_revision(id,hero_id);
CREATE TRIGGER trg_skill_set_immutable BEFORE UPDATE OR DELETE ON hero.hero_skill_set_revision FOR EACH ROW EXECUTE FUNCTION hero.guard_published_revision();
CREATE TABLE hero.hero_skin_set_revision (
 id UUID PRIMARY KEY, hero_id UUID NOT NULL REFERENCES hero.hero,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL, UNIQUE(id,hero_id)
);
ALTER TABLE hero.hero_revision ADD FOREIGN KEY (skins_revision_id,hero_id) REFERENCES hero.hero_skin_set_revision(id,hero_id);
CREATE TRIGGER trg_skin_set_immutable BEFORE UPDATE OR DELETE ON hero.hero_skin_set_revision FOR EACH ROW EXECUTE FUNCTION hero.guard_published_revision();
CREATE TABLE hero.hero_media_binding_revision (
 id UUID PRIMARY KEY, hero_id UUID NOT NULL REFERENCES hero.hero,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL,created_by_subject TEXT NOT NULL, UNIQUE(id,hero_id)
);
ALTER TABLE hero.hero_revision ADD FOREIGN KEY (media_binding_revision_id,hero_id) REFERENCES hero.hero_media_binding_revision(id,hero_id);
CREATE TRIGGER trg_media_binding_immutable BEFORE UPDATE OR DELETE ON hero.hero_media_binding_revision FOR EACH ROW EXECUTE FUNCTION hero.guard_published_revision();
CREATE TABLE hero.hero_profile_role (
 profile_revision_id UUID NOT NULL REFERENCES hero.hero_profile_revision,
 role_code VARCHAR(16) NOT NULL CHECK(role_code IN ('TANK','WARRIOR','ASSASSIN','MAGE','MARKSMAN','SUPPORT')),
 PRIMARY KEY(profile_revision_id,role_code)
);
CREATE TABLE hero.hero_profile_translation (
 profile_revision_id UUID NOT NULL REFERENCES hero.hero_profile_revision,locale VARCHAR(16) NOT NULL,
 name VARCHAR(120) NOT NULL,title VARCHAR(200),summary TEXT,lore TEXT,PRIMARY KEY(profile_revision_id,locale)
);
CREATE TABLE hero.rating_scale (code VARCHAR(64) PRIMARY KEY,min_value NUMERIC NOT NULL,max_value NUMERIC NOT NULL,semantics TEXT NOT NULL,CHECK(max_value>min_value));
INSERT INTO hero.rating_scale VALUES('GAME_OVERVIEW_10',0,10,'Wiki overview rating on a 0 to 10 scale; source required for derived values');
ALTER TABLE hero.hero_overview_rating_revision ADD COLUMN scale_code VARCHAR(64) REFERENCES hero.rating_scale;
ALTER TABLE hero.hero_overview_rating_revision ADD COLUMN survivability NUMERIC;
ALTER TABLE hero.hero_overview_rating_revision ADD COLUMN attack_damage NUMERIC;
ALTER TABLE hero.hero_overview_rating_revision ADD COLUMN skill_effects NUMERIC;
ALTER TABLE hero.hero_overview_rating_revision ADD COLUMN difficulty NUMERIC;
ALTER TABLE hero.hero_overview_rating_revision ADD COLUMN derived BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE hero.hero_combat_stat_value (
 stats_revision_id UUID NOT NULL REFERENCES hero.hero_combat_stats_revision,stat_key VARCHAR(64) NOT NULL,
 base_value NUMERIC,growth_per_level NUMERIC,unit_code VARCHAR(32) NOT NULL, metadata JSONB,PRIMARY KEY(stats_revision_id,stat_key)
);
CREATE TABLE hero.hero_skill (hero_id UUID NOT NULL REFERENCES hero.hero,skill_key VARCHAR(64) NOT NULL,created_at TIMESTAMPTZ NOT NULL,PRIMARY KEY(hero_id,skill_key));
CREATE TABLE hero.hero_skill_snapshot (
 skill_set_revision_id UUID NOT NULL, hero_id UUID NOT NULL,skill_key VARCHAR(64) NOT NULL,
 kind VARCHAR(16) NOT NULL CHECK(kind IN ('PASSIVE','ACTIVE','OTHER')),form_key VARCHAR(64),display_order INTEGER NOT NULL,icon_asset_id UUID,
 PRIMARY KEY(skill_set_revision_id,skill_key),UNIQUE(skill_set_revision_id,display_order),
 FOREIGN KEY(skill_set_revision_id,hero_id) REFERENCES hero.hero_skill_set_revision(id,hero_id),
 FOREIGN KEY(hero_id,skill_key) REFERENCES hero.hero_skill(hero_id,skill_key)
);
CREATE TABLE hero.hero_skill_translation (
 skill_set_revision_id UUID NOT NULL,skill_key VARCHAR(64) NOT NULL,locale VARCHAR(16) NOT NULL,
 name VARCHAR(120) NOT NULL,description TEXT NOT NULL,PRIMARY KEY(skill_set_revision_id,skill_key,locale),
 FOREIGN KEY(skill_set_revision_id,skill_key) REFERENCES hero.hero_skill_snapshot
);
CREATE TABLE hero.hero_skill_effect (
 skill_set_revision_id UUID NOT NULL,skill_key VARCHAR(64) NOT NULL,effect_order INTEGER NOT NULL,
 effect_type VARCHAR(32) NOT NULL,metadata JSONB,PRIMARY KEY(skill_set_revision_id,skill_key,effect_order),
 FOREIGN KEY(skill_set_revision_id,skill_key) REFERENCES hero.hero_skill_snapshot
);
CREATE TABLE hero.hero_skin (hero_id UUID NOT NULL REFERENCES hero.hero,skin_key VARCHAR(64) NOT NULL,created_at TIMESTAMPTZ NOT NULL,PRIMARY KEY(hero_id,skin_key));
CREATE TABLE hero.hero_skin_snapshot (
 skin_set_revision_id UUID NOT NULL,hero_id UUID NOT NULL,skin_key VARCHAR(64) NOT NULL,
 display_order INTEGER NOT NULL,art_asset_id UUID,rarity_code VARCHAR(64),PRIMARY KEY(skin_set_revision_id,skin_key),UNIQUE(skin_set_revision_id,display_order),
 FOREIGN KEY(skin_set_revision_id,hero_id) REFERENCES hero.hero_skin_set_revision(id,hero_id),
 FOREIGN KEY(hero_id,skin_key) REFERENCES hero.hero_skin(hero_id,skin_key)
);
CREATE TABLE hero.hero_skin_translation (
 skin_set_revision_id UUID NOT NULL,skin_key VARCHAR(64) NOT NULL,locale VARCHAR(16) NOT NULL,
 name VARCHAR(120) NOT NULL,description TEXT,acquisition_note TEXT,PRIMARY KEY(skin_set_revision_id,skin_key,locale),
 FOREIGN KEY(skin_set_revision_id,skin_key) REFERENCES hero.hero_skin_snapshot
);
CREATE TABLE hero.hero_media_binding (
 media_binding_revision_id UUID NOT NULL REFERENCES hero.hero_media_binding_revision,
 media_role VARCHAR(16) NOT NULL CHECK(media_role IN ('HEAD','PORTRAIT','SPLASH')),asset_id UUID NOT NULL,
 PRIMARY KEY(media_binding_revision_id,media_role)
);
CREATE INDEX ix_hero_media_asset ON hero.hero_media_binding(asset_id);
CREATE INDEX ix_hero_skill_asset ON hero.hero_skill_snapshot(icon_asset_id);
CREATE INDEX ix_hero_skin_asset ON hero.hero_skin_snapshot(art_asset_id);
CREATE TABLE hero.hero_source_reference (
 id UUID PRIMARY KEY,owner_type VARCHAR(32) NOT NULL,owner_revision_id UUID NOT NULL,
 position INTEGER NOT NULL,label VARCHAR(255) NOT NULL,source_url TEXT,observed_at TIMESTAMPTZ,
 verification_state VARCHAR(16) NOT NULL CHECK(verification_state IN ('UNVERIFIED','VERIFIED')),note TEXT
);
CREATE FUNCTION hero.guard_section_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_state TEXT; parent_id UUID;
BEGIN
 IF TG_OP='DELETE' THEN parent_id=(to_jsonb(OLD)->>TG_ARGV[1])::uuid;
 ELSE parent_id=(to_jsonb(NEW)->>TG_ARGV[1])::uuid; END IF;
 EXECUTE format('SELECT state FROM hero.%I WHERE id=$1 FOR UPDATE',TG_ARGV[0]) INTO parent_state USING parent_id;
 IF parent_state='PUBLISHED' THEN RAISE EXCEPTION 'Published hero section content is immutable'; END IF;
 IF TG_OP='UPDATE' AND to_jsonb(OLD)->>TG_ARGV[1] IS DISTINCT FROM to_jsonb(NEW)->>TG_ARGV[1] THEN
  RAISE EXCEPTION 'Section ownership cannot change';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_hero_profile_role_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_profile_role FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_profile_revision','profile_revision_id');
CREATE TRIGGER trg_hero_profile_translation_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_profile_translation FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_profile_revision','profile_revision_id');
CREATE TRIGGER trg_hero_combat_stat_value_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_combat_stat_value FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_combat_stats_revision','stats_revision_id');
CREATE TRIGGER trg_hero_skill_snapshot_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_skill_snapshot FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skill_set_revision','skill_set_revision_id');
CREATE TRIGGER trg_hero_skill_translation_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_skill_translation FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skill_set_revision','skill_set_revision_id');
CREATE TRIGGER trg_hero_skill_effect_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_skill_effect FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skill_set_revision','skill_set_revision_id');
CREATE TRIGGER trg_hero_skin_snapshot_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_skin_snapshot FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skin_set_revision','skin_set_revision_id');
CREATE TRIGGER trg_hero_skin_translation_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_skin_translation FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skin_set_revision','skin_set_revision_id');
CREATE TRIGGER trg_hero_media_binding_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_media_binding FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_media_binding_revision','media_binding_revision_id');

ALTER TABLE hero.hero_source_reference ADD CONSTRAINT uq_hero_source_position UNIQUE(owner_type,owner_revision_id,position);
CREATE FUNCTION hero.guard_source_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE data JSONB; parent_table TEXT; parent_state TEXT;
BEGIN
 data=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 parent_table=CASE data->>'owner_type'
  WHEN 'PROFILE' THEN 'hero_profile_revision'
  WHEN 'OVERVIEW_RATINGS' THEN 'hero_overview_rating_revision'
  WHEN 'COMBAT_STATS' THEN 'hero_combat_stats_revision'
  WHEN 'SKILLS' THEN 'hero_skill_set_revision'
  WHEN 'SKINS' THEN 'hero_skin_set_revision'
  WHEN 'MEDIA_BINDINGS' THEN 'hero_media_binding_revision'
 END;
 IF parent_table IS NULL THEN RAISE EXCEPTION 'Invalid source owner type'; END IF;
 EXECUTE format('SELECT state FROM hero.%I WHERE id=$1 FOR UPDATE',parent_table) INTO parent_state USING (data->>'owner_revision_id')::uuid;
 IF parent_state IS NULL OR parent_state<>'DRAFT' THEN RAISE EXCEPTION 'Sources require an editable section'; END IF;
 IF TG_OP='UPDATE' AND (OLD.owner_type<>NEW.owner_type OR OLD.owner_revision_id<>NEW.owner_revision_id) THEN RAISE EXCEPTION 'Source ownership cannot change'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_hero_source_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_source_reference FOR EACH ROW EXECUTE FUNCTION hero.guard_source_reference();
