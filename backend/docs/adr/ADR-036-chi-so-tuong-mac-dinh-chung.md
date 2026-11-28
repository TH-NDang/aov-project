# ADR-036 — Chỉ số tướng: mặc định chung, tăng theo cấp và thuật ngữ

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-28

## Bối cảnh

- V042 lưu "Thuộc tính mặc định" theo patch (`patch.stat_default`): mỗi patch khai lại giá trị chung, kèm link nguồn
  bắt buộc. Công cụ nằm ở trang Phiên bản và thị trường.
- V075 bỏ cột `growth_per_level` vì cho rằng màn Thuộc tính trong game ghi cùng một số từ cấp 1 đến 15.
- Chủ dự án kiểm tra lại trong game (28/11/2026): chỉ số của tướng **có** tăng khi lên cấp. Giá trị mọi tướng giống
  nhau cũng không đổi theo patch, nên không cần khai theo patch.
- Học viện Liên Quân (bài 25069, 25137, 25436, 25986, 26089) nêu giới hạn: tốc đánh cộng thêm 200%, giảm hồi chiêu 40%,
  tốc chạy 800; giáp giảm sát thương theo `sát thương × 600 ÷ (600 + giáp)`.
- Soi 128 tướng trên API công khai (patch 2026-11-17, cấp 1): mọi tướng có công phép 0, xuyên giáp `0 | 0%`, xuyên giáp
  phép `0 | 0%`, tốc đánh cộng thêm 0%, giảm hồi chiêu 0%, hút máu 0%, hút máu phép 0%, tỷ lệ chí mạng 0% (trừ Wukong),
  sát thương chí mạng 200% (trừ Wukong, Quillen), giáp phép `80 | 0%` (trừ Yue 50, đúng trong game). Máu, công vật lý,
  giáp, tốc chạy và năng lượng khác nhau theo tướng.

## Quyết định

- `hero.stat_rule` (V086) thay `patch.stat_default`: mỗi chỉ số một dòng, không theo patch, gồm giá trị cấp 1 mọi tướng
  dùng chung, phần trăm sau dấu `|` (giáp, giáp phép, hai loại xuyên giáp), mức tăng mỗi cấp, giới hạn trong trận và link
  nguồn tùy chọn. Cần ít nhất một trong ba: giá trị cấp 1, mức tăng, giới hạn. Một chỉ số chỉ có giới hạn (tốc chạy)
  không cho tướng giá trị nào để kế thừa.
- V086 chép giá trị mới nhất của mỗi chỉ số từ `patch.stat_default` (ưu tiên patch đã xuất bản), thêm các giá trị mọi
  tướng giống nhau ở trên và các giới hạn của Học viện, rồi xóa `patch.stat_default`.
- Tướng chỉ lưu giá trị riêng khi khác giá trị chung (Yue, Wukong, Quillen). Giá trị chung không được chép vào dòng của
  tướng.
- `hero.hero_combat_stat_value.growth_per_level` trở lại (V086), không âm, không bắt buộc. `baseValue` vẫn bắt buộc và
  là giá trị cấp 1 như màn Thuộc tính.
- API: `GET /admin/hero-stat-rules` (`catalog:read`), `PUT` và `DELETE /admin/hero-stat-rules/{key}` (`hero:write`,
  khóa lạc quan bằng `version`), `GET /hero-stat-rules` công khai. Ghi audit `HERO_STAT_RULE_SET` và
  `HERO_STAT_RULE_REMOVED`.
- Admin sửa mặc định chung trong ngăn "Sửa mặc định chung" ở phần Thông số của tướng; trang patch không còn công cụ này.
- Mỗi chỉ số có một thuật ngữ trong bảng thuật ngữ dùng chung (V087, 19 thuật ngữ), viết bằng lời dễ hiểu, không chép câu
  của nguồn, nêu giới hạn và các trang bị đang bán có chỉ số đó (link tới trang bị). Thuật ngữ cũ chỉ được thay mô tả khi
  còn đúng câu seed của V029. Bảng `HERO_STAT_TERMS` (`@aov/ui/lib/hero-stat-terms`) nối mã chỉ số với thuật ngữ cho Admin
  và Wiki; `TERM_ITEM_FILTERS` nối thuật ngữ với bộ lọc chỉ số của Kho đồ, nên trang thuật ngữ luôn dẫn tới danh sách
  trang bị hiện tại thay vì một danh sách viết cố định.

## Hệ quả

- Một giá trị chung đổi trong game được sửa một lần cho mọi patch. Muốn biết giá trị chung cũ tại một patch cũ thì đọc
  audit; Wiki không dựng lại giá trị chung theo patch.
- Trang bị nêu tên trong mô tả thuật ngữ có thể cũ đi sau vài patch; biên tập viên sửa ở trang Thuật ngữ, còn link "Mọi
  trang bị có chỉ số này" luôn đúng.
