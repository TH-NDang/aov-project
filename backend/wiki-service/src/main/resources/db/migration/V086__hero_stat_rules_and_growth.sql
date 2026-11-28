-- A hero's stats do rise with its level (owner, 2026-11-28): V075 had dropped the column on the wrong reading that the
-- attribute screen never changes. The level 1 value stays in base_value; the rise per level is optional.
ALTER TABLE hero.hero_combat_stat_value
    ADD COLUMN growth_per_level NUMERIC,
    ADD CONSTRAINT hero_combat_stat_value_growth_check CHECK (growth_per_level IS NULL OR growth_per_level >= 0);

-- What every hero shares for one stat, whatever the patch (owner, 2026-11-28): the level 1 value all heroes start
-- with, how much it rises per level, and the most the stat can reach in a match. A hero keeps its own value only
-- where it differs. Replaces the per-patch patch.stat_default (V042).
CREATE TABLE hero.stat_rule (
    id UUID PRIMARY KEY,
    stat_key VARCHAR(64) NOT NULL UNIQUE CHECK (stat_key ~ '^[A-Z][A-Z0-9_]{0,63}$'),
    unit VARCHAR(32) NOT NULL CHECK (unit IN ('POINT', 'PERCENT')),
    base_value NUMERIC,
    percent_value NUMERIC CHECK (percent_value IS NULL OR (base_value IS NOT NULL AND percent_value BETWEEN 0 AND 100)),
    growth_per_level NUMERIC CHECK (growth_per_level IS NULL OR growth_per_level >= 0),
    cap_value NUMERIC CHECK (cap_value IS NULL OR cap_value > 0),
    source_url TEXT CHECK (source_url IS NULL OR (length(source_url) <= 2048 AND source_url ~* '^https?://')),
    version BIGINT NOT NULL CHECK (version > 0),
    updated_at TIMESTAMPTZ NOT NULL,
    CHECK (base_value IS NOT NULL OR growth_per_level IS NOT NULL OR cap_value IS NOT NULL)
);

-- The newest default each stat had in a published patch (else in any patch) carries over with its source.
INSERT INTO hero.stat_rule (id, stat_key, unit, base_value, source_url, version, updated_at)
SELECT DISTINCT ON (d.stat_key) gen_random_uuid(), d.stat_key, d.unit, d.base_value, d.source_url, 1, now()
FROM patch.stat_default d
JOIN patch.patch_variant v ON v.id = d.variant_id
WHERE d.unit IN ('POINT', 'PERCENT')
ORDER BY d.stat_key, (v.status = 'PUBLISHED') DESC, v.ruleset_ordinal DESC;

-- Values every one of the 128 heroes recorded on 2026-11-28 shares at level 1, and the caps the game's academy site
-- names (https://hocvien.lienquan.garena.vn/bai-viet/25069). A stat carried over above keeps its value.
INSERT INTO hero.stat_rule (id, stat_key, unit, base_value, percent_value, cap_value, source_url, version, updated_at)
VALUES
    (gen_random_uuid(), 'ABILITY_POWER', 'POINT', 0, NULL, NULL, NULL, 1, now()),
    (gen_random_uuid(), 'ARMOR_PIERCE', 'POINT', 0, 0, NULL, NULL, 1, now()),
    (gen_random_uuid(), 'MAGIC_PIERCE', 'POINT', 0, 0, NULL, NULL, 1, now()),
    (gen_random_uuid(), 'MAGIC_DEFENSE', 'POINT', 80, 0, NULL, NULL, 1, now()),
    (gen_random_uuid(), 'BONUS_ATTACK_SPEED', 'PERCENT', 0, NULL, 200, 'https://hocvien.lienquan.garena.vn/bai-viet/25069', 1, now()),
    (gen_random_uuid(), 'COOLDOWN_REDUCTION', 'PERCENT', 0, NULL, 40, 'https://hocvien.lienquan.garena.vn/bai-viet/25069', 1, now()),
    (gen_random_uuid(), 'CRITICAL_CHANCE', 'PERCENT', 0, NULL, 100, NULL, 1, now()),
    (gen_random_uuid(), 'CRITICAL_DAMAGE', 'PERCENT', 200, NULL, NULL, NULL, 1, now()),
    (gen_random_uuid(), 'PHYSICAL_LIFESTEAL', 'PERCENT', 0, NULL, NULL, NULL, 1, now()),
    (gen_random_uuid(), 'MAGIC_LIFESTEAL', 'PERCENT', 0, NULL, NULL, NULL, 1, now()),
    (gen_random_uuid(), 'MOVEMENT_SPEED', 'POINT', NULL, NULL, 800, 'https://hocvien.lienquan.garena.vn/bai-viet/25069', 1, now())
ON CONFLICT (stat_key) DO NOTHING;

-- A carried-over stat still takes the cap the academy names.
UPDATE hero.stat_rule r
SET cap_value = c.cap
FROM (VALUES ('BONUS_ATTACK_SPEED', 200), ('COOLDOWN_REDUCTION', 40), ('CRITICAL_CHANCE', 100), ('MOVEMENT_SPEED', 800))
         AS c(stat_key, cap)
WHERE r.stat_key = c.stat_key AND r.cap_value IS NULL;

DROP TABLE patch.stat_default;
