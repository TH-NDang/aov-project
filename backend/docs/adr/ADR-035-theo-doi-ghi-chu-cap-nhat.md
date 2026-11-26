# ADR-035 — Theo dõi ghi chú cập nhật của nhà phát hành

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-26

## Bối cảnh

Dữ liệu patch của Wiki được nhập tay từ bài cập nhật của Garena và các nhà phát hành khác, cả bản chính thức và máy chủ
thử nghiệm. Biên tập viên phải tự mở từng trang để biết có bài mới. Các trang không giống nhau (kiểm tra 26/11/2026):

| Nguồn | Kênh | Cách đọc danh sách |
|---|---|---|
| `lienquan.garena.vn` (VN) | chính thức | RSS của chuyên mục cập nhật (WordPress), có ETag |
| `www.rov.in.th` (TH) | chính thức và thử nghiệm | `sitemap.xml`, trang `/patch-notes/<slug>`; slug `expserver…` là máy chủ thử nghiệm |
| `exp.moba.garena.tw` (TW) | thử nghiệm | trang chủ, danh sách `#p_names` có ngày `MM/DD`; bài ghi là máy chủ trải nghiệm Việt Nam |
| `moba.garena.tw/news` (TW) | chính thức | danh sách tin, lọc tiêu đề có `更新公告`, `改版`, `版本更新`, `更新內容`, `平衡調整` |
| `main.aov.garena.co.id/news/update` (ID) | chính thức | trang chỉ hiện bài sau khi script chạy; API phía sau cần khóa nhúng trong site, không có RSS hay sitemap |

Máy chủ thử nghiệm VN chỉ báo trong game và Facebook; khu vực EU/NA đã đóng.

## Quyết định

- `wiki-service` có phần `internal/watch` trong module `patch`. Mỗi nguồn là một giá trị của `PatchNoteSource` với cách
  đọc riêng (RSS, sitemap, danh sách HTML, trang đã hiện bài). Bài tìm thấy vào `patch.note_post` (`NEW`, `DONE`,
  `DISMISSED`, `EARLIER`), trạng thái đọc và lịch vào `patch.note_source_check`. Không tự tạo dữ liệu patch: biên tập viên
  mở bài và nhập như trước.
- Lịch theo từng nguồn: mặc định mỗi ngày 08:00 giờ Việt Nam (`wiki.patch-watch.zone`), đổi trong Admin thành giờ khác,
  mỗi 1 đến 24 giờ, hoặc tạm dừng. Một tác vụ chạy 5 phút một lần trên luồng riêng, đọc nguồn đến hạn.
  `PATCH_WATCH_ENABLED=false` tắt lịch; Admin vẫn xem được và vẫn có nút Kiểm tra ngay.
- Đọc nhẹ: chỉ trang danh sách, GET có điều kiện khi nguồn có ETag hoặc Last-Modified, tối đa 4 MB, không cookie, User-Agent
  chung không nêu tên site, tối đa 5 lần đọc tiêu đề bài mỗi lần. Lỗi liên tiếp đẩy lần thử lại ra 30 phút × 2^(n−1), tối
  đa 6 giờ và không quá lần đọc theo lịch. Kiểm tra ngay bỏ qua nguồn vừa đọc trong 2 phút.
- Lần đầu đọc một nguồn, bài cũ hơn 14 ngày vào `EARLIER` thay vì `NEW`.
- Indonesia: không dùng khóa API nhúng trong site. Dịch vụ `page-reader` (`infra/page-reader`, Node với Chromium không
  giao diện của Alpine) mở đúng trang tin như trình duyệt của người xem rồi trả lại trang đã hiện bài; `wiki-service` gọi
  nó qua `PATCH_WATCH_PAGE_READER_URL`. Nó chỉ mở trang trong danh sách của nó, bật trình duyệt cho từng lần đọc rồi tắt,
  bỏ tải ảnh và font, đọc một lần một trang, không mở cổng ra ngoài mạng của stack, chạy read-only không capability. Chỉ
  chạy trên máy chủ; máy dev không có nó thì nguồn Indonesia hiện "Chỉ đọc được trên máy chủ".
- Admin có trang Theo dõi cập nhật: hộp bài theo trạng thái, thẻ nguồn với lịch và kết quả lần đọc gần nhất, thêm bài tay
  (cho bài ở trang chưa theo dõi như Facebook), kiểm tra ngay. Số bài `NEW` hiện ở menu và bảng điều khiển. Đọc cần
  `catalog:read`, ghi cần `patch:write`; mỗi thay đổi có audit.

## Đánh đổi

- Bộ đọc HTML phụ thuộc giao diện từng trang. Trang đổi giao diện thì lần đọc báo `UNREADABLE` trên thẻ nguồn, không
  âm thầm trả danh sách rỗng; sửa bằng cách cập nhật bộ đọc.
- Ngày `MM/DD` của trang Đài Loan không có năm; năm được suy ra theo hôm nay (ngày ở tương lai quá 7 ngày là năm trước).
- `page-reader` tốn khoảng 200 đến 300 MB trong lúc đọc và một image mới cần build, đẩy và triển khai. Đổi lại không cần
  khóa của Garena và không phải đoán API riêng của site.
- Không theo dõi Facebook hay trong game; bài ở đó được thêm tay.

## Kiểm chứng

- Unit test bộ đọc từng nguồn với mẫu cấu trúc của trang thật, quy tắc lịch và lùi thời gian thử lại.
- Integration test (Testcontainers) cho lần đọc lưu bài một lần, `NEW`/`EARLIER`, thử lại sau lỗi, đổi trạng thái có
  version, quyền, thêm tay trùng, địa chỉ không phải web, đổi lịch và tạm dừng.
- Workflow `page-reader` chạy test của dịch vụ, build image và khởi động Chromium trong image với giới hạn của Compose.
- Test Admin cho hộp bài, đổi lịch và nguồn không đọc được.
