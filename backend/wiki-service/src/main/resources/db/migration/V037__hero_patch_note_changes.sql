-- ADR-016: a hero change set may be recorded from official patch notes without a target snapshot.
ALTER TABLE hero.hero_patch_change_set
    ADD COLUMN source_kind VARCHAR(16) NOT NULL DEFAULT 'SNAPSHOT',
    ADD COLUMN source_url TEXT,
    ALTER COLUMN to_hero_revision_id DROP NOT NULL,
    DROP CONSTRAINT hero_patch_change_set_check,
    ADD CONSTRAINT hero_patch_change_set_check
        CHECK (to_hero_revision_id IS NULL OR from_hero_revision_id IS DISTINCT FROM to_hero_revision_id),
    ADD CONSTRAINT hero_patch_change_set_source_kind_check CHECK (source_kind IN ('SNAPSHOT', 'PATCH_NOTES')),
    ADD CONSTRAINT hero_patch_change_set_snapshot_target_check
        CHECK (source_kind <> 'SNAPSHOT' OR to_hero_revision_id IS NOT NULL),
    ADD CONSTRAINT hero_patch_change_set_notes_source_check
        CHECK (source_kind <> 'PATCH_NOTES' OR source_url IS NOT NULL);
