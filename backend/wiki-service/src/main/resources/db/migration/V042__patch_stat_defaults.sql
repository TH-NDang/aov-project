CREATE TABLE patch.stat_default (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES patch.patch_variant,
    stat_key VARCHAR(64) NOT NULL,
    base_value NUMERIC NOT NULL,
    unit VARCHAR(32) NOT NULL,
    source_url TEXT NOT NULL,
    version BIGINT NOT NULL,
    UNIQUE (variant_id, stat_key)
);

INSERT INTO patch.stat_default (id, variant_id, stat_key, base_value, unit, source_url, version)
SELECT gen_random_uuid(), v.id, 'CRITICAL_DAMAGE', 200, 'PERCENT',
       'https://www.arenaofvalor.com/webplat/info/news_version3/26190/26191/26192/27193/m16480/201710/643677.shtml', 1
FROM patch.patch_variant v
JOIN patch.game_patch p ON p.id = v.patch_id
JOIN patch.gameplay_ruleset r ON r.id = v.ruleset_id
WHERE p.code = '2026-10-30' AND r.code = 'aov-standard';
