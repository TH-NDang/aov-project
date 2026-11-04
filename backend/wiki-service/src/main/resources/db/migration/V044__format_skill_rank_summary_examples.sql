-- Only upgrade the original Vietnamese definition; keep any editorial changes.
WITH changed AS (
    UPDATE terminology.translation t
    SET description = '<info>Số đầu là giá trị ở cấp 1. Mỗi lần nâng chiêu, cộng (+) hoặc trừ (−) một lần lượng ghi trong ngoặc.</info>
<example><exampletable>[["Tổng quan","Cấp 1","Cấp 2","Cấp 3"],["125 (+25/cấp chiêu)","125","150","175"],["15% (+3%/cấp chiêu)","15%","18%","21%"]]</exampletable></example>
<note>Nếu mức tăng hoặc giảm không đều, các giá trị được liệt kê theo thứ tự cấp, ngăn cách bằng dấu /.</note>'
    FROM terminology.entry e
    WHERE t.entry_id = e.id AND e.kind = 'term' AND e.reference_key = 'thong-so-theo-cap-chieu'
      AND t.locale = 'vi-VN'
      AND t.description = 'Số đầu là giá trị ở cấp 1. Mỗi lần nâng chiêu, cộng (+) hoặc trừ (−) một lần lượng ghi trong ngoặc.

125 (+25/cấp chiêu): cấp 1 là 125, cấp 2 là 150, cấp 3 là 175.
15% (+3%/cấp chiêu): cấp 1 là 15%, cấp 2 là 18%, cấp 3 là 21%.

Nếu mức tăng hoặc giảm không đều, các giá trị được liệt kê theo thứ tự cấp, ngăn cách bằng dấu /.'
    RETURNING t.id
)
UPDATE terminology.configuration
SET version = version + 1, updated_at = now()
WHERE EXISTS (SELECT 1 FROM changed);
