-- Game words that Stream post translation needs (ADR-037, owner 2026-11-28): ranks, big monsters, lanes, roles, match
-- phases, skill words and player slang, with their English names and, where the official sites write them, Thai and
-- Chinese. Names were checked on the regional sites (lienquan.garena.vn, rov.in.th, moba.garena.tw) on 2026-11-28.
-- The new terms do not match text on their own (auto_match false), so Wiki and Stream highlight nothing new. An existing
-- term or translation is never changed: only missing ones are added, so an editor's text stays.
CREATE TEMP TABLE translation_term (
    position INTEGER NOT NULL,
    reference_key TEXT NOT NULL,
    locale TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases JSONB NOT NULL,
    description TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO translation_term (position, reference_key, locale, name, aliases, description)
VALUES
    (1, 'phep-bo-tro', 'vi-VN', 'Phép bổ trợ', '["Phụ trợ"]',
     'Chiêu thêm mỗi người chơi chọn trước trận, ngoài các chiêu của tướng, như Trừng trị hay Tốc biến.'),
    (1, 'phep-bo-tro', 'en-US', 'Challenger Skill', '["spell"]',
     'The extra skill each player picks before a match, on top of the hero''s own skills, such as Punish or Flicker.'),
    (1, 'phep-bo-tro', 'th-TH', 'สกิลชาเลนเจอร์', '[]', ''),
    (1, 'phep-bo-tro', 'zh-TW', '挑戰者技能', '[]', ''),

    (2, 'hang-dong', 'vi-VN', 'Hạng Đồng', '["rank Đồng", "hạng đồng", "rank đồng"]',
     'Bậc đầu tiên của đấu xếp hạng.'),
    (2, 'hang-dong', 'en-US', 'Bronze', '[]', 'The first tier of ranked play.'),
    (3, 'hang-bac', 'vi-VN', 'Hạng Bạc', '["rank Bạc", "hạng bạc", "rank bạc"]',
     'Bậc thứ hai của đấu xếp hạng, sau Đồng.'),
    (3, 'hang-bac', 'en-US', 'Silver', '[]', 'The second tier of ranked play, after Bronze.'),
    (4, 'hang-vang', 'vi-VN', 'Hạng Vàng', '["rank Vàng", "hạng vàng", "rank vàng"]',
     'Bậc thứ ba của đấu xếp hạng, sau Bạc.'),
    (4, 'hang-vang', 'en-US', 'Gold', '[]', 'The third tier of ranked play, after Silver.'),
    (5, 'bach-kim', 'vi-VN', 'Bạch Kim', '["hạng bạch kim", "rank bạch kim"]',
     'Bậc của đấu xếp hạng sau Vàng.'),
    (5, 'bach-kim', 'en-US', 'Platinum', '[]', 'The ranked tier after Gold.'),
    (6, 'kim-cuong', 'vi-VN', 'Kim Cương', '["hạng kim cương", "rank kim cương"]',
     'Bậc của đấu xếp hạng sau Bạch Kim.'),
    (6, 'kim-cuong', 'en-US', 'Diamond', '[]', 'The ranked tier after Platinum.'),
    (7, 'tinh-anh', 'vi-VN', 'Tinh Anh', '["hạng tinh anh", "rank tinh anh"]',
     'Bậc của đấu xếp hạng sau Kim Cương.'),
    (7, 'tinh-anh', 'en-US', 'Commander', '[]', 'The ranked tier after Diamond.'),
    (8, 'cao-thu', 'vi-VN', 'Hạng Cao Thủ', '["rank Cao Thủ", "hạng cao thủ", "rank cao thủ"]',
     'Bậc của đấu xếp hạng sau Tinh Anh.'),
    (8, 'cao-thu', 'en-US', 'Conqueror', '[]', 'The ranked tier after Commander.'),
    (9, 'chien-tuong', 'vi-VN', 'Chiến Tướng', '["hạng chiến tướng", "rank chiến tướng"]',
     'Bậc của đấu xếp hạng sau Cao Thủ.'),
    (9, 'chien-tuong', 'en-US', 'Supreme Conqueror', '[]', 'The ranked tier after Conqueror.'),
    (10, 'chien-than', 'vi-VN', 'Hạng Chiến Thần', '["rank Chiến Thần", "hạng chiến thần", "rank chiến thần"]',
     'Bậc cao nhất của đấu xếp hạng, sau Chiến Tướng.'),
    (10, 'chien-than', 'en-US', 'Glorious Ruler', '[]', 'The top tier of ranked play, after Supreme Conqueror.'),

    (11, 'caesar', 'vi-VN', 'Caesar', '["Tà Thần"]',
     'Quái lớn ở phía <ref=term:duong-caesar>đường Caesar</ref>. Đội hạ được nó có lợi thế lớn để đẩy trụ.'),
    (11, 'caesar', 'en-US', 'Dark Slayer', '["DS"]',
     'The big monster on the Dark Slayer Lane side. The team that takes it gets a strong push.'),
    (11, 'caesar', 'zh-TW', '凱撒', '[]', ''),
    (12, 'caesar-tien-phong', 'vi-VN', 'Caesar tiên phong', '[]',
     'Một dạng khác của <ref=term:caesar>Caesar</ref>, có tên riêng trong game.'),
    (12, 'caesar-tien-phong', 'en-US', 'Dark Slayer Vanguard', '[]',
     'Another form of the Dark Slayer, named separately in the game.'),
    (13, 'rong', 'vi-VN', 'Rồng', '[]',
     'Quái lớn ở phía <ref=term:duong-rong>đường Rồng</ref>. Hạ được nó thì cả đội có thêm vàng và kinh nghiệm.'),
    (13, 'rong', 'en-US', 'Abyssal Dragon', '["Dragon"]',
     'The big monster on the Abyssal Dragon Lane side. Taking it gives the whole team gold and experience.'),
    (14, 'king-kong', 'vi-VN', 'King Kong', '[]', 'Quái lớn trong rừng.'),
    (14, 'king-kong', 'en-US', 'Ancient Gorilla', '[]', 'A big jungle monster.'),
    (15, 'bua-xanh', 'vi-VN', 'Bùa xanh', '["buff xanh"]',
     'Bùa của quái rừng xanh: giảm hồi chiêu và hồi năng lượng nhanh hơn trong một lúc.'),
    (15, 'bua-xanh', 'en-US', 'Blue buff', '[]',
     'The buff of the blue jungle monster: shorter cooldowns and faster energy regeneration for a while.'),
    (15, 'bua-xanh', 'th-TH', 'บัฟฟ้า', '[]', ''),
    (16, 'bua-do', 'vi-VN', 'Bùa đỏ', '["buff đỏ"]',
     'Bùa của quái rừng đỏ: đòn đánh thường gây thêm sát thương và làm chậm trong một lúc.'),
    (16, 'bua-do', 'en-US', 'Red buff', '[]',
     'The buff of the red jungle monster: basic attacks deal extra damage and slow for a while.'),
    (16, 'bua-do', 'th-TH', 'บัฟแดง', '[]', ''),

    (17, 'duong-caesar', 'vi-VN', 'Đường Caesar', '["đường caesar", "đường Tà Thần"]',
     'Đường gần <ref=term:caesar>Caesar</ref>.'),
    (17, 'duong-caesar', 'en-US', 'Dark Slayer Lane', '["DS lane"]', 'The lane near the Dark Slayer.'),
    (18, 'duong-rong', 'vi-VN', 'Đường Rồng', '["đường rồng"]', 'Đường gần <ref=term:rong>Rồng</ref>.'),
    (18, 'duong-rong', 'en-US', 'Abyssal Dragon Lane', '["Dragon Lane"]', 'The lane near the Abyssal Dragon.'),
    (19, 'duong-giua', 'vi-VN', 'Đường giữa', '["mid"]', 'Đường ở giữa bản đồ, nối thẳng hai nhà chính.'),
    (19, 'duong-giua', 'en-US', 'Mid Lane', '["mid"]', 'The lane through the middle of the map, straight between the two bases.'),
    (20, 'di-rung', 'vi-VN', 'Đi rừng', '["người đi rừng", "rừng"]',
     'Vai trò đánh quái trong rừng để lên cấp, rồi giúp các đường.'),
    (20, 'di-rung', 'en-US', 'Jungle', '["jungler", "jungling"]',
     'The role that farms the jungle monsters to level up, then helps the lanes.'),

    (21, 'do-don', 'vi-VN', 'Đỡ đòn', '[]', 'Vai trò chịu đòn cho đồng đội và mở giao tranh.'),
    (21, 'do-don', 'en-US', 'Tank', '[]', 'The role that takes the hits for the team and starts fights.'),
    (21, 'do-don', 'zh-TW', '坦克', '[]', ''),
    (22, 'dau-si', 'vi-VN', 'Đấu sĩ', '[]', 'Vai trò đánh gần, vừa trâu vừa gây nhiều sát thương.'),
    (22, 'dau-si', 'en-US', 'Fighter', '[]', 'A close-range role that is both sturdy and hard-hitting.'),
    (22, 'dau-si', 'zh-TW', '戰士', '[]', ''),
    (23, 'sat-thu', 'vi-VN', 'Sát thủ', '[]', 'Vai trò lao vào hạ nhanh mục tiêu ít máu.'),
    (23, 'sat-thu', 'en-US', 'Assassin', '[]', 'The role that dives in to take down weak targets fast.'),
    (23, 'sat-thu', 'zh-TW', '刺客', '[]', ''),
    (24, 'phap-su', 'vi-VN', 'Pháp sư', '[]', 'Vai trò gây sát thương phép bằng chiêu.'),
    (24, 'phap-su', 'en-US', 'Mage', '[]', 'The role that deals magic damage with skills.'),
    (24, 'phap-su', 'zh-TW', '法師', '[]', ''),
    (25, 'xa-thu', 'vi-VN', 'Xạ thủ', '[]', 'Vai trò đánh xa, gây sát thương đều bằng đòn đánh thường.'),
    (25, 'xa-thu', 'en-US', 'Marksman', '["ADC"]', 'The ranged role that deals steady damage with basic attacks.'),
    (25, 'xa-thu', 'zh-TW', '射手', '[]', ''),
    (26, 'tro-thu', 'vi-VN', 'Trợ thủ', '["SP", "hỗ trợ"]', 'Vai trò bảo vệ và mở đường cho đồng đội.'),
    (26, 'tro-thu', 'en-US', 'Support', '[]', 'The role that protects teammates and opens the way for them.'),
    (26, 'tro-thu', 'zh-TW', '輔助', '[]', ''),

    (27, 'quan-huy', 'vi-VN', 'Quân Huy', '["QH"]',
     'Tiền nạp của game, dùng mua tướng, trang phục và nhiều thứ khác trong cửa hàng.'),
    (27, 'quan-huy', 'en-US', 'Vouchers', '["voucher"]',
     'The game''s paid currency, used for heroes, skins and more in the shop.'),
    (27, 'quan-huy', 'th-TH', 'คูปอง', '[]', ''),
    (27, 'quan-huy', 'zh-TW', '點券', '[]', ''),
    (28, 'ngoc', 'vi-VN', 'Ngọc', '["bảng ngọc"]',
     'Các viên gắn trước trận để cộng chỉ số cho tướng, xếp thành bảng ngọc.'),
    (28, 'ngoc', 'en-US', 'Arcana', '[]', 'Pieces set before a match that add stats to a hero, arranged in arcana pages.'),
    (28, 'ngoc', 'th-TH', 'รูน', '[]', ''),
    (28, 'ngoc', 'zh-TW', '奧義', '[]', ''),
    (29, 'o-ngoc', 'vi-VN', 'Ô ngọc', '[]', 'Một chỗ trên bảng ngọc để gắn một viên <ref=term:ngoc>ngọc</ref>.'),
    (29, 'o-ngoc', 'en-US', 'Arcana slot', '[]', 'A place on an arcana page for one piece of arcana.'),
    (30, 'phu-hieu', 'vi-VN', 'Phù hiệu', '[]',
     'Chọn trước trận theo nhánh, cho tướng thêm hiệu ứng của nhánh đó.'),
    (30, 'phu-hieu', 'en-US', 'Enchantment', '["Enchantments"]',
     'Picked by branch before a match; gives the hero extra effects of that branch.'),
    (31, 'trang-bi', 'vi-VN', 'Trang bị', '[]', 'Đồ tướng mua bằng vàng trong trận để mạnh lên.'),
    (31, 'trang-bi', 'en-US', 'Items', '["item", "build", "equip", "gear"]',
     'What a hero buys with gold during a match to grow stronger.'),
    (31, 'trang-bi', 'th-TH', 'ไอเทม', '[]', ''),
    (31, 'trang-bi', 'zh-TW', '裝備', '[]', ''),

    (32, 'dau-tran', 'vi-VN', 'Đầu trận', '[]', 'Những phút đầu của trận, khi tướng còn cấp thấp.'),
    (32, 'dau-tran', 'en-US', 'Early game', '[]', 'The first minutes of a match, while heroes are still low level.'),
    (32, 'dau-tran', 'th-TH', 'ต้นเกม', '[]', ''),
    (33, 'giua-tran', 'vi-VN', 'Giữa trận', '[]', 'Phần giữa của trận, khi hai đội bắt đầu giao tranh và tranh quái lớn.'),
    (33, 'giua-tran', 'en-US', 'Mid game', '[]', 'The middle of a match, when teams start fighting over the big monsters.'),
    (33, 'giua-tran', 'th-TH', 'กลางเกม', '["เกมกลาง"]', ''),
    (34, 'cuoi-tran', 'vi-VN', 'Cuối trận', '[]',
     'Phần cuối của trận, khi tướng đã đủ đồ và một giao tranh có thể quyết định thắng thua.'),
    (34, 'cuoi-tran', 'en-US', 'Late game', '[]',
     'The end of a match, when heroes have their items and one fight can decide the game.'),
    (34, 'cuoi-tran', 'th-TH', 'ท้ายเกม', '[]', ''),

    (35, 'chieu-cuoi', 'vi-VN', 'Chiêu cuối', '["ulti"]', 'Chiêu thứ ba của tướng, thường mạnh nhất và hồi lâu nhất.'),
    (35, 'chieu-cuoi', 'en-US', 'Ultimate', '["ult"]', 'A hero''s third skill, usually the strongest with the longest cooldown.'),
    (36, 'hoi-chieu', 'vi-VN', 'Hồi chiêu', '["thời gian hồi chiêu"]', 'Thời gian phải chờ trước khi dùng lại một chiêu.'),
    (36, 'hoi-chieu', 'en-US', 'Cooldown', '["CD"]', 'How long to wait before a skill can be used again.'),
    (37, 'danh-thuong', 'vi-VN', 'Đánh thường', '["đòn đánh thường"]', 'Đòn đánh bằng nút tấn công, không phải chiêu.'),
    (37, 'danh-thuong', 'en-US', 'Basic attack', '["auto attack"]', 'An attack made with the attack button rather than a skill.'),
    (38, 'sat-thuong', 'vi-VN', 'Sát thương', '["dame", "dmg"]',
     'Lượng máu một đòn hay một chiêu lấy đi của mục tiêu. Người chơi hay viết dame hoặc dmg.'),
    (38, 'sat-thuong', 'en-US', 'Damage', '["dmg"]', 'How much health a hit or a skill takes from its target.'),

    (39, 'ba-dao', 'vi-VN', 'Bá đạo', '["quá bá", "imba"]', 'Từ lóng: quá mạnh, khó cản.'),
    (39, 'ba-dao', 'en-US', 'Busted', '["OP", "overpowered"]', 'Slang: too strong, hard to stop.'),
    (40, 'ganh-team', 'vi-VN', 'Gánh team', '["gánh"]', 'Từ lóng: một người chơi hay tới mức kéo cả đội thắng.'),
    (40, 'ganh-team', 'en-US', 'Carry', '[]', 'Slang: one player good enough to win the match for the team.'),
    (41, 'cau-mau', 'vi-VN', 'Cấu máu', '[]', 'Gây chút sát thương từ xa để bào máu đối thủ trước giao tranh.'),
    (41, 'cau-mau', 'en-US', 'Poke', '["chip damage"]', 'Small hits from range that wear the enemy down before a fight.'),
    (42, 'farm-no', 'vi-VN', 'Farm no', '[]', 'Từ lóng: đã farm đủ vàng và kinh nghiệm, nhiều đồ hơn đối thủ.'),
    (42, 'farm-no', 'en-US', 'Farmed up', '["fed", "fully farmed", "well farmed"]',
     'Slang: has gathered plenty of gold and experience, with more items than the enemy.'),
    (43, 'lat-keo', 'vi-VN', 'Lật kèo', '[]', 'Từ lóng: đang thua mà đánh lại thành thắng.'),
    (43, 'lat-keo', 'en-US', 'Comeback', '[]', 'Slang: turning a losing match into a win.'),
    (44, 'do-thu', 'vi-VN', 'Đồ thủ', '[]', 'Trang bị cộng máu, giáp hay giáp phép để sống lâu hơn.'),
    (44, 'do-thu', 'en-US', 'Defensive items', '["tank items"]',
     'Items that add health, armor or magic defense to stay alive longer.'),
    (45, 'giao-tranh', 'vi-VN', 'Giao tranh', '[]', 'Trận đánh nhau của nhiều tướng hai bên cùng lúc.'),
    (45, 'giao-tranh', 'en-US', 'Teamfight', '["team fight"]', 'A fight between many heroes of both teams at once.'),
    (46, 'mo-giao-tranh', 'vi-VN', 'Mở giao tranh', '[]', 'Lao vào trước để bắt đầu một giao tranh.'),
    (46, 'mo-giao-tranh', 'en-US', 'Engage', '["initiate"]', 'Going in first to start a teamfight.'),
    (47, 'cam-mat', 'vi-VN', 'Cắm mắt', '[]', 'Đặt tầm nhìn ở một chỗ để thấy đối thủ đi qua.'),
    (47, 'cam-mat', 'en-US', 'Ward', '["warding"]', 'Placing vision somewhere to see enemies pass.'),

    -- English names for terms the glossary already had.
    (0, 'noi-tai', 'en-US', 'Passive', '[]', 'A hero''s built-in effect that works without being cast.'),
    (0, 'giam-hoi-chieu', 'en-US', 'Cooldown reduction', '["CDR"]',
     'Shortens the wait between two uses of a skill. Every hero starts at 0% and can reach at most 40%.'),
    (0, 'sat-thuong-vat-ly', 'en-US', 'Physical damage', '[]', 'Damage that armor and armor pierce act on.'),
    (0, 'sat-thuong-phep', 'en-US', 'Magic damage', '[]', 'Damage that magic defense and magic pierce act on.'),
    (0, 'sat-thuong-chuan', 'en-US', 'True damage', '[]', 'Damage that ignores armor and magic defense.'),
    (0, 'la-chan', 'en-US', 'Shield', '[]', 'A barrier that takes damage before health does.'),
    (0, 'lam-cham', 'en-US', 'Slow', '[]', 'Lowers a target''s movement speed for a while.'),
    (0, 'choang', 'en-US', 'Stun', '[]', 'Stops a target from moving, attacking or using skills for a while.');

-- New terms go after the glossary's last one, in the order above.
INSERT INTO terminology.entry (id, reference_key, kind, auto_match, display_order, display)
SELECT gen_random_uuid(), t.reference_key, 'term', false,
       (SELECT coalesce(max(display_order), -1) FROM terminology.entry) + t.position,
       '{"underline":true,"showIcon":false}'::jsonb
FROM translation_term t
WHERE t.locale = 'vi-VN' AND t.position > 0
ON CONFLICT (kind, reference_key) DO NOTHING;

INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases)
SELECT gen_random_uuid(), e.id, t.locale, t.name, t.description, t.aliases
FROM translation_term t
JOIN terminology.entry e ON e.kind = 'term' AND e.reference_key = t.reference_key
ON CONFLICT (entry_id, locale) DO NOTHING;

-- English and Chinese names of the Challenger Skills, laid over the catalog's own names. A spell is found by its
-- Vietnamese name, so a spell the catalog does not have is skipped.
CREATE TEMP TABLE translation_spell (
    position INTEGER NOT NULL,
    vietnamese TEXT NOT NULL,
    locale TEXT NOT NULL,
    name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO translation_spell (position, vietnamese, locale, name)
VALUES
    (1, 'Trừng trị', 'en-US', 'Punish'), (1, 'Trừng trị', 'zh-TW', '制裁'),
    (2, 'Bộc phá', 'en-US', 'Execute'), (2, 'Bộc phá', 'zh-TW', '斬殺'),
    (3, 'Tốc biến', 'en-US', 'Flicker'), (3, 'Tốc biến', 'zh-TW', '瞬移'),
    (4, 'Cấp cứu', 'en-US', 'Heal'), (4, 'Cấp cứu', 'zh-TW', '治癒'),
    (5, 'Thanh tẩy', 'en-US', 'Purify'), (5, 'Thanh tẩy', 'zh-TW', '清醒'),
    (6, 'Ngất ngư', 'en-US', 'Daze'), (6, 'Ngất ngư', 'zh-TW', '暈眩'),
    (7, 'Gầm thét', 'en-US', 'Roar'),
    (8, 'Tốc hành', 'en-US', 'Sprint'), (8, 'Tốc hành', 'zh-TW', '疾走');

CREATE TEMP TABLE translation_spell_owner ON COMMIT DROP AS
SELECT DISTINCT r.owner_id, s.vietnamese, s.position
FROM translation_spell s
JOIN spell.spell_translation st ON st.locale = 'vi-VN' AND st.target_key = ''
    AND lower(st.name) = lower(s.vietnamese)
JOIN spell.spell_revision r ON r.id = st.revision_id;

INSERT INTO terminology.entry (id, reference_key, kind, display_order)
SELECT gen_random_uuid(), o.owner_id::text, 'spell',
       (SELECT coalesce(max(display_order), -1) FROM terminology.entry) + o.position
FROM (SELECT DISTINCT owner_id, position FROM translation_spell_owner) o
ON CONFLICT (kind, reference_key) DO NOTHING;

INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases)
SELECT gen_random_uuid(), e.id, s.locale, s.name, '', '[]'::jsonb
FROM translation_spell_owner o
JOIN translation_spell s ON s.vietnamese = o.vietnamese
JOIN terminology.entry e ON e.kind = 'spell' AND e.reference_key = o.owner_id::text
ON CONFLICT (entry_id, locale) DO NOTHING;

UPDATE terminology.configuration SET version = version + 1, updated_at = now();
