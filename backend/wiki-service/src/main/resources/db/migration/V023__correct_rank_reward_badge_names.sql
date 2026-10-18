-- Correct imported rank-reward labels without replacing custom names or other locales.
WITH corrected AS (
    UPDATE hero.skin_badge_group_translation t
    SET display_name = 'Thưởng hạng'
    FROM hero.skin_badge_group g
    WHERE t.group_id = g.id AND g.code = 'theme-thuong-hang'
        AND t.locale = 'vi-VN' AND t.display_name = 'Thượng hạng'
    RETURNING t.group_id
)
UPDATE hero.skin_badge_group g
SET version = g.version + 1, updated_at = now()
WHERE g.id IN (SELECT group_id FROM corrected);

WITH corrected AS (
    UPDATE hero.skin_badge_translation t
    SET display_name = replace(t.display_name, 'Thượng hạng', 'Thưởng hạng')
    FROM hero.skin_badge b
    WHERE t.badge_id = b.id
        AND b.code ~ '^(s[0-9]+-)?thuong-hang(-[0-9]{4})?-vn-[1-9][0-9]*$'
        AND t.locale = 'vi-VN'
        AND t.display_name ~ '^(S[0-9]+ )?Thượng hạng( [0-9]{4})?$'
    RETURNING t.badge_id
)
UPDATE hero.skin_badge b
SET version = b.version + 1, updated_at = now()
WHERE b.id IN (SELECT badge_id FROM corrected);
