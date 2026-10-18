ALTER TABLE hero.hero_skin_snapshot ADD COLUMN head_asset_id UUID;
ALTER TABLE hero.hero_skin_snapshot ADD COLUMN portrait_asset_id UUID;
CREATE INDEX ix_hero_skin_head_asset ON hero.hero_skin_snapshot(head_asset_id);
CREATE INDEX ix_hero_skin_portrait_asset ON hero.hero_skin_snapshot(portrait_asset_id);

CREATE TABLE hero.hero_image_option (
    media_binding_revision_id UUID NOT NULL REFERENCES hero.hero_media_binding_revision,
    media_role VARCHAR(16) NOT NULL CHECK (media_role IN ('HEAD','PORTRAIT','SPLASH')),
    image_order INTEGER NOT NULL CHECK (image_order BETWEEN 0 AND 199),
    asset_id UUID NOT NULL,
    label VARCHAR(255),
    PRIMARY KEY (media_binding_revision_id, media_role, image_order),
    UNIQUE (media_binding_revision_id, media_role, asset_id)
);
CREATE INDEX ix_hero_image_option_asset ON hero.hero_image_option(asset_id);
CREATE TRIGGER trg_hero_image_option_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_image_option
    FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_media_binding_revision','media_binding_revision_id');

CREATE TABLE hero.skin_image_option (
    skin_set_revision_id UUID NOT NULL,
    skin_key VARCHAR(64) NOT NULL,
    media_role VARCHAR(16) NOT NULL CHECK (media_role IN ('HEAD','PORTRAIT','SPLASH')),
    image_order INTEGER NOT NULL CHECK (image_order BETWEEN 0 AND 199),
    asset_id UUID NOT NULL,
    label VARCHAR(255),
    PRIMARY KEY (skin_set_revision_id, skin_key, media_role, image_order),
    UNIQUE (skin_set_revision_id, skin_key, media_role, asset_id),
    FOREIGN KEY (skin_set_revision_id, skin_key) REFERENCES hero.hero_skin_snapshot
);
CREATE INDEX ix_skin_image_option_asset ON hero.skin_image_option(asset_id);
CREATE TRIGGER trg_skin_image_option_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.skin_image_option
    FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skin_set_revision','skin_set_revision_id');

CREATE TABLE hero.skin_badge (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('UNKNOWN','RARITY','EVENT')),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE hero.skin_badge_translation (
    badge_id UUID NOT NULL REFERENCES hero.skin_badge(id),
    locale VARCHAR(16) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    icon_asset_id UUID,
    PRIMARY KEY (badge_id, locale)
);
CREATE INDEX ix_skin_badge_icon ON hero.skin_badge_translation(icon_asset_id);
INSERT INTO hero.skin_badge(id,code,kind,created_at,updated_at)
    SELECT gen_random_uuid(),code,'UNKNOWN',now(),now()
    FROM (SELECT DISTINCT rarity_code AS code FROM hero.hero_skin_snapshot WHERE rarity_code IS NOT NULL) codes;
