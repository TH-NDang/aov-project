"""Generate the reviewed, finite identifier migration from the resource rename plan."""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
plan = json.loads((HERE / "canonical-identifiers.json").read_text(encoding="utf-8"))


def quoted(value):
    return "'" + value.replace("'", "''") + "'"


def values(rows):
    return ",\n".join("(" + ",".join(quoted(value) for value in row) + ")" for row in rows)


sql = """-- Identifier-only migration; published gameplay, translations and asset UUIDs stay unchanged.
CREATE TABLE hero.hero_code_alias (
    legacy_code VARCHAR(64) PRIMARY KEY,
    hero_id UUID NOT NULL REFERENCES hero.hero
);
CREATE TABLE hero.skin_key_alias (
    id UUID PRIMARY KEY,
    hero_id UUID NOT NULL REFERENCES hero.hero,
    legacy_key VARCHAR(64) NOT NULL,
    skin_key VARCHAR(64) NOT NULL,
    UNIQUE(hero_id,legacy_key)
);
CREATE TABLE hero.skin_badge_code_alias (
    legacy_code VARCHAR(64) PRIMARY KEY,
    badge_id UUID NOT NULL REFERENCES hero.skin_badge
);
CREATE TEMP TABLE canonical_heroes(old_code TEXT PRIMARY KEY,new_code TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO canonical_heroes VALUES
""" + values(plan["heroes"].items()) + ";\n" + """
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM canonical_heroes m JOIN hero.hero old ON old.code=m.old_code
        JOIN hero.hero target ON target.code=m.new_code AND target.id<>old.id) THEN
        RAISE EXCEPTION 'Canonical hero code is already owned by another hero';
    END IF;
END $$;
INSERT INTO hero.hero_code_alias SELECT m.old_code,h.id FROM hero.hero h JOIN canonical_heroes m ON h.code=m.old_code;
UPDATE hero.hero h SET code=m.new_code FROM canonical_heroes m WHERE h.code=m.old_code;
CREATE TEMP TABLE canonical_skins(hero_code TEXT,old_key TEXT,new_key TEXT,PRIMARY KEY(hero_code,old_key)) ON COMMIT DROP;
INSERT INTO canonical_skins VALUES
""" + values((plan["heroes"].get(row["hero"], row["hero"]), row["old"], row["code"]) for row in plan["skins"]) + ";\n" + """
CREATE TEMP TABLE skin_renames ON COMMIT DROP AS
SELECT h.id AS hero_id,s.skin_key AS old_key,m.new_key,'rename-'||gen_random_uuid() AS temporary_key
FROM hero.hero_skin s JOIN hero.hero h ON h.id=s.hero_id
JOIN canonical_skins m ON m.hero_code=h.code AND m.old_key=s.skin_key WHERE s.skin_key<>m.new_key;
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM skin_renames m JOIN hero.hero_skin s ON s.hero_id=m.hero_id AND s.skin_key=m.new_key
        WHERE NOT EXISTS(SELECT 1 FROM skin_renames other WHERE other.hero_id=s.hero_id AND other.old_key=s.skin_key)) THEN
        RAISE EXCEPTION 'Canonical skin key is already owned by another skin';
    END IF;
END $$;
INSERT INTO hero.skin_key_alias SELECT gen_random_uuid(),hero_id,old_key,new_key FROM skin_renames;

-- Cascades rename only identity columns, including references in published snapshots.
DO $$ DECLARE fk RECORD; BEGIN
    FOR fk IN SELECT conname FROM pg_constraint WHERE conrelid='hero.hero_skin_snapshot'::regclass
        AND confrelid='hero.hero_skin'::regclass LOOP
        EXECUTE format('ALTER TABLE hero.hero_skin_snapshot DROP CONSTRAINT %I',fk.conname);
    END LOOP;
    FOR fk IN SELECT conrelid::regclass AS child,conname FROM pg_constraint
        WHERE conrelid IN ('hero.hero_skin_translation'::regclass,'hero.skin_image_option'::regclass)
        AND confrelid='hero.hero_skin_snapshot'::regclass LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',fk.child,fk.conname);
    END LOOP;
END $$;
ALTER TABLE hero.hero_skin_snapshot ADD CONSTRAINT fk_skin_identity FOREIGN KEY(hero_id,skin_key)
    REFERENCES hero.hero_skin(hero_id,skin_key) ON UPDATE CASCADE;
ALTER TABLE hero.hero_skin_translation ADD CONSTRAINT fk_skin_translation_snapshot FOREIGN KEY(skin_set_revision_id,skin_key)
    REFERENCES hero.hero_skin_snapshot(skin_set_revision_id,skin_key) ON UPDATE CASCADE;
ALTER TABLE hero.skin_image_option ADD CONSTRAINT fk_skin_image_snapshot FOREIGN KEY(skin_set_revision_id,skin_key)
    REFERENCES hero.hero_skin_snapshot(skin_set_revision_id,skin_key) ON UPDATE CASCADE;
ALTER TABLE hero.hero_skin_snapshot DISABLE TRIGGER trg_hero_skin_snapshot_immutable;
ALTER TABLE hero.hero_skin_translation DISABLE TRIGGER trg_hero_skin_translation_immutable;
ALTER TABLE hero.skin_image_option DISABLE TRIGGER trg_skin_image_option_immutable;
ALTER TABLE hero.hero_image_option DISABLE TRIGGER trg_hero_image_option_immutable;
UPDATE hero.hero_skin s SET skin_key=m.temporary_key FROM skin_renames m WHERE s.hero_id=m.hero_id AND s.skin_key=m.old_key;
UPDATE hero.hero_skin s SET skin_key=m.new_key FROM skin_renames m WHERE s.hero_id=m.hero_id AND s.skin_key=m.temporary_key;
ALTER TABLE hero.skin_key_alias ADD CONSTRAINT fk_skin_alias_identity FOREIGN KEY(hero_id,skin_key)
    REFERENCES hero.hero_skin(hero_id,skin_key) ON UPDATE CASCADE;

CREATE TEMP TABLE canonical_badges(old_code TEXT PRIMARY KEY,new_code TEXT NOT NULL,display_name TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO canonical_badges VALUES
""" + values((row["old"], row["code"], row["name"]) for row in plan["badges"]) + ";\n" + """
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM canonical_badges m JOIN hero.skin_badge old ON old.code=m.old_code
        JOIN hero.skin_badge target ON target.code=m.new_code AND target.id<>old.id) THEN
        RAISE EXCEPTION 'Canonical badge code is already owned by another badge';
    END IF;
END $$;
INSERT INTO hero.skin_badge_code_alias SELECT m.old_code,b.id FROM hero.skin_badge b JOIN canonical_badges m ON b.code=m.old_code;
UPDATE hero.hero_skin_snapshot s SET rarity_code=m.new_code FROM canonical_badges m WHERE s.rarity_code=m.old_code;
UPDATE hero.skin_badge_translation t SET display_name=m.display_name
FROM hero.skin_badge b,canonical_badges m WHERE t.badge_id=b.id AND b.code=m.old_code
    AND t.locale='vi-VN' AND t.display_name=m.old_code;
UPDATE hero.skin_badge b SET code=m.new_code,version=b.version+1,updated_at=now()
FROM canonical_badges m WHERE b.code=m.old_code;

CREATE TEMP TABLE canonical_files(old_path TEXT PRIMARY KEY,new_path TEXT NOT NULL) ON COMMIT DROP;
INSERT INTO canonical_files VALUES
""" + values((row["old"], row["path"]) for row in plan["files"]) + ";\n" + """
CREATE TABLE hero.image_file_alias (
    asset_id UUID PRIMARY KEY,
    legacy_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL
);
INSERT INTO hero.image_file_alias
SELECT DISTINCT ON(p.asset_id) p.asset_id,regexp_replace(f.old_path,'^.*/',''),regexp_replace(f.new_path,'^.*/','')
FROM media.media_provenance p JOIN canonical_files f ON replace(p.note,'/__resources/','')=f.old_path
JOIN media.media_asset a ON a.id=p.asset_id
WHERE a.semantic_type IN ('HERO_HEAD','HERO_PORTRAIT','HERO_SPLASH','HERO_SKIN_ART','HERO_SKILL_ICON','SKIN_BADGE')
ORDER BY p.asset_id,p.created_at,p.id;
UPDATE hero.hero_image_option o SET label=f.file_name FROM hero.image_file_alias f WHERE o.asset_id=f.asset_id;
UPDATE hero.skin_image_option o SET label=f.file_name FROM hero.image_file_alias f WHERE o.asset_id=f.asset_id;
-- Stored immutable UUID object keys and original provenance remain intact.
UPDATE media.media_upload_session u SET file_name=f.file_name FROM hero.image_file_alias f
WHERE u.asset_id=f.asset_id AND u.file_name IS NOT NULL;
ALTER TABLE hero.hero_skin_snapshot ENABLE TRIGGER trg_hero_skin_snapshot_immutable;
ALTER TABLE hero.hero_skin_translation ENABLE TRIGGER trg_hero_skin_translation_immutable;
ALTER TABLE hero.skin_image_option ENABLE TRIGGER trg_skin_image_option_immutable;
ALTER TABLE hero.hero_image_option ENABLE TRIGGER trg_hero_image_option_immutable;
"""
target = ROOT / "backend/wiki-service/src/main/resources/db/migration/V019__canonical_character_identifiers.sql"
if target.exists():
    raise SystemExit("The migration already exists; corrections require a new migration.")
target.write_text(sql, encoding="utf-8")
print(f"Generated {target.name}: {len(sql)} characters")
