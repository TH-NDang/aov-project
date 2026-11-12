-- In-game hero ranking statistics read from screenshots (ADR-025). A snapshot is one capture of the game's ranking boards
-- for one filter; every value keeps the screenshot and the area it was read from, so an editor can check it. Screenshot
-- bytes stay outside the database, addressed by their SHA-256.
CREATE TABLE hero.ranking_snapshot (
    id UUID PRIMARY KEY,
    code VARCHAR(120) NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    region_code VARCHAR(16) NOT NULL CHECK (region_code ~ '^[A-Z]{2,16}$'),
    mode_code VARCHAR(32) NOT NULL CHECK (mode_code ~ '^[A-Z][A-Z0-9_]*$'),
    mode_label VARCHAR(120) NOT NULL CHECK (length(btrim(mode_label)) > 0),
    period_label VARCHAR(120),
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source_time_zone VARCHAR(64) NOT NULL,
    source_run VARCHAR(200) NOT NULL CHECK (length(btrim(source_run)) > 0),
    source_note VARCHAR(2000),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by_issuer VARCHAR(255),
    confirmed_by_subject VARCHAR(255),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_issuer VARCHAR(255) NOT NULL,
    created_by_subject VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ranking_snapshot_confirmed_by CHECK ((confirmed_at IS NULL) = (confirmed_by_issuer IS NULL)
        AND (confirmed_at IS NULL) = (confirmed_by_subject IS NULL))
);

CREATE INDEX ranking_snapshot_recent_idx ON hero.ranking_snapshot (captured_at DESC, id);

CREATE TABLE hero.ranking_snapshot_image (
    snapshot_id UUID NOT NULL REFERENCES hero.ranking_snapshot (id) ON DELETE CASCADE,
    image_id VARCHAR(64) NOT NULL CHECK (image_id ~ '^[0-9a-f]{64}$'),
    board VARCHAR(16) NOT NULL CHECK (board IN ('RATES', 'FIGURES')),
    page_no INTEGER NOT NULL CHECK (page_no > 0),
    file_name VARCHAR(255) NOT NULL CHECK (length(btrim(file_name)) > 0),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    PRIMARY KEY (snapshot_id, image_id),
    CONSTRAINT ranking_snapshot_image_page UNIQUE (snapshot_id, board, page_no)
);

CREATE TABLE hero.ranking_snapshot_hero (
    snapshot_id UUID NOT NULL REFERENCES hero.ranking_snapshot (id) ON DELETE CASCADE,
    hero_id UUID NOT NULL REFERENCES hero.hero (id),
    name_on_screen VARCHAR(120) NOT NULL CHECK (length(btrim(name_on_screen)) > 0),
    role_on_screen VARCHAR(16) NOT NULL
        CHECK (role_on_screen IN ('TANK', 'WARRIOR', 'ASSASSIN', 'MAGE', 'MARKSMAN', 'SUPPORT')),
    rates_position INTEGER CHECK (rates_position > 0),
    figures_position INTEGER CHECK (figures_position > 0),
    PRIMARY KEY (snapshot_id, hero_id)
);

CREATE UNIQUE INDEX ranking_snapshot_hero_rates_position ON hero.ranking_snapshot_hero (snapshot_id, rates_position)
    WHERE rates_position IS NOT NULL;
CREATE UNIQUE INDEX ranking_snapshot_hero_figures_position
    ON hero.ranking_snapshot_hero (snapshot_id, figures_position) WHERE figures_position IS NOT NULL;

CREATE TABLE hero.ranking_snapshot_value (
    snapshot_id UUID NOT NULL,
    hero_id UUID NOT NULL,
    metric VARCHAR(16) NOT NULL CHECK (metric IN ('TIER', 'WIN_RATE', 'PICK_RATE', 'BAN_RATE', 'COUNTER_1',
        'COUNTER_2', 'COUNTER_3', 'DAMAGE_DEALT', 'KILLS', 'GOLD', 'DAMAGE_TAKEN', 'ASSISTS')),
    number_value NUMERIC(12, 2) CHECK (number_value >= 0),
    tier_value VARCHAR(8) CHECK (tier_value ~ '^T[0-9]$'),
    hero_value UUID REFERENCES hero.hero (id),
    read_text VARCHAR(40),
    needs_review BOOLEAN NOT NULL,
    note VARCHAR(1000),
    image_id VARCHAR(64),
    box_x INTEGER,
    box_y INTEGER,
    box_width INTEGER,
    box_height INTEGER,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_issuer VARCHAR(255),
    reviewed_by_subject VARCHAR(255),
    version BIGINT NOT NULL CHECK (version > 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (snapshot_id, hero_id, metric),
    FOREIGN KEY (snapshot_id, hero_id) REFERENCES hero.ranking_snapshot_hero (snapshot_id, hero_id) ON DELETE CASCADE,
    FOREIGN KEY (snapshot_id, image_id) REFERENCES hero.ranking_snapshot_image (snapshot_id, image_id)
        ON DELETE CASCADE,
    -- Each metric uses exactly one value column.
    CONSTRAINT ranking_snapshot_value_kind CHECK (CASE
        WHEN metric = 'TIER' THEN number_value IS NULL AND hero_value IS NULL
        WHEN metric IN ('COUNTER_1', 'COUNTER_2', 'COUNTER_3') THEN number_value IS NULL AND tier_value IS NULL
        ELSE tier_value IS NULL AND hero_value IS NULL END),
    CONSTRAINT ranking_snapshot_value_rate CHECK (metric NOT IN ('WIN_RATE', 'PICK_RATE', 'BAN_RATE')
        OR number_value <= 100),
    -- A gap can only leave review by entering a value.
    CONSTRAINT ranking_snapshot_value_present CHECK (needs_review OR number_value IS NOT NULL
        OR tier_value IS NOT NULL OR hero_value IS NOT NULL),
    CONSTRAINT ranking_snapshot_value_box CHECK ((image_id IS NULL) = (box_x IS NULL)
        AND (box_x IS NULL) = (box_y IS NULL) AND (box_y IS NULL) = (box_width IS NULL)
        AND (box_width IS NULL) = (box_height IS NULL)),
    CONSTRAINT ranking_snapshot_value_box_size CHECK (box_x IS NULL
        OR (box_x >= 0 AND box_y >= 0 AND box_width > 0 AND box_height > 0)),
    CONSTRAINT ranking_snapshot_value_reviewed_by CHECK ((reviewed_at IS NULL) = (reviewed_by_issuer IS NULL)
        AND (reviewed_at IS NULL) = (reviewed_by_subject IS NULL))
);

CREATE INDEX ranking_snapshot_value_review_idx ON hero.ranking_snapshot_value (snapshot_id) WHERE needs_review;
CREATE INDEX ranking_snapshot_value_hero_value_idx ON hero.ranking_snapshot_value (hero_value)
    WHERE hero_value IS NOT NULL;
