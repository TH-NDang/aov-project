CREATE SCHEMA IF NOT EXISTS item;
CREATE TABLE item.item (
 id UUID PRIMARY KEY, code VARCHAR(120) NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL, created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL
);
CREATE TABLE item.item_revision (
 id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES item.item(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id), revision_no BIGINT NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL CHECK(version>0), publication_sequence BIGINT, published_at TIMESTAMPTZ,
 cause VARCHAR(32) NOT NULL CHECK(cause IN ('DATA_BASELINE','GAME_PATCH','CONTENT_CORRECTION','TRANSLATION_UPDATE')),
 effective_from_patch_variant_id UUID REFERENCES patch.patch_variant(id),
 source_revision_id UUID REFERENCES item.item_revision(id), icon_asset_id UUID,
 gameplay JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL, updated_by_issuer TEXT NOT NULL, updated_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,ruleset_id,revision_no),
 CHECK(state <> 'PUBLISHED' OR (published_at IS NOT NULL AND publication_sequence IS NOT NULL AND effective_from_patch_variant_id IS NOT NULL)),
 CHECK(jsonb_array_length(COALESCE(gameplay->'translations','[]'::jsonb))=0)
);
CREATE UNIQUE INDEX item_one_draft ON item.item_revision(owner_id,ruleset_id) WHERE state='DRAFT';
CREATE INDEX item_revision_icon ON item.item_revision(icon_asset_id) WHERE icon_asset_id IS NOT NULL;
CREATE TABLE item.item_translation (
 id UUID PRIMARY KEY, revision_id UUID NOT NULL REFERENCES item.item_revision(id), locale VARCHAR(16) NOT NULL,
 name VARCHAR(255) NOT NULL, summary VARCHAR(2000), description TEXT,
 stat_labels JSONB NOT NULL DEFAULT '{}', effects JSONB NOT NULL DEFAULT '[]', variant_labels JSONB NOT NULL DEFAULT '{}', UNIQUE(revision_id,locale)
);

CREATE SCHEMA IF NOT EXISTS arcana;
CREATE TABLE arcana.arcana (
 id UUID PRIMARY KEY, code VARCHAR(120) NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL, created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL
);
CREATE TABLE arcana.arcana_revision (
 id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES arcana.arcana(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id), revision_no BIGINT NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL CHECK(version>0), publication_sequence BIGINT, published_at TIMESTAMPTZ,
 cause VARCHAR(32) NOT NULL CHECK(cause IN ('DATA_BASELINE','GAME_PATCH','CONTENT_CORRECTION','TRANSLATION_UPDATE')),
 effective_from_patch_variant_id UUID REFERENCES patch.patch_variant(id),
 source_revision_id UUID REFERENCES arcana.arcana_revision(id), icon_asset_id UUID,
 gameplay JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL, updated_by_issuer TEXT NOT NULL, updated_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,ruleset_id,revision_no),
 CHECK(state <> 'PUBLISHED' OR (published_at IS NOT NULL AND publication_sequence IS NOT NULL AND effective_from_patch_variant_id IS NOT NULL)),
 CHECK(jsonb_array_length(COALESCE(gameplay->'translations','[]'::jsonb))=0)
);
CREATE UNIQUE INDEX arcana_one_draft ON arcana.arcana_revision(owner_id,ruleset_id) WHERE state='DRAFT';
CREATE INDEX arcana_revision_icon ON arcana.arcana_revision(icon_asset_id) WHERE icon_asset_id IS NOT NULL;
CREATE TABLE arcana.arcana_translation (
 id UUID PRIMARY KEY, revision_id UUID NOT NULL REFERENCES arcana.arcana_revision(id), locale VARCHAR(16) NOT NULL,
 name VARCHAR(255) NOT NULL, summary VARCHAR(2000), description TEXT,
 stat_labels JSONB NOT NULL DEFAULT '{}', effects JSONB NOT NULL DEFAULT '[]', variant_labels JSONB NOT NULL DEFAULT '{}', UNIQUE(revision_id,locale)
);

CREATE SCHEMA IF NOT EXISTS enchantment;
CREATE TABLE enchantment.enchantment (
 id UUID PRIMARY KEY, code VARCHAR(120) NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL, created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL
);
CREATE TABLE enchantment.enchantment_revision (
 id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES enchantment.enchantment(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id), revision_no BIGINT NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL CHECK(version>0), publication_sequence BIGINT, published_at TIMESTAMPTZ,
 cause VARCHAR(32) NOT NULL CHECK(cause IN ('DATA_BASELINE','GAME_PATCH','CONTENT_CORRECTION','TRANSLATION_UPDATE')),
 effective_from_patch_variant_id UUID REFERENCES patch.patch_variant(id),
 source_revision_id UUID REFERENCES enchantment.enchantment_revision(id), icon_asset_id UUID,
 gameplay JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL, updated_by_issuer TEXT NOT NULL, updated_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,ruleset_id,revision_no),
 CHECK(state <> 'PUBLISHED' OR (published_at IS NOT NULL AND publication_sequence IS NOT NULL AND effective_from_patch_variant_id IS NOT NULL)),
 CHECK(jsonb_array_length(COALESCE(gameplay->'translations','[]'::jsonb))=0)
);
CREATE UNIQUE INDEX enchantment_one_draft ON enchantment.enchantment_revision(owner_id,ruleset_id) WHERE state='DRAFT';
CREATE INDEX enchantment_revision_icon ON enchantment.enchantment_revision(icon_asset_id) WHERE icon_asset_id IS NOT NULL;
CREATE TABLE enchantment.enchantment_translation (
 id UUID PRIMARY KEY, revision_id UUID NOT NULL REFERENCES enchantment.enchantment_revision(id), locale VARCHAR(16) NOT NULL,
 name VARCHAR(255) NOT NULL, summary VARCHAR(2000), description TEXT,
 stat_labels JSONB NOT NULL DEFAULT '{}', effects JSONB NOT NULL DEFAULT '[]', variant_labels JSONB NOT NULL DEFAULT '{}', UNIQUE(revision_id,locale)
);

CREATE SCHEMA IF NOT EXISTS spell;
CREATE TABLE spell.spell (
 id UUID PRIMARY KEY, code VARCHAR(120) NOT NULL UNIQUE,
 created_at TIMESTAMPTZ NOT NULL, created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL
);
CREATE TABLE spell.spell_revision (
 id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES spell.spell(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id), revision_no BIGINT NOT NULL,
 state VARCHAR(16) NOT NULL CHECK(state IN ('DRAFT','PUBLISHED','DISCARDED')),
 version BIGINT NOT NULL CHECK(version>0), publication_sequence BIGINT, published_at TIMESTAMPTZ,
 cause VARCHAR(32) NOT NULL CHECK(cause IN ('DATA_BASELINE','GAME_PATCH','CONTENT_CORRECTION','TRANSLATION_UPDATE')),
 effective_from_patch_variant_id UUID REFERENCES patch.patch_variant(id),
 source_revision_id UUID REFERENCES spell.spell_revision(id), icon_asset_id UUID,
 gameplay JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
 created_by_issuer TEXT NOT NULL, created_by_subject TEXT NOT NULL, updated_by_issuer TEXT NOT NULL, updated_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,ruleset_id,revision_no),
 CHECK(state <> 'PUBLISHED' OR (published_at IS NOT NULL AND publication_sequence IS NOT NULL AND effective_from_patch_variant_id IS NOT NULL)),
 CHECK(jsonb_array_length(COALESCE(gameplay->'translations','[]'::jsonb))=0)
);
CREATE UNIQUE INDEX spell_one_draft ON spell.spell_revision(owner_id,ruleset_id) WHERE state='DRAFT';
CREATE INDEX spell_revision_icon ON spell.spell_revision(icon_asset_id) WHERE icon_asset_id IS NOT NULL;
CREATE TABLE spell.spell_translation (
 id UUID PRIMARY KEY, revision_id UUID NOT NULL REFERENCES spell.spell_revision(id), locale VARCHAR(16) NOT NULL, target_key VARCHAR(120) NOT NULL,
 name VARCHAR(255) NOT NULL, summary VARCHAR(2000), description TEXT,
 stat_labels JSONB NOT NULL DEFAULT '{}', effects JSONB NOT NULL DEFAULT '[]', variant_labels JSONB NOT NULL DEFAULT '{}', UNIQUE(revision_id,target_key,locale)
);
CREATE TABLE item.item_category (
 code VARCHAR(120) PRIMARY KEY, version BIGINT NOT NULL, display_order INTEGER NOT NULL,
 icon_asset_id UUID, background_asset_id UUID, color VARCHAR(7)
);
CREATE TABLE item.recipe_graph_lock (id INTEGER PRIMARY KEY CHECK(id=1));
INSERT INTO item.recipe_graph_lock(id) VALUES(1);
CREATE TABLE item.item_category_translation (
 id UUID PRIMARY KEY, owner_code VARCHAR(120) NOT NULL REFERENCES item.item_category(code),
 locale VARCHAR(16) NOT NULL, name VARCHAR(255) NOT NULL, description TEXT, suitability TEXT,
 UNIQUE(owner_code,locale)
);

CREATE TABLE enchantment.enchantment_branch (
 code VARCHAR(120) PRIMARY KEY, version BIGINT NOT NULL, display_order INTEGER NOT NULL,
 icon_asset_id UUID, background_asset_id UUID, color VARCHAR(7)
);
CREATE TABLE enchantment.enchantment_branch_translation (
 id UUID PRIMARY KEY, owner_code VARCHAR(120) NOT NULL REFERENCES enchantment.enchantment_branch(code),
 locale VARCHAR(16) NOT NULL, name VARCHAR(255) NOT NULL, description TEXT, suitability TEXT,
 UNIQUE(owner_code,locale)
);

CREATE FUNCTION item.guard_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF OLD.state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog data is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER item_revision_immutable BEFORE UPDATE OR DELETE ON item.item_revision
 FOR EACH ROW EXECUTE FUNCTION item.guard_catalog_revision();
CREATE FUNCTION item.guard_catalog_translation() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE parent_id UUID; parent_state TEXT;
BEGIN
 IF TG_OP='DELETE' THEN parent_id=OLD.revision_id; ELSE parent_id=NEW.revision_id; END IF;
 SELECT state INTO parent_state FROM item.item_revision WHERE id=parent_id FOR UPDATE;
 IF parent_state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog translations are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER item_translation_immutable BEFORE INSERT OR UPDATE OR DELETE ON item.item_translation
 FOR EACH ROW EXECUTE FUNCTION item.guard_catalog_translation();

CREATE FUNCTION arcana.guard_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF OLD.state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog data is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER arcana_revision_immutable BEFORE UPDATE OR DELETE ON arcana.arcana_revision
 FOR EACH ROW EXECUTE FUNCTION arcana.guard_catalog_revision();
CREATE FUNCTION arcana.guard_catalog_translation() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE parent_id UUID; parent_state TEXT;
BEGIN
 IF TG_OP='DELETE' THEN parent_id=OLD.revision_id; ELSE parent_id=NEW.revision_id; END IF;
 SELECT state INTO parent_state FROM arcana.arcana_revision WHERE id=parent_id FOR UPDATE;
 IF parent_state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog translations are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER arcana_translation_immutable BEFORE INSERT OR UPDATE OR DELETE ON arcana.arcana_translation
 FOR EACH ROW EXECUTE FUNCTION arcana.guard_catalog_translation();

CREATE FUNCTION spell.guard_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF OLD.state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog data is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER spell_revision_immutable BEFORE UPDATE OR DELETE ON spell.spell_revision
 FOR EACH ROW EXECUTE FUNCTION spell.guard_catalog_revision();
CREATE FUNCTION spell.guard_catalog_translation() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE parent_id UUID; parent_state TEXT;
BEGIN
 IF TG_OP='DELETE' THEN parent_id=OLD.revision_id; ELSE parent_id=NEW.revision_id; END IF;
 SELECT state INTO parent_state FROM spell.spell_revision WHERE id=parent_id FOR UPDATE;
 IF parent_state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog translations are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER spell_translation_immutable BEFORE INSERT OR UPDATE OR DELETE ON spell.spell_translation
 FOR EACH ROW EXECUTE FUNCTION spell.guard_catalog_translation();

CREATE FUNCTION enchantment.guard_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF OLD.state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog data is immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER enchantment_revision_immutable BEFORE UPDATE OR DELETE ON enchantment.enchantment_revision
 FOR EACH ROW EXECUTE FUNCTION enchantment.guard_catalog_revision();
CREATE FUNCTION enchantment.guard_catalog_translation() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE parent_id UUID; parent_state TEXT;
BEGIN
 IF TG_OP='DELETE' THEN parent_id=OLD.revision_id; ELSE parent_id=NEW.revision_id; END IF;
 SELECT state INTO parent_state FROM enchantment.enchantment_revision WHERE id=parent_id FOR UPDATE;
 IF parent_state='PUBLISHED' THEN RAISE EXCEPTION 'Published catalog translations are immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER enchantment_translation_immutable BEFORE INSERT OR UPDATE OR DELETE ON enchantment.enchantment_translation
 FOR EACH ROW EXECUTE FUNCTION enchantment.guard_catalog_translation();
