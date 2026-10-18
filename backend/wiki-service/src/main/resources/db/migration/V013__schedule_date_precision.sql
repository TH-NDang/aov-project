ALTER TABLE patch.patch_release ALTER COLUMN effective_at DROP NOT NULL;
ALTER TABLE patch.patch_release ADD COLUMN effective_on DATE;
ALTER TABLE patch.patch_release ADD COLUMN confirmed_at TIMESTAMPTZ;
ALTER TABLE patch.patch_release ADD CHECK (effective_at IS NOT NULL OR effective_on IS NOT NULL);
ALTER TABLE patch.patch_release ADD CHECK (status <> 'SCHEDULED' OR effective_at IS NOT NULL);
ALTER TABLE patch.patch_release ADD CHECK (effective_on IS NULL OR effective_at IS NULL
    OR (confirmed_at IS NOT NULL AND confirmed_at = effective_at));
ALTER TABLE patch.season_schedule ADD COLUMN starts_on DATE;
ALTER TABLE patch.season_schedule ADD COLUMN ends_on DATE;
