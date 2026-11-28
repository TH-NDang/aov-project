-- A glossary term for every stat the game's attribute screen shows (owner, 2026-11-28), in plain words and naming the
-- items of the 2026-11-28 shop that give the stat. Stats that had a term keep it: its text is replaced only while it is
-- still the V029 seed, so a description an editor rewrote stays. An item is written as {item:code|Name}: it becomes a
-- link to that item where the item exists, else the plain name. Caps are the ones the game's academy site names
-- (https://hocvien.lienquan.garena.vn/bai-viet/25069); level 1 values are the ones all 128 heroes shared on 2026-11-28.
CREATE FUNCTION pg_temp.stat_term_text(body TEXT) RETURNS TEXT
    LANGUAGE plpgsql AS
$$
DECLARE
    found TEXT[];
    item_id UUID;
BEGIN
    FOR found IN SELECT regexp_matches(body, '\{item:([a-z0-9-]+)\|([^{}|]+)\}', 'g') LOOP
        SELECT id INTO item_id FROM item.item WHERE code = found[1];
        body := replace(body, '{item:' || found[1] || '|' || found[2] || '}',
                        CASE WHEN item_id IS NULL THEN found[2]
                             ELSE '<ref=item:' || item_id || '>' || found[2] || '</ref>' END);
    END LOOP;
    RETURN body;
END
$$;

CREATE TEMP TABLE stat_term (
    position INTEGER NOT NULL,
    reference_key TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases JSONB NOT NULL,
    description TEXT NOT NULL,
    seed TEXT
) ON COMMIT DROP;

INSERT INTO stat_term (position, reference_key, name, aliases, description, seed)
VALUES
    (1, 'mau-toi-da', 'Máu tối đa', '["HP"]',
     'Lượng máu nhiều nhất tướng có được. Máu về 0 thì tướng bị hạ. Mỗi tướng có máu riêng ở cấp 1 và có thêm máu sau mỗi cấp. Phần lớn đồ thủ đều cộng máu, nhiều nhất là {item:phu-chu-truong-sinh|Phù chú trường sinh}.',
     NULL),
    (2, 'cong-vat-ly', 'Công vật lý', '["Công VL"]',
     'Sức mạnh của đòn đánh thường và của các chiêu tính theo công vật lý. Mỗi tướng có công vật lý riêng ở cấp 1 và mạnh lên theo cấp. Đồ công như {item:nanh-fenrir|Nanh Fenrir}, {item:quy-kiem|Quỷ kiếm} hay {item:thanh-kiem|Thánh kiếm} cộng thêm.',
     'Chỉ số được dùng trong tính sát thương của đòn đánh và các chiêu thức vật lý.'),
    (3, 'cong-phep', 'Công phép', '[]',
     'Làm mạnh các chiêu tính theo công phép, cả sát thương lẫn lượng hồi máu hay lá chắn. Tướng nào cũng bắt đầu với 0 công phép và chỉ có thêm từ trang bị, ngọc hay phù hiệu, nhiều nhất là {item:sach-thanh|Sách thánh} và {item:vuong-mien-hecate|Vương miện Hecate}.',
     'Chỉ số được dùng trong tính sát thương hoặc hiệu ứng của các chiêu thức có hệ số công phép.'),
    (4, 'giap', 'Giáp', '["Giáp vật lý"]',
     'Giảm sát thương vật lý phải nhận. Sát thương còn lại bằng sát thương × 600 ÷ (600 + giáp), nên 600 giáp chặn được một nửa. Con số % game ghi sau dấu | là phần bị chặn. Giáp tăng theo cấp tướng; đồ thủ như {item:khien-huyen-thoai|Khiên huyền thoại} hay {item:giap-thong-kho|Giáp thống khổ} cộng thêm nhiều giáp.',
     'Chỉ số giúp giảm sát thương vật lý phải nhận.'),
    (5, 'giap-phep', 'Giáp phép', '["Kháng phép"]',
     'Giảm sát thương phép phải nhận: càng nhiều giáp phép thì càng mất ít máu trước chiêu phép. Hầu hết tướng bắt đầu với 80 giáp phép. Có thêm từ {item:giap-gaia|Giáp Gaia}, {item:huan-chuong-troy|Huân chương Troy}, {item:guom-uriel|Gươm Uriel} hay {item:phu-chu-truong-sinh|Phù chú trường sinh}.',
     'Chỉ số giúp giảm sát thương phép phải nhận.'),
    (6, 'nang-luong', 'Năng lượng', '["Mana", "Năng lượng tối đa"]',
     'Thứ nhiều tướng phải tốn mỗi lần dùng chiêu, thường là mana. Không đủ năng lượng thì không dùng được chiêu cần nó. Có tướng dùng thứ khác như nộ, có tướng không tốn gì. Năng lượng tối đa tăng theo cấp; {item:day-chuyen-luc-bao|Dây chuyền lục bảo} giúp hồi lại nhanh hơn.',
     NULL),
    (7, 'toc-chay', 'Tốc chạy', '["Tốc độ di chuyển"]',
     'Tướng đi nhanh hay chậm trên bản đồ. Mỗi tướng có tốc chạy riêng, phần lớn từ 350 đến 400. Giày là cách tăng tốc chạy chính, như {item:giay-hermes|Giày Hermes}; vài món như {item:guom-uriel|Gươm Uriel}, {item:vo-anh-tien|Vô ảnh tiễn} hay {item:the-uoc-carano|Thệ ước Carano} cũng cộng thêm. Tốc chạy cao nhất trong trận là 800.',
     'Chỉ số thể hiện tốc độ di chuyển của tướng.'),
    (8, 'tam-danh', 'Tầm đánh', '["Đánh xa", "Cận chiến"]',
     'Khoảng cách đòn đánh thường với tới mục tiêu. Tướng cận chiến phải áp sát, tướng đánh xa đứng từ xa mà đánh. {item:xa-nhat-cung|Xạ Nhật cung} cho thêm tầm đánh.',
     NULL),
    (9, 'xuyen-giap', 'Xuyên giáp', '["Xuyên giáp vật lý"]',
     'Bỏ qua một phần <ref=term:giap>giáp</ref> của mục tiêu khi gây sát thương vật lý, nên đánh tướng đỡ đòn vẫn đau. Game ghi hai số: số điểm giáp được bỏ qua, rồi phần trăm giáp được bỏ qua. Tướng nào cũng bắt đầu với 0 | 0%. {item:kiem-muramasa|Kiếm Muramasa} và {item:diet-than-cung|Diệt thần cung} bỏ qua theo phần trăm; {item:thuong-longinus|Thương Longinus} và {item:kiem-truy-hon|Kiếm truy hồn} bỏ qua theo điểm.',
     NULL),
    (10, 'xuyen-giap-phep', 'Xuyên giáp phép', '[]',
     'Như xuyên giáp nhưng cho sát thương phép: bỏ qua một phần <ref=term:giap-phep>giáp phép</ref> của mục tiêu. Tướng nào cũng bắt đầu với 0 | 0%. {item:truong-hon-mang|Trượng hỗn mang} bỏ qua theo phần trăm; {item:mat-na-ma-quai|Mặt nạ ma quái}, {item:ma-phap-truong-bao|Ma pháp trường bào} và {item:giay-phu-thuy|Giày phù thủy} bỏ qua theo điểm.',
     NULL),
    (11, 'toc-danh', 'Tốc đánh', '["Tốc độ đánh", "Tốc đánh cộng thêm"]',
     'Đánh thường nhanh hơn, ra nhiều đòn hơn trong cùng một lúc. Game ghi phần tốc đánh cộng thêm: tướng nào cũng bắt đầu 0% và có thêm từ trang bị như {item:guom-sam-set|Gươm sấm sét} hay {item:song-dao-bao-tap|Song đao bão táp}. Tốc đánh cộng thêm cao nhất là 200%.',
     'Chỉ số liên quan đến số đòn đánh thường tướng có thể thực hiện trong một khoảng thời gian.'),
    (12, 'chi-mang', 'Chí mạng', '[]',
     'Một đòn đánh thường gây sát thương lớn hơn bình thường. <ref=term:ti-le-chi-mang>Tỷ lệ chí mạng</ref> là khả năng một đòn ra chí mạng, <ref=term:sat-thuong-chi-mang>sát thương chí mạng</ref> là đòn đó mạnh tới đâu.',
     'Đòn đánh gây thêm sát thương so với đòn đánh thông thường, theo quy tắc của hiệu ứng.'),
    (13, 'ti-le-chi-mang', 'Tỷ lệ chí mạng', '["Tỉ lệ chí mạng"]',
     'Khả năng một đòn đánh thường ra chí mạng. Tướng nào cũng bắt đầu 0%, trừ vài tướng có sẵn từ nội tại như Wukong; cao nhất là 100%. Có thêm từ {item:song-dao-bao-tap|Song đao bão táp}, {item:vo-anh-tien|Vô ảnh tiễn}, {item:vuot-hung-tan|Vuốt hung tàn} hay {item:thanh-kiem|Thánh kiếm}.',
     NULL),
    (14, 'sat-thuong-chi-mang', 'Sát thương chí mạng', '[]',
     'Một đòn chí mạng bằng bao nhiêu phần trăm đòn thường. Hầu hết tướng là 200%, tức gấp đôi; vài tướng như Wukong thấp hơn. {item:thanh-kiem|Thánh kiếm} tăng thêm sát thương chí mạng.',
     NULL),
    (15, 'hut-mau', 'Hút máu', '["Hút máu vật lý"]',
     'Hồi lại máu theo phần trăm sát thương vật lý gây ra. Tướng nào cũng bắt đầu 0%; có thêm từ {item:quy-kiem|Quỷ kiếm}, {item:cung-bao-to|Cung bão tố}, {item:kiem-fafnir|Kiếm Fafnir} hay {item:cung-ta-ma|Cung tà ma}.',
     NULL),
    (16, 'hut-mau-phep', 'Hút máu phép', '[]',
     'Hồi lại máu theo phần trăm sát thương phép gây ra. Tướng nào cũng bắt đầu 0%; có thêm từ {item:quyen-truong-rhea|Quyền trượng Rhea}, {item:qua-cau-bang-suong|Quả cầu băng sương} hay {item:the-uoc-carano|Thệ ước Carano}.',
     NULL),
    (17, 'giam-hoi-chieu', 'Giảm hồi chiêu', '["Giảm thời gian hồi chiêu"]',
     'Rút ngắn thời gian chờ giữa hai lần dùng một chiêu. Tướng nào cũng bắt đầu 0% và giảm được nhiều nhất 40%. Nhiều trang bị cộng thêm, như {item:khien-huyen-thoai|Khiên huyền thoại}, {item:thuong-longinus|Thương Longinus}, {item:day-chuyen-luc-bao|Dây chuyền lục bảo} hay {item:giay-thuat-si|Giày thuật sĩ}.',
     'Chỉ số giúp rút ngắn thời gian chờ giữa các lần sử dụng chiêu thức.'),
    (18, 'khang-hieu-ung', 'Kháng hiệu ứng', '["Kháng khống chế"]',
     'Rút ngắn thời gian bị <ref=term:choang>choáng</ref>, <ref=term:lam-cham>làm chậm</ref> và các hiệu ứng khống chế khác. Có thêm từ {item:giay-kien-cuong|Giày kiên cường}, {item:guom-uriel|Gươm Uriel} hay {item:song-dao-bao-tap|Song đao bão táp}.',
     NULL),
    (19, 'hoi-mau-moi-5-giay', 'Hồi máu mỗi 5 giây', '["Hồi máu/5 giây"]',
     'Lượng máu tướng tự hồi sau mỗi 5 giây, không cần làm gì. {item:ao-choang-than-ra|Áo choàng thần Ra} cộng thêm.',
     NULL),
    (20, 'hoi-nang-luong-moi-5-giay', 'Hồi năng lượng mỗi 5 giây', '["Hồi năng lượng/5 giây"]',
     'Lượng <ref=term:nang-luong>năng lượng</ref> tướng tự hồi sau mỗi 5 giây. {item:day-chuyen-luc-bao|Dây chuyền lục bảo} cộng thêm.',
     NULL);

-- New terms go after the glossary's last one, in the order above.
WITH added AS (
    INSERT INTO terminology.entry (id, reference_key, kind, display_order, display)
    SELECT gen_random_uuid(), s.reference_key, 'term',
           (SELECT coalesce(max(display_order), -1) FROM terminology.entry) + s.position,
           '{"underline":true,"showIcon":false}'::jsonb
    FROM stat_term s
    WHERE s.seed IS NULL
    ON CONFLICT (kind, reference_key) DO NOTHING
    RETURNING id, reference_key
)
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases)
SELECT gen_random_uuid(), a.id, 'vi-VN', s.name, pg_temp.stat_term_text(s.description), s.aliases
FROM added a
JOIN stat_term s ON s.reference_key = a.reference_key;

UPDATE terminology.translation t
SET description = pg_temp.stat_term_text(s.description), aliases = s.aliases
FROM terminology.entry e, stat_term s
WHERE t.entry_id = e.id
  AND e.kind = 'term'
  AND e.reference_key = s.reference_key
  AND t.locale = 'vi-VN'
  AND t.description = s.seed;

UPDATE terminology.configuration SET version = version + 1, updated_at = now();

DROP FUNCTION pg_temp.stat_term_text(TEXT);
