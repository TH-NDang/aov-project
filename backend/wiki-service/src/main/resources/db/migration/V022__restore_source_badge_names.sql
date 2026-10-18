-- Restore the source prefix only for labels produced by the identifier migration.
WITH source_names(legacy_code, previous_name, display_name) AS (
    VALUES
        ('bac-a-mau-01', 'A', 'Bậc A'),
        ('bac-a-mau-02', 'A', 'Bậc A'),
        ('bac-s', 'S', 'Bậc S'),
        ('bac-s-plus-mau-01', 'S+', 'Bậc S+'),
        ('bac-s-plus-mau-02', 'S+', 'Bậc S+'),
        ('bac-ss-mau-01', 'SS', 'Bậc SS'),
        ('bac-ss-mau-02', 'SS', 'Bậc SS')
), restored AS (
    UPDATE hero.skin_badge_translation t
    SET display_name = s.display_name
    FROM hero.skin_badge_code_alias a, source_names s
    WHERE a.legacy_code = s.legacy_code
        AND t.badge_id = a.badge_id
        AND t.locale = 'vi-VN'
        AND t.display_name IN (s.previous_name, s.legacy_code)
    RETURNING t.badge_id
)
UPDATE hero.skin_badge b
SET version = b.version + 1, updated_at = now()
WHERE b.id IN (SELECT badge_id FROM restored);
