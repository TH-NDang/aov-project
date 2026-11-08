# ADR-023 — Chế độ chơi, Cờ Liên quân và tương tác đội hình

**Trạng thái:** Chấp nhận theo yêu cầu triển khai ngày 08/11/2026.

## Bối cảnh

Người dùng yêu cầu thêm mục Chế độ chơi cho Wiki công khai và Admin, bắt đầu bằng Cờ Liên quân (chế độ
cờ tự động) với dữ liệu thu thập từ Bách khoa trong game. Wiki cần thêm phần tương tác: thích đội hình, đội
hình phổ biến/mạnh, công cụ xếp đội hình hiển thị Phe/Nghề được kích hoạt và các phân tích liên quan.

ADR-008 đặt hồ sơ người dùng dùng chung trong module `user` của `wiki-service`. ADR-018 đặt page cộng đồng,
bài viết, lượt thích bài viết, theo dõi và kiểm duyệt trong `community-service`, phục vụ aov-stream. Wiki đăng
nhập bằng client `aov-wiki`, token chỉ có audience `wiki-service`.

## Quyết định

### Nội dung chế độ chơi

- Module `gamemode` của `wiki-service` sở hữu schema `gamemode`: danh mục chế độ và cẩm nang chi tiết.
  Không thêm service mới.
- Mỗi chế độ có identity UUID + `code` ổn định và chuỗi revision `DRAFT` → `PUBLISHED`/`DISCARDED`, giống
  luồng nháp/xuất bản của danh mục khác. Revision đã xuất bản bất biến; sửa tiếp phải tạo nháp mới. Mỗi chế
  độ có tối đa một nháp đang mở. Bản công khai là revision xuất bản gần nhất.
- Chế độ chơi không gắn ruleset/patch. Tình trạng mở theo game được ghi như dữ liệu quan sát (nhãn trong game,
  ngày bắt đầu/kết thúc nếu biết, ngày quan sát), không suy ra ngày từ nhãn như “Mở hữu hạn 14 giờ”.
- Nội dung hiện chỉ có tiếng Việt (`contentLocale = vi-VN`). Wiki tiếng Anh hiển thị nội dung tiếng Việt với
  khung giao diện tiếng Anh. Bản dịch là phần mở rộng sau, không giả lập bản dịch.
- Cẩm nang chi tiết là aggregate riêng theo loại. Chế độ khai báo `guideKind`; hiện chỉ có `AUTO_CHESS`
  (Cờ Liên quân). Cẩm nang Cờ Liên quân có chuỗi revision riêng gắn với chế độ, gồm luật cơ bản, quân cờ,
  Phe, Nghề, trang bị, chúc phúc, nhiệm vụ và đội hình đề xuất. Một lần xuất bản là một ảnh chụp nhất quán
  của toàn bộ Bách khoa, để tham chiếu giữa quân cờ, Phe/Nghề và đội hình không bị lệch nhau.
- Ảnh đi qua module Media (ADR-006, ADR-014): `GAME_MODE_ART` cho ảnh chế độ đã gỡ giao diện game,
  `AUTO_CHESS_ICON` cho icon quân cờ, chiêu, Phe/Nghề, trang bị, chúc phúc. Module `gamemode` chỉ giữ UUID
  asset, báo tham chiếu qua `MediaUsageProvider`. Ảnh lấy từ game ghi credit Garena / Liên Quân Mobile.
- Ảnh chế độ đã xử lý bằng công cụ AI để gỡ chữ, nút, đồng hồ, dải thẻ chế độ, menu và UID giữ nhãn “ảnh đã
  xử lý” trong ghi chú nguồn; ảnh gốc có UID không được tải lên site.
- Quyền mới `gamemode:write` (sửa nháp) và `gamemode:publish` (xuất bản, bỏ nháp đã xuất bản không áp dụng,
  kiểm duyệt đội hình cộng đồng). Role `wiki-editor`/`wiki-publisher` nhận các quyền này như các danh mục khác.

### Tương tác đội hình

- **Chủ sở hữu:** module `gamemode` trong `wiki-service`. Lượt thích và đội hình cộng đồng gắn trực tiếp với
  quân cờ/Phe/Nghề của cẩm nang (kiểm tra mã quân cờ, xếp hạng, phân tích), cần đọc cùng transaction với dữ
  liệu cẩm nang. Đặt ở `community-service` sẽ phải đọc chéo dữ liệu Wiki hoặc sao chép danh mục, và Wiki phải
  xin thêm audience mới. Quyết định này không thay đổi ADR-018: bài viết, bình luận, theo dõi page vẫn thuộc
  `community-service`; lượt thích đội hình không phải bài viết cộng đồng.
- **Danh tính:** khóa `(issuer, subject)` lấy từ JWT đã xác minh (ADR-008), không nhận từ request. Chỉ tài khoản
  người (`HUMAN`) được thích hoặc đăng đội hình; service account bị từ chối. Không cần role quản trị.
- **Một lượt thích mỗi người mỗi đội hình:** khóa chính `(lineup_id, issuer, subject)`. `PUT .../like` và
  `DELETE .../like` là idempotent; gửi lại không tạo lượt thứ hai. Không thích đội hình của chính mình.
- **Đối tượng được thích:** đội hình đề xuất trong cẩm nang đã xuất bản (UUID ổn định trong nội dung) và đội
  hình cộng đồng đang hiển thị của cùng chế độ. Đội hình bị gỡ khỏi bản xuất bản hoặc bị ẩn giữ lượt thích cũ
  nhưng không nhận lượt mới và không xuất hiện trong xếp hạng.
- **Đội hình cộng đồng:** người đăng nhập lưu đội hình từ công cụ xếp đội hình. Đội hình mặc định công khai
  (`VISIBLE`); người có `gamemode:publish` ẩn/hiện lại kèm lý do. Tên tối đa 60 ký tự, ghi chú tối đa 280,
  1–10 quân, mã quân cờ/trang bị/Phe phải có trong cẩm nang đã xuất bản. Mỗi người tối đa 30 đội hình cho một
  chế độ. Người đăng sửa/xóa đội hình của mình bằng optimistic version.
- **Chống lạm dụng:** giới hạn theo người dùng trên mỗi instance — 60 thao tác thích/bỏ thích mỗi 10 phút,
  10 lần tạo/sửa đội hình mỗi giờ; bảng giới hạn có trần bộ nhớ như form liên hệ. Không công khai danh sách
  người đã thích; chỉ công khai số lượng. Không dùng header proxy do client gửi. Xóa tài khoản/ẩn đội hình
  không xóa lịch sử lượt thích; xếp hạng chỉ tính đội hình đang hiển thị.
- **Xếp hạng và phân tích:** “Phổ biến” theo tổng lượt thích, “Đang lên” theo lượt thích 7 ngày gần nhất,
  “Mạnh” theo hạng biên tập S/A/B/C của đội hình đề xuất. Phân tích tần suất quân cờ, Phe/Nghề kích hoạt và
  phân bố giá được tính từ đội hình đề xuất và đội hình cộng đồng đang hiển thị; không thu thập dữ liệu trận
  đấu thật của người chơi và không tuyên bố tỷ lệ thắng.
- Công cụ xếp đội hình chạy ở trình duyệt từ dữ liệu cẩm nang công khai; đội hình chưa lưu chia sẻ được bằng
  đường dẫn chứa mã quân cờ, không cần đăng nhập.

## Hệ quả

- Realm đang chạy cần thêm hai quyền mới bằng `backend/wiki-service/scripts/sync-gamemode-roles.ps1`; realm
  mới nhận từ file import.
- Giới hạn tần suất là theo instance. Khi chạy nhiều instance cần chuyển sang bộ đếm dùng chung (ADR riêng).
- Dữ liệu trong `gamemode` không là bản sao của danh mục tướng: quân cờ có thể liên kết `heroCode` tùy chọn
  nhưng chỉ số/kỹ năng của chế độ là dữ liệu riêng của chế độ.
- `/modes` và `/modes/<code>` có trang tĩnh và nằm trong sitemap như các trang công khai khác (ADR-022). Nội dung chế
  độ không chia theo thị trường hay ngôn ngữ nên script gọi API chế độ không kèm `region`/`locale`. Các tab cẩm nang
  (`/modes/<code>/<tab>`) dùng chung canonical của trang chế độ và không có trang tĩnh riêng.

## Kiểm chứng

Test PostgreSQL (Testcontainers) cho nháp/xuất bản/xung đột phiên bản, một nháp mở mỗi chế độ, cách ly nháp
khỏi public, kiểm tra tham chiếu mã trong cẩm nang, một lượt thích mỗi người, idempotent thích/bỏ thích,
chặn tự thích, chặn service account, giới hạn tần suất, ẩn đội hình và xếp hạng. Test frontend cho tính Phe/
Nghề kích hoạt, mã hóa đường dẫn chia sẻ và trang Wiki trên màn hình hẹp.
