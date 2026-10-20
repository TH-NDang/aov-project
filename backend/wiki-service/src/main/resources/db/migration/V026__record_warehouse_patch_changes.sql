CREATE FUNCTION patch.reject_catalog_change_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Confirmed catalog changes are immutable';
END;
$$;

CREATE TABLE item.item_patch_change_set (
 id UUID PRIMARY KEY,
 owner_id UUID NOT NULL REFERENCES item.item(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id),
 patch_variant_id UUID NOT NULL REFERENCES patch.patch_variant(id),
 from_revision_id UUID REFERENCES item.item_revision(id),
 to_revision_id UUID NOT NULL REFERENCES item.item_revision(id),
 kinds JSONB NOT NULL CHECK (jsonb_array_length(kinds) BETWEEN 1 AND 4
   AND kinds <@ '["DATA_BASELINE","ADDED","UPDATED","REMOVED","BUFF","NERF","BALANCE","REWORK","FIX"]'::jsonb),
 translations JSONB NOT NULL CHECK (jsonb_array_length(translations)>0),
 source_url VARCHAR(2048) NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL,
 recorded_by_issuer TEXT NOT NULL, recorded_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,patch_variant_id)
);
CREATE INDEX item_change_scope ON item.item_patch_change_set(ruleset_id,patch_variant_id);
CREATE TRIGGER item_change_immutable BEFORE UPDATE OR DELETE ON item.item_patch_change_set
 FOR EACH ROW EXECUTE FUNCTION patch.reject_catalog_change_mutation();

CREATE TABLE arcana.arcana_patch_change_set (
 id UUID PRIMARY KEY,
 owner_id UUID NOT NULL REFERENCES arcana.arcana(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id),
 patch_variant_id UUID NOT NULL REFERENCES patch.patch_variant(id),
 from_revision_id UUID REFERENCES arcana.arcana_revision(id),
 to_revision_id UUID NOT NULL REFERENCES arcana.arcana_revision(id),
 kinds JSONB NOT NULL CHECK (jsonb_array_length(kinds) BETWEEN 1 AND 4
   AND kinds <@ '["DATA_BASELINE","ADDED","UPDATED","REMOVED","BUFF","NERF","BALANCE","REWORK","FIX"]'::jsonb),
 translations JSONB NOT NULL CHECK (jsonb_array_length(translations)>0),
 source_url VARCHAR(2048) NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL,
 recorded_by_issuer TEXT NOT NULL, recorded_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,patch_variant_id)
);
CREATE INDEX arcana_change_scope ON arcana.arcana_patch_change_set(ruleset_id,patch_variant_id);
CREATE TRIGGER arcana_change_immutable BEFORE UPDATE OR DELETE ON arcana.arcana_patch_change_set
 FOR EACH ROW EXECUTE FUNCTION patch.reject_catalog_change_mutation();

CREATE TABLE spell.spell_patch_change_set (
 id UUID PRIMARY KEY,
 owner_id UUID NOT NULL REFERENCES spell.spell(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id),
 patch_variant_id UUID NOT NULL REFERENCES patch.patch_variant(id),
 from_revision_id UUID REFERENCES spell.spell_revision(id),
 to_revision_id UUID NOT NULL REFERENCES spell.spell_revision(id),
 kinds JSONB NOT NULL CHECK (jsonb_array_length(kinds) BETWEEN 1 AND 4
   AND kinds <@ '["DATA_BASELINE","ADDED","UPDATED","REMOVED","BUFF","NERF","BALANCE","REWORK","FIX"]'::jsonb),
 translations JSONB NOT NULL CHECK (jsonb_array_length(translations)>0),
 source_url VARCHAR(2048) NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL,
 recorded_by_issuer TEXT NOT NULL, recorded_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,patch_variant_id)
);
CREATE INDEX spell_change_scope ON spell.spell_patch_change_set(ruleset_id,patch_variant_id);
CREATE TRIGGER spell_change_immutable BEFORE UPDATE OR DELETE ON spell.spell_patch_change_set
 FOR EACH ROW EXECUTE FUNCTION patch.reject_catalog_change_mutation();

CREATE TABLE enchantment.enchantment_patch_change_set (
 id UUID PRIMARY KEY,
 owner_id UUID NOT NULL REFERENCES enchantment.enchantment(id),
 ruleset_id UUID NOT NULL REFERENCES patch.gameplay_ruleset(id),
 patch_variant_id UUID NOT NULL REFERENCES patch.patch_variant(id),
 from_revision_id UUID REFERENCES enchantment.enchantment_revision(id),
 to_revision_id UUID NOT NULL REFERENCES enchantment.enchantment_revision(id),
 kinds JSONB NOT NULL CHECK (jsonb_array_length(kinds) BETWEEN 1 AND 4
   AND kinds <@ '["DATA_BASELINE","ADDED","UPDATED","REMOVED","BUFF","NERF","BALANCE","REWORK","FIX"]'::jsonb),
 translations JSONB NOT NULL CHECK (jsonb_array_length(translations)>0),
 source_url VARCHAR(2048) NOT NULL,
 recorded_at TIMESTAMPTZ NOT NULL,
 recorded_by_issuer TEXT NOT NULL, recorded_by_subject TEXT NOT NULL,
 UNIQUE(owner_id,patch_variant_id)
);
CREATE INDEX enchantment_change_scope ON enchantment.enchantment_patch_change_set(ruleset_id,patch_variant_id);
CREATE TRIGGER enchantment_change_immutable BEFORE UPDATE OR DELETE ON enchantment.enchantment_patch_change_set
 FOR EACH ROW EXECUTE FUNCTION patch.reject_catalog_change_mutation();
