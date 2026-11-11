-- A hero change set may mark the patch that introduced the hero (ADR-016, 2026-11-11 addendum).
-- Public catalogs leave the hero out at earlier patches instead of reading it from a later observation.
ALTER TABLE hero.hero_patch_change_set
    ADD COLUMN introduces_hero BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX uq_hero_patch_change_set_introduction
    ON hero.hero_patch_change_set (hero_id)
    WHERE introduces_hero;
