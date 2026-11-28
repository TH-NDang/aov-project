-- Every page a hero change was recorded from becomes one of its patch's shared links (owner, 2026-11-28): a patch names
-- its official notes once, and Admin no longer shows a link per hero. Each distinct address is added once, after the
-- links the patch already keeps, in the order the changes were first recorded, up to the ten links a patch holds. The
-- hero change sets keep their column as it is; the public patch and hero pages read the patch's links first.
WITH recorded AS (
    SELECT patch_variant_id AS variant_id, btrim(source_url) AS url, min(created_at) AS first_seen
    FROM hero.hero_patch_change_set
    WHERE source_kind = 'PATCH_NOTES'
      AND source_url IS NOT NULL
      AND btrim(source_url) ~* '^https?://'
      AND length(btrim(source_url)) <= 2048
    GROUP BY patch_variant_id, btrim(source_url)
), fresh AS (
    SELECT r.variant_id, r.url,
           row_number() OVER (PARTITION BY r.variant_id ORDER BY r.first_seen, r.url) AS n,
           (SELECT count(*) FROM patch.variant_source s WHERE s.variant_id = r.variant_id) AS kept,
           (SELECT coalesce(max(s.position) + 1, 0) FROM patch.variant_source s WHERE s.variant_id = r.variant_id)
               AS next_position,
           lower(substring(r.url FROM '^[a-zA-Z]+://(?:www\.)?([^/:?#]+)')) AS host
    FROM recorded r
    WHERE NOT EXISTS (SELECT 1 FROM patch.variant_source s WHERE s.variant_id = r.variant_id AND s.url = r.url)
)
INSERT INTO patch.variant_source (id, variant_id, position, url, label, locale)
SELECT gen_random_uuid(), variant_id, next_position + n - 1, url,
       CASE
           WHEN host = 'lienquan.garena.vn' OR host LIKE '%.lienquan.garena.vn' THEN 'Việt Nam'
           WHEN (host = 'rov.in.th' OR host LIKE '%.rov.in.th') AND url ~* 'expserver' THEN 'Thái Lan · Thử nghiệm'
           WHEN host = 'rov.in.th' OR host LIKE '%.rov.in.th' THEN 'Thái Lan'
           WHEN host = 'exp.moba.garena.tw' THEN 'Đài Loan · Thử nghiệm'
           WHEN host = 'moba.garena.tw' OR host LIKE '%.moba.garena.tw' THEN 'Đài Loan'
           WHEN host LIKE '%aov.garena.co.id' THEN 'Indonesia'
           ELSE left(coalesce(nullif(host, ''), 'Nguồn'), 80)
       END,
       CASE
           WHEN host = 'lienquan.garena.vn' OR host LIKE '%.lienquan.garena.vn' THEN 'vi-VN'
           WHEN host = 'rov.in.th' OR host LIKE '%.rov.in.th' THEN 'th-TH'
           WHEN host LIKE '%moba.garena.tw' THEN 'zh-TW'
           -- Indonesia posts its notes in English too, as an address ending in "en".
           WHEN host LIKE '%aov.garena.co.id' AND url ~* '(-|[0-9])en/?$' THEN 'en'
           WHEN host LIKE '%aov.garena.co.id' THEN 'id-ID'
       END
FROM fresh
WHERE kept + n <= 10;
