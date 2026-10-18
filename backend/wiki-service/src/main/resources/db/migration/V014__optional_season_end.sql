ALTER TABLE patch.season_schedule ALTER COLUMN ends_at DROP NOT NULL;

-- An unknown end is not an infinite claim over all future seasons.
DO $$ DECLARE exclusion_name text;
BEGIN
    SELECT conname INTO exclusion_name FROM pg_constraint
    WHERE conrelid = 'patch.season_schedule'::regclass AND contype = 'x';
    EXECUTE format('ALTER TABLE patch.season_schedule DROP CONSTRAINT %I', exclusion_name);
END $$;
ALTER TABLE patch.season_schedule ADD CONSTRAINT season_schedule_known_bounds_exclusion
    EXCLUDE USING gist (region_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
    WHERE (ends_at IS NOT NULL);
