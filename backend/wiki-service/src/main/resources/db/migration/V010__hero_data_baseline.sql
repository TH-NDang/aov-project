ALTER TABLE hero.hero_revision DROP CONSTRAINT hero_revision_cause_check;
ALTER TABLE hero.hero_revision ADD CONSTRAINT hero_revision_cause_check
    CHECK (cause IN ('DATA_BASELINE','GAME_PATCH','CONTENT_CORRECTION','TRANSLATION','IMPORT_CORRECTION','VISUAL_UPDATE','OTHER'));
