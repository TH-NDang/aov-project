-- A skill keeps its text and numbers while some states only swap its icon, e.g. Billow's sea monster form.
CREATE TABLE hero.skill_state_icon (
    skill_set_revision_id UUID NOT NULL,
    skill_key VARCHAR(64) NOT NULL,
    icon_order INTEGER NOT NULL CHECK (icon_order BETWEEN 0 AND 9),
    asset_id UUID NOT NULL,
    label VARCHAR(64) NOT NULL CHECK (btrim(label) <> ''),
    PRIMARY KEY (skill_set_revision_id, skill_key, icon_order),
    UNIQUE (skill_set_revision_id, skill_key, asset_id),
    FOREIGN KEY (skill_set_revision_id, skill_key) REFERENCES hero.hero_skill_snapshot
);
CREATE INDEX ix_skill_state_icon_asset ON hero.skill_state_icon(asset_id);
CREATE TRIGGER trg_skill_state_icon_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.skill_state_icon
    FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skill_set_revision','skill_set_revision_id');
