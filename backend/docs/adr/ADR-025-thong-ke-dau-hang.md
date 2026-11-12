# ADR-025 — Bản chụp thống kê đấu hạng

**Trạng thái:** Đề xuất, chờ người dùng duyệt  
**Ngày:** 2026-11-11

## Bối cảnh

### Trong game

- Cộng đồng → **Bảng Phân Bậc Tướng** có hai bảng, đổi bằng nút “Đổi bảng xếp hạng”:
  - **Tỷ lệ thắng, pick, ban**: tướng (tên, vai trò), Tier (T0–T4), tỷ lệ thắng, tỷ lệ chọn, tỷ lệ cấm, và ba chân
    dung “Tỷ lệ thắng cao hơn khi đối đầu những tướng này”. Sắp theo tier.
  - **Chỉ số mỗi trận**: sát thương mỗi trận, hạ, vàng, sát thương phải chịu, phụ (hỗ trợ). Sắp theo sát thương.
- Bộ lọc: chế độ (macro thấy `ALL`, `FIVE`, `ELITE`; `ELITE` hiện là “Đấu hạng (Tinh Anh trở lên)”) và bảy tab vai
  trò. Màn hình **không ghi khoảng thời gian thống kê** hay máy chủ; máy chủ suy ra từ bản game (`com.garena.game.kgvn`
  là Việt Nam).
- Mỗi tướng có đúng một vai trò trên bảng. Flowborn xuất hiện hai lần cùng tên, khác vai trò (Xạ thủ, Pháp sư): game
  thống kê theo **dạng** (ADR-024).
- Số liệu thay đổi liên tục. Muốn so sánh theo thời gian phải chụp nhiều lần; mỗi lần chụp là một ảnh tĩnh của
  bảng tại thời điểm đó.

### Trong dự án

- Chưa có thống kê đấu hạng. Thống kê tướng của giải đấu (`community-service`) tính từ ván đã ghi, không liên quan.
- Tiền lệ gần nhất là giá tướng/cách nhận trang phục (V051–V053): đọc từ ảnh chụp cửa hàng, có `needs_review`, ảnh gốc
  nằm ở `resources/raw/shop/<ngày>/` (không commit), Admin xem ảnh qua middleware dev `/__shop-captures`. Giá nằm
  trong module `hero` vì gắn với tướng và cần FK tới `hero.hero`.
- Lần chụp đầu tiên (11/11/2026, macro `hero-ranking`): 42 ảnh bảng Tỷ lệ, 41 ảnh bảng Chỉ số, 130 dòng mỗi bảng.
  Macro kéo hai lần trước trang 27 của bảng Chỉ số, nên một dòng (Quillen) không có ảnh và một dòng (Billow) bị cắt.

### Yêu cầu

1. Lưu một lần chụp: ngày giờ, chế độ, máy chủ, nguồn ảnh, trạng thái duyệt.
2. Mỗi giá trị biết nó được đọc ở ảnh nào, vùng nào (ảnh dẫn chứng).
3. Biên tập viên xác nhận hoặc sửa giá trị cần duyệt; ghi được giá trị thiếu.
4. So sánh các lần chụp với nhau.
5. Chưa hiện trên Wiki; chỉ đề xuất.

## Các phương án

### Nơi sở hữu

- **A — Capability `ranking` trong module `hero` (chọn).** Mỗi giá trị khóa theo tướng/dạng, cần FK `hero.hero` và
  mã tướng khi nhập; cùng kiểu dữ liệu “quan sát từ game, chờ duyệt” như giá cửa hàng. Theo ADR-013, module lớn
  nhóm theo chức năng: `hero/internal/ranking/{application,persistence}`.
- **B — Module mới `ranking`.** Tách biệt hơn, nhưng phải thêm contract tra mã/tên tướng của `hero`, không có FK, thêm
  schema và cổng kiến trúc cho một tính năng chỉ đọc tướng. Chưa đáng; có thể tách sau nếu thống kê lớn lên (đường
  đi, trang bị theo tướng…).

### Hình dạng dữ liệu

- **Bảng rộng một dòng mỗi tướng** (tier, win_rate, … mỗi thứ một cột) gọn khi đọc, nhưng mỗi giá trị cần dẫn chứng,
  trạng thái duyệt, ghi chú, người duyệt riêng: thành 12 × 8 cột, thêm chỉ số mới phải đổi schema.
- **Một dòng mỗi giá trị (chọn).** `(snapshot, hero, metric)` mang giá trị, chữ đọc được, dẫn chứng, cờ duyệt. Thêm
  chỉ số là thêm một giá trị vào `CHECK`. Đọc chi tiết một lần chụp là ~1 600 dòng: nhỏ.

### Đưa dữ liệu vào

- **Seed Flyway như V052:** mỗi lần chụp một migration, dữ liệu vào mọi môi trường. Không hợp với việc chụp lặp lại
  hằng tuần và làm migration phình to.
- **API nhập (chọn).** Script đọc ảnh ghi `ranking-manifest.json`; Admin (dev) đọc manifest qua middleware và gửi
  `POST /admin/ranking-snapshots`. Môi trường khác nhập cùng tệp qua API.

### Ảnh dẫn chứng

- **Như tiền lệ cửa hàng (chọn):** ảnh nằm ở `resources/raw/ranking/<ngày>/`, không commit; DB lưu mã băm SHA-256,
  tên tệp, kích thước và vùng của từng giá trị; Admin dev đọc ảnh qua `/__ranking-captures/images/<sha256>.png`.
- **Tải ảnh lên Media/object storage:** xem được ở mọi môi trường, nhưng 83 ảnh ~80 MB mỗi lần chụp, thêm loại
  asset và vòng đời xóa. Để sau, khi thật sự cần duyệt ở môi trường không có `resources/`.

## Quyết định

### Lưu trữ (schema `hero`, migration V068)

| Bảng | Nội dung |
|---|---|
| `ranking_snapshot` | Một lần chụp: `code` (slug duy nhất), `region_code`, `mode_code` + `mode_label` (đúng chữ trên game), `period_label` (null khi game không ghi), `captured_at` + `source_time_zone`, `source_run`, `source_note`, `confirmed_at/_by_*`, `version`, `created_*`, `updated_at` |
| `ranking_snapshot_image` | Ảnh của lần chụp: `image_id` (SHA-256 của tệp), `board` (`RATES`, `FIGURES`), `page_no`, `file_name`, `width`, `height` |
| `ranking_snapshot_hero` | Tướng/dạng có trong lần chụp: `hero_id` (FK `hero.hero`), `name_on_screen`, `role_on_screen`, `rates_position`, `figures_position` |
| `ranking_snapshot_value` | Một giá trị: `metric`; `number_value` / `tier_value` / `hero_value` (theo loại chỉ số); `read_text` (chữ đọc được); `needs_review`, `note`; dẫn chứng `image_id` + `box_*`; `reviewed_at/_by_*`; `version`, `updated_at` |

- Chỉ số: `TIER`, `WIN_RATE`, `PICK_RATE`, `BAN_RATE` (phần trăm, hai chữ số thập phân), `COUNTER_1..3` (tướng
  mà tướng này thắng nhiều hơn khi gặp, theo thứ tự trên game), `DAMAGE_DEALT`, `KILLS`, `GOLD`, `DAMAGE_TAKEN`,
  `ASSISTS` (trung bình mỗi trận).
- Dạng (ADR-024) là một dòng riêng: hai dòng Flowborn trỏ `flowborn-ad` và `flowborn-mid`; khớp theo tên + vai trò
  (“Flowborn” + “Xạ thủ” = tên dạng “Flowborn Xạ thủ”).
- Giá trị thiếu (không có ảnh, bị cắt) vẫn có dòng, giá trị null, `needs_review = true`, ghi chú vì sao và vùng ảnh
  nơi lẽ ra có nó. Biên tập viên nhập giá trị sau khi xem trong game.
- Xóa lần chụp xóa mọi bảng con (`ON DELETE CASCADE`); không đụng tướng.

### Duyệt

- Giá trị đọc chắc chắn: `needs_review = false`, không cần làm gì. Giá trị nghi ngờ hoặc thiếu: `needs_review = true`.
- Xác nhận = giữ giá trị, bỏ cờ. Sửa = giá trị mới, bỏ cờ; `read_text` giữ nguyên để biết đã sửa từ chữ nào. Cả hai
  ghi `reviewed_at/_by`. Có thể gắn lại cờ cho giá trị đã duyệt.
- Lần chụp có `confirmed_at` khi biên tập viên xác nhận cả bản; chỉ được khi không còn giá trị chờ duyệt (409
  `HERO_RANKING_REVIEW_OPEN`). Gắn lại cờ cho một giá trị bỏ xác nhận của cả bản.
- Ghi đồng thời: mỗi giá trị có `version` riêng; xác nhận bản dùng `version` của bản. Thao tác ghi khóa dòng bản
  chụp (`SELECT … FOR UPDATE`) để đếm giá trị chờ duyệt không bị lệch. Audit `HERO_RANKING_SNAPSHOT_*`.

### API (Admin)

`GET/POST /admin/ranking-snapshots`, `GET/DELETE /admin/ranking-snapshots/{id}`,
`PUT /admin/ranking-snapshots/{id}/heroes/{heroId}/values/{metric}`, `POST /admin/ranking-snapshots/{id}/confirm`.
Đọc cần `catalog:read`, ghi cần `hero:write`. Chi tiết ở 03.

### So sánh

Admin đọc chi tiết hai lần chụp và khớp theo `heroId`; hiện chênh lệch từng chỉ số và đổi tier. Không cần endpoint
riêng khi mỗi lần chụp chỉ ~130 tướng.

## Đánh đổi

- Ảnh dẫn chứng chỉ xem được ở máy có `resources/` (như ảnh cửa hàng). DB vẫn giữ tên tệp, mã băm và vùng nên không
  mất dấu nguồn.
- Đọc ảnh là bán thủ công (script đo cuộn + đọc số + so chân dung). Mỗi lần chụp mới cần chạy lại script; ADR này
  không thêm OCR.
- Một dòng mỗi giá trị nhiều dòng hơn bảng rộng; chấp nhận vì dữ liệu nhỏ và mỗi giá trị cần dẫn chứng riêng.
- Khoảng thời gian thống kê không biết; `period_label` để trống cho tới khi game hiển thị hoặc biết từ nguồn khác.

## Kiểm chứng

- Kiểm thử tích hợp: nhập, đọc, xác nhận/sửa/gắn cờ giá trị, xác nhận bản bị chặn khi còn cờ, xung đột version,
  mã tướng lạ, mã bản trùng, xóa.
- Dữ liệu 11/11/2026: tổng tỷ lệ chọn 1002,27% (≈ 10 tướng mỗi trận), tỷ lệ thắng bình quân theo lượt chọn 49,98%;
  bảng Chỉ số giảm dần đúng thứ tự; 130/130 dòng khớp tướng/dạng Wiki.

## Hiển thị trên Wiki (đề xuất, chưa làm)

Nên hiện, với điều kiện:

1. Chỉ lần chụp **đã xác nhận**, mới nhất cho mỗi chế độ; giá trị còn cờ hiện “—”. Luôn ghi rõ “Số liệu trong game
   ngày dd/mm/yyyy · Đấu hạng Tinh Anh trở lên · máy chủ Việt Nam” và nguồn “Bảng Phân Bậc Tướng”.
2. **Trang tướng:** một thẻ nhỏ “Đấu hạng” cạnh phần tổng quan: huy hiệu tier, ba tỷ lệ có thanh ngắn, bốn chỉ số mỗi
   trận, “mạnh khi gặp” ba chân dung có link, mũi tên tăng/giảm so với lần chụp xác nhận trước nếu có. Dạng (Flowborn)
   hiện số của dạng đang xem.
3. **Trang “Bảng xếp hạng tướng”** riêng: nhóm theo tier, lọc vai trò, bấm tiêu đề cột để sắp xếp; trang tĩnh
   prerender (ADR-022) — từ khóa “tier list Liên Quân” có giá trị tìm kiếm.
4. API công khai riêng (ví dụ `GET /ranking-snapshots/latest?region=VN&mode=RANKED_ELITE`) chỉ trả bản đã xác nhận,
   bỏ `note`, `readText`, dẫn chứng.
5. Người dùng cần quyết: có muốn hiển thị số liệu lấy từ giao diện game của Garena (kèm ghi nguồn) không, và tần suất
   chụp (gợi ý mỗi tuần và ngay sau mỗi bản cập nhật cân bằng).

Phiên đang làm lại giao diện Wiki công khai nên quyết định chỗ đặt thẻ và trang.
