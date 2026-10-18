CREATE TABLE patch.ranked_season (
    id UUID PRIMARY KEY,
    region_id UUID NOT NULL REFERENCES patch.region(id),
    code VARCHAR(64) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    season_year INTEGER,
    season_number INTEGER,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    UNIQUE (region_id, code),
    CHECK (ends_at > starts_at),
    CHECK (season_year IS NULL OR season_year BETWEEN 2000 AND 9999),
    CHECK (season_number IS NULL OR season_number > 0),
    EXCLUDE USING gist (region_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
);
ALTER TABLE patch.patch_release ADD COLUMN season_id UUID REFERENCES patch.ranked_season(id);
