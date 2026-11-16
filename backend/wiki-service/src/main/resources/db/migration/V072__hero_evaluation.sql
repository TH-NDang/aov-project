-- Hero evaluation (ADR-029). Traits are yes/no facts an editor confirms from the skill kit, so they live in the skill
-- set revision and are copied, published and read per patch together with the skills.
CREATE TABLE hero.hero_skill_trait (
    skill_set_revision_id UUID NOT NULL REFERENCES hero.hero_skill_set_revision(id),
    trait_code VARCHAR(32) NOT NULL CHECK (trait_code IN (
        'TRUE_DAMAGE', 'PERCENT_HP_DAMAGE', 'MISSING_HP_DAMAGE', 'ARMOR_SHRED',
        'DASH', 'WALL_CROSS', 'UNTARGETABLE', 'STEALTH', 'GLOBAL',
        'CC_IMMUNE', 'CLEANSE', 'SELF_HEAL', 'SHIELD', 'DAMAGE_REDUCTION', 'REVIVE',
        'HARD_CC', 'DISPLACE', 'SILENCE',
        'ALLY_HEAL', 'ALLY_SHIELD', 'ALLY_BUFF', 'VISION')),
    PRIMARY KEY (skill_set_revision_id, trait_code)
);
CREATE INDEX ix_hero_skill_trait_code ON hero.hero_skill_trait(trait_code);
CREATE TRIGGER trg_hero_skill_trait_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_skill_trait
    FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skill_set_revision','skill_set_revision_id');

-- The skills a trait comes from; the foreign key keeps a trait from naming a skill the same revision lacks.
CREATE TABLE hero.hero_skill_trait_skill (
    skill_set_revision_id UUID NOT NULL,
    trait_code VARCHAR(32) NOT NULL,
    skill_key VARCHAR(64) NOT NULL,
    PRIMARY KEY (skill_set_revision_id, trait_code, skill_key),
    FOREIGN KEY (skill_set_revision_id, trait_code) REFERENCES hero.hero_skill_trait,
    FOREIGN KEY (skill_set_revision_id, skill_key) REFERENCES hero.hero_skill_snapshot
);
CREATE TRIGGER trg_hero_skill_trait_skill_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_skill_trait_skill
    FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skill_set_revision','skill_set_revision_id');

-- One line per locale saying how the trait shows, e.g. which skill grants crowd control immunity and for how long.
CREATE TABLE hero.hero_skill_trait_translation (
    skill_set_revision_id UUID NOT NULL,
    trait_code VARCHAR(32) NOT NULL,
    locale VARCHAR(16) NOT NULL,
    detail VARCHAR(300) NOT NULL CHECK (btrim(detail) <> ''),
    PRIMARY KEY (skill_set_revision_id, trait_code, locale),
    FOREIGN KEY (skill_set_revision_id, trait_code) REFERENCES hero.hero_skill_trait
);
CREATE TRIGGER trg_hero_skill_trait_translation_immutable BEFORE INSERT OR UPDATE OR DELETE
    ON hero.hero_skill_trait_translation
    FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_skill_set_revision','skill_set_revision_id');

-- Editor-written notes beside the hero's name and lore. NULL means nothing has been written for that locale.
ALTER TABLE hero.hero_profile_translation
    ADD COLUMN strengths VARCHAR(4000) CHECK (strengths IS NULL OR btrim(strengths) <> ''),
    ADD COLUMN weaknesses VARCHAR(4000) CHECK (weaknesses IS NULL OR btrim(weaknesses) <> ''),
    ADD COLUMN counter_tips VARCHAR(4000) CHECK (counter_tips IS NULL OR btrim(counter_tips) <> '');
