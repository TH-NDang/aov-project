-- Select active snapshots within a ruleset without scanning other rulesets or discarded history.
-- Owner-first uniqueness indexes remain useful for the correlated latest-revision checks.
CREATE INDEX hero_revision_catalog_scope ON hero.hero_revision (ruleset_id, hero_id, revision_no DESC)
    WHERE state <> 'DISCARDED';
CREATE INDEX item_revision_catalog_scope ON item.item_revision (ruleset_id, owner_id, revision_no DESC)
    WHERE state <> 'DISCARDED';
CREATE INDEX arcana_revision_catalog_scope ON arcana.arcana_revision (ruleset_id, owner_id, revision_no DESC)
    WHERE state <> 'DISCARDED';
CREATE INDEX enchantment_revision_catalog_scope ON enchantment.enchantment_revision (ruleset_id, owner_id, revision_no DESC)
    WHERE state <> 'DISCARDED';
CREATE INDEX spell_revision_catalog_scope ON spell.spell_revision (ruleset_id, owner_id, revision_no DESC)
    WHERE state <> 'DISCARDED';
