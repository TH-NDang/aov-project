-- Recommended builds read from the game's "Chuan bi" screen (ADR-026). Arcana pages and enchantment sets are shared,
-- immutable values keyed by their content; items and the spell belong to each build. References to heroes, items,
-- arcana, enchantments and spells are logical UUIDs checked by their owning modules when written.
CREATE SCHEMA build;

CREATE TABLE build.capture (
    id UUID PRIMARY KEY,
    code VARCHAR(120) NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    region_code VARCHAR(16) NOT NULL CHECK (region_code ~ '^[A-Z]{2,16}$'),
    source_kind VARCHAR(16) NOT NULL CHECK (source_kind IN ('PRO', 'HOT', 'SYSTEM')),
    source_label VARCHAR(120) NOT NULL CHECK (length(btrim(source_label)) > 0),
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source_time_zone VARCHAR(64) NOT NULL,
    source_run VARCHAR(200) NOT NULL CHECK (length(btrim(source_run)) > 0),
    source_note VARCHAR(2000),
    patch_variant_id UUID REFERENCES patch.patch_variant (id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    confirmed_by_issuer VARCHAR(255),
    confirmed_by_subject VARCHAR(255),
    version BIGINT NOT NULL CHECK (version > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by_issuer VARCHAR(255) NOT NULL,
    created_by_subject VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT capture_confirmed_by CHECK ((confirmed_at IS NULL) = (confirmed_by_issuer IS NULL)
        AND (confirmed_at IS NULL) = (confirmed_by_subject IS NULL))
);

CREATE INDEX capture_recent_idx ON build.capture (captured_at DESC, id);
CREATE INDEX capture_public_idx ON build.capture (region_code, source_kind, captured_at DESC)
    WHERE confirmed_at IS NOT NULL;

CREATE TABLE build.capture_image (
    capture_id UUID NOT NULL REFERENCES build.capture (id) ON DELETE CASCADE,
    image_id VARCHAR(64) NOT NULL CHECK (image_id ~ '^[0-9a-f]{64}$'),
    file_name VARCHAR(255) NOT NULL CHECK (length(btrim(file_name)) > 0),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    layout VARCHAR(32) NOT NULL CHECK (layout IN ('PREPARE')),
    PRIMARY KEY (capture_id, image_id)
);

CREATE TABLE build.capture_hero (
    capture_id UUID NOT NULL REFERENCES build.capture (id) ON DELETE CASCADE,
    hero_id UUID NOT NULL,
    name_on_screen VARCHAR(120) NOT NULL CHECK (length(btrim(name_on_screen)) > 0),
    capture_order INTEGER NOT NULL CHECK (capture_order > 0),
    result VARCHAR(16) NOT NULL CHECK (result IN ('COLLECTED', 'NO_BUILDS', 'FAILED')),
    PRIMARY KEY (capture_id, hero_id),
    CONSTRAINT capture_hero_order UNIQUE (capture_id, capture_order)
);

CREATE INDEX capture_hero_hero_idx ON build.capture_hero (hero_id);

CREATE TABLE build.arcana_page (
    id UUID PRIMARY KEY,
    content_key VARCHAR(64) NOT NULL UNIQUE CHECK (content_key ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE build.arcana_page_entry (
    page_id UUID NOT NULL REFERENCES build.arcana_page (id) ON DELETE CASCADE,
    arcana_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    PRIMARY KEY (page_id, arcana_id)
);

CREATE TABLE build.enchantment_set (
    id UUID PRIMARY KEY,
    content_key VARCHAR(64) NOT NULL UNIQUE CHECK (content_key ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Slots 1-3 hold the primary branch in tier order; slots 4-5 hold the secondary picks in screen order.
CREATE TABLE build.enchantment_set_entry (
    set_id UUID NOT NULL REFERENCES build.enchantment_set (id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
    enchantment_id UUID NOT NULL,
    PRIMARY KEY (set_id, slot),
    CONSTRAINT enchantment_set_entry_unique UNIQUE (set_id, enchantment_id)
);

CREATE TABLE build.build (
    id UUID PRIMARY KEY,
    capture_id UUID NOT NULL,
    hero_id UUID NOT NULL,
    list_position INTEGER NOT NULL CHECK (list_position BETWEEN 1 AND 50),
    player_name VARCHAR(80),
    player_power INTEGER CHECK (player_power >= 0),
    player_win_rate NUMERIC(5, 2) CHECK (player_win_rate BETWEEN 0 AND 100),
    spell_id UUID,
    arcana_page_id UUID REFERENCES build.arcana_page (id),
    enchantment_set_id UUID REFERENCES build.enchantment_set (id),
    content_key VARCHAR(64) CHECK (content_key ~ '^[0-9a-f]{64}$'),
    image_id VARCHAR(64),
    needs_review BOOLEAN NOT NULL,
    note VARCHAR(1000),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_issuer VARCHAR(255),
    reviewed_by_subject VARCHAR(255),
    version BIGINT NOT NULL CHECK (version > 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY (capture_id, hero_id) REFERENCES build.capture_hero (capture_id, hero_id) ON DELETE CASCADE,
    FOREIGN KEY (capture_id, image_id) REFERENCES build.capture_image (capture_id, image_id) ON DELETE CASCADE,
    CONSTRAINT build_list_position UNIQUE (capture_id, hero_id, list_position),
    -- A build leaves review only when its items, enchantments and spell are known; the arcana page is optional.
    CONSTRAINT build_complete CHECK (needs_review OR (spell_id IS NOT NULL AND enchantment_set_id IS NOT NULL
        AND content_key IS NOT NULL)),
    CONSTRAINT build_reviewed_by CHECK ((reviewed_at IS NULL) = (reviewed_by_issuer IS NULL)
        AND (reviewed_at IS NULL) = (reviewed_by_subject IS NULL))
);

CREATE INDEX build_hero_idx ON build.build (hero_id, capture_id);
CREATE INDEX build_arcana_page_idx ON build.build (arcana_page_id);
CREATE INDEX build_enchantment_set_idx ON build.build (enchantment_set_id);
CREATE INDEX build_content_key_idx ON build.build (content_key) WHERE content_key IS NOT NULL;
CREATE INDEX build_review_idx ON build.build (capture_id) WHERE needs_review;

CREATE TABLE build.build_item (
    build_id UUID NOT NULL REFERENCES build.build (id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 6),
    item_id UUID NOT NULL,
    PRIMARY KEY (build_id, slot)
);

CREATE INDEX build_item_item_idx ON build.build_item (item_id);
