CREATE TABLE patch.season_schedule (
    id UUID PRIMARY KEY,
    season_id UUID NOT NULL REFERENCES patch.ranked_season(id),
    region_id UUID NOT NULL REFERENCES patch.region(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    UNIQUE (season_id, region_id),
    CHECK (ends_at > starts_at),
    EXCLUDE USING gist (region_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
);
INSERT INTO patch.season_schedule SELECT id, id, region_id, starts_at, ends_at FROM patch.ranked_season;
ALTER TABLE patch.ranked_season ADD COLUMN ordinal BIGINT;
UPDATE patch.ranked_season s SET ordinal = ordered.position FROM
    (SELECT id, row_number() OVER (ORDER BY starts_at, code, id) AS position FROM patch.ranked_season) ordered
    WHERE s.id = ordered.id;
ALTER TABLE patch.ranked_season ALTER COLUMN ordinal SET NOT NULL;
ALTER TABLE patch.ranked_season ADD UNIQUE (ordinal);
ALTER TABLE patch.ranked_season ADD CHECK (ordinal > 0);
ALTER TABLE patch.ranked_season DROP COLUMN region_id, DROP COLUMN starts_at, DROP COLUMN ends_at;
-- Preserve distinct legacy seasons even when their region-specific codes overlap.
UPDATE patch.ranked_season s SET code = left(s.code, 27) || '-' || s.id::text
WHERE EXISTS (SELECT 1 FROM patch.ranked_season other WHERE other.code = s.code AND other.id <> s.id);
ALTER TABLE patch.ranked_season ADD UNIQUE (code);
ALTER TABLE patch.patch_variant ADD COLUMN season_id UUID REFERENCES patch.ranked_season(id);
UPDATE patch.patch_variant v SET season_id = candidate.season_id FROM (
    SELECT patch_variant_id, min(season_id::text)::uuid AS season_id
    FROM patch.patch_release WHERE season_id IS NOT NULL GROUP BY patch_variant_id
    HAVING count(DISTINCT season_id) = 1
) candidate WHERE candidate.patch_variant_id = v.id;
-- Do not merge identities if the destination code already belongs to another ruleset.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM patch.gameplay_ruleset WHERE code = 'aov-vn')
       AND EXISTS (SELECT 1 FROM patch.gameplay_ruleset WHERE code = 'aov-standard') THEN
        RAISE EXCEPTION 'Both aov-vn and aov-standard exist; resolve the ruleset code conflict before migration';
    END IF;
END $$;
UPDATE patch.gameplay_ruleset SET code = 'aov-standard',
    description = 'Bộ gameplay Liên Quân dùng chung giữa các thị trường.' WHERE code = 'aov-vn';
