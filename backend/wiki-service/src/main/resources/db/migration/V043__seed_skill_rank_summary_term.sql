WITH added AS (
    INSERT INTO terminology.entry (id, reference_key, kind, auto_match, display_order)
    SELECT gen_random_uuid(), 'thong-so-theo-cap-chieu', 'term', false, COALESCE(MAX(display_order), -1) + 1
    FROM terminology.entry
    ON CONFLICT (kind, reference_key) DO NOTHING
    RETURNING id
), translated AS (
    INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases)
    SELECT gen_random_uuid(), id, 'vi-VN', 'Thông số theo cấp chiêu',
           'Số đầu là giá trị ở cấp 1. Mỗi lần nâng chiêu, cộng (+) hoặc trừ (−) một lần lượng ghi trong ngoặc.

125 (+25/cấp chiêu): cấp 1 là 125, cấp 2 là 150, cấp 3 là 175.
15% (+3%/cấp chiêu): cấp 1 là 15%, cấp 2 là 18%, cấp 3 là 21%.

Nếu mức tăng hoặc giảm không đều, các giá trị được liệt kê theo thứ tự cấp, ngăn cách bằng dấu /.', '[]'::jsonb
    FROM added
    RETURNING entry_id
)
UPDATE terminology.configuration
SET version = version + 1, updated_at = now()
WHERE EXISTS (SELECT 1 FROM translated);
