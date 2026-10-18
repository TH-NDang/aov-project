CREATE TABLE hero.skin_badge_group (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('RANK','THEME')),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE hero.skin_badge_group_translation (
    group_id UUID NOT NULL REFERENCES hero.skin_badge_group(id),
    locale VARCHAR(16) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (group_id, locale)
);
ALTER TABLE hero.skin_badge ADD COLUMN group_id UUID REFERENCES hero.skin_badge_group(id);
CREATE INDEX ix_skin_badge_group ON hero.skin_badge(group_id);

INSERT INTO hero.skin_badge_group(id,code,kind,created_at,updated_at)
SELECT gen_random_uuid(),code,kind,now(),now()
FROM (VALUES
    ('rank-a','RANK'),('rank-s','RANK'),('rank-s-plus','RANK'),('rank-ss','RANK'),
    ('rank-ss-plus','RANK'),('rank-sss','RANK'),('rank-sss-plus','RANK'),
    ('theme-aic','THEME'),('theme-apl','THEME'),('theme-aov-day','THEME'),
    ('theme-thuong-hang','THEME'),('theme-so-su-menh','THEME'),('theme-dimension-breaker','THEME'),
    ('theme-wave','THEME'),('theme-tan-xuan','THEME'),('theme-valentine','THEME'),('theme-aog','THEME')
) AS seeds(code,kind);

INSERT INTO hero.skin_badge_group_translation(group_id,locale,display_name)
SELECT g.id,'vi-VN',seeds.display_name
FROM hero.skin_badge_group g
JOIN (VALUES
    ('rank-a','A'),('rank-s','S'),('rank-s-plus','S+'),('rank-ss','SS'),
    ('rank-ss-plus','SS+'),('rank-sss','SSS'),('rank-sss-plus','SSS+'),
    ('theme-aic','AIC'),('theme-apl','APL'),('theme-aov-day','AOV Day'),
    ('theme-thuong-hang','Thượng hạng'),('theme-so-su-menh','Sổ sứ mệnh'),
    ('theme-dimension-breaker','Dimension Breaker'),('theme-wave','Wave'),
    ('theme-tan-xuan','Tân xuân'),('theme-valentine','Valentine'),('theme-aog','AOG')
) AS seeds(code,display_name) ON seeds.code=g.code;

-- These editable display groups follow literal source code families, without changing badge classification.
WITH families AS (
    SELECT id,CASE
        WHEN code ~ '^aic-[0-9]{4}$' THEN 'theme-aic'
        WHEN code ~ '^apl-[0-9]{4}$' THEN 'theme-apl'
        WHEN code ~ '^((a|s|ss|sss)(-plus)?-)?aovday(-[0-9]{4})?(-mau-[0-9]+)?$' THEN 'theme-aov-day'
        WHEN code ~ '^(s[0-9]+-)?thuong-hang(-[0-9]{4})?$' THEN 'theme-thuong-hang'
        WHEN code ~ '^so-su-menh-[0-9]+$' THEN 'theme-so-su-menh'
        WHEN code ~ '^dimension-breaker-mau-[0-9]+$' THEN 'theme-dimension-breaker'
        WHEN code ~ '^wave-mau-[0-9]+$' THEN 'theme-wave'
        WHEN code ~ '^(tan-xuan-mau-[0-9]+|tuyet-sac-tan-xuan)$' THEN 'theme-tan-xuan'
        WHEN code ~ '^valentine-mau-[0-9]+$' THEN 'theme-valentine'
        WHEN code ~ '^aog-mau-[0-9]+$' THEN 'theme-aog'
        WHEN code ~ '^(bac-)?sss-plus(-|$)' THEN 'rank-sss-plus'
        WHEN code ~ '^(bac-)?sss(-|$)' THEN 'rank-sss'
        WHEN code ~ '^(bac-)?ss-plus(-|$)' THEN 'rank-ss-plus'
        WHEN code ~ '^(bac-)?ss(-|$)' THEN 'rank-ss'
        WHEN code ~ '^(bac-)?s-plus(-|$)' THEN 'rank-s-plus'
        WHEN code ~ '^(bac-)?s(-|$)' THEN 'rank-s'
        WHEN code ~ '^(bac-)?a(-|$)' THEN 'rank-a'
    END AS group_code
    FROM hero.skin_badge
)
UPDATE hero.skin_badge badge
SET group_id=groups.id,version=badge.version+1,updated_at=now()
FROM families
JOIN hero.skin_badge_group groups ON groups.code=families.group_code
WHERE badge.id=families.id;
