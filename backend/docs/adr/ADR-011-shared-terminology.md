# ADR-011: Thuật ngữ và tham chiếu dùng chung

Ngày: 2026-10-20. Trạng thái: Chấp nhận theo yêu cầu chuyển sang backend dùng chung admin/wiki.

## Bối cảnh

Cấu hình tooltip và thuật ngữ đang dùng JSON của Vite, không có persistence/phân quyền production.
Mô tả tướng đã dùng parser và trình soạn chung. Cần giữ các khóa trong thẻ tham chiếu hiện có,
đồng thời không đưa dữ liệu nháp của admin sang wiki.

## Quyết định

Tạo module `terminology` trong wiki-service hiện tại, không thêm service hoặc hạ tầng ngoài.
Dùng JPA và migration V029, tách entry và translation. Khóa DB của entry là UUID; reference_key
là khóa renderer tương thích dữ liệu cũ (slug hoặc UUID), unique trong từng kind.
Aliases lưu JSONB trong bản dịch, có giới hạn và kiểm tra trùng locale. Cấu hình chung được khóa
và kiểm tra expectedVersion khi cập nhật toàn bộ; ghi audit bằng actor xác thực từ access.

Dùng lại `catalog:read`/`hero:write` cho biên tập chung; không tự cấp quyền hoặc thay realm Keycloak.
Thiết lập được công khai sau khi lưu. Thuật ngữ chung không phụ thuộc patch; các tướng/trang bị
trong catalog công khai phải qua read model đã xuất bản và hiệu lực theo thị trường.
`PublicReferenceProvider` là contract để các module cung cấp read model; terminology không đọc
repository/internal của module khác. Không trả đích admin trong response công khai.

Ảnh tướng/trang bị do module gốc và Media quản lý; provider đọc URL qua contract MediaAssets.
Tùy chỉnh icon ở đây là URL hiển thị, không tạo upload hoặc sở hữu asset mới. Không gọi object
storage hoặc HTTP ngoài trong transaction cấu hình. Không lưu JSON mẫu nháp, token hoặc actor do
client gửi. GET công khai có ETag và revalidate; admin luôn no-store.

## Hệ quả

API và parser hỗ trợ dùng chung admin/wiki, các bản dịch vẫn độc lập. Frontend wiki chỉ được dùng kiểm tra rồi gỡ tích hợp thử trong đợt này theo yêu cầu. Cần quyền xuất bản và
quy trình xét duyệt riêng nếu muốn thuật ngữ có trạng thái nháp trong tương lai; đợt này lưu là áp dụng.
File Vite cũ chỉ còn nguồn chuyển đổi thủ công vào bản nháp để rà soát trước khi lưu, không bị xóa.

## Bổ sung: tham chiếu trong văn bản cộng đồng (24/11/2026)

Bộ phân tích dùng chung có hai phạm vi nhận diện. `game` (mặc định, Admin và Wiki) giữ nguyên: chỉ tên của game, mọi kiểu
hoa thường. `all` trước đây chỉ có trong test, nay là phạm vi của văn bản thường ngày (giới thiệu, lịch sử, bài viết, bình
luận): nhận thêm hệ thống giải, tổ chức, giải, đội, tuyển thủ, nhân sự và chế độ chơi, theo quy tắc riêng chặt hơn trong
đặc tả 04. Không có bộ nhận diện thứ hai; cùng một vòng lặp, một kiểu nút và một cách viết `<ref=kind:id>`.

- Danh sách tên do community-service công bố (`/references`), không đi qua `reference-catalog` của wiki-service: mỗi service
  công bố dữ liệu của mình, trình duyệt ghép hai danh sách. Không service nào gọi service kia để nhận diện.
- Nhận diện ở trình duyệt khi hiển thị thay vì lưu liên kết lúc ghi: văn bản cũ có liên kết ngay, dữ liệu không mang liên kết
  hỏng, và dữ liệu đã công bố không phải viết lại. Đổi lại, trình duyệt tải danh sách tên (52 KB nén, thêm 162 KB khi văn bản
  có thể nhắc người) và giữ lại cho lần sau.
- Danh sách không mang ảnh và họ tên thật (đặc tả 04, "Người không có ảnh"). Thẻ xem trước đọc riêng từng mục.
- Tên trong văn bản thường ngày được chứng minh bằng ngữ cảnh thay vì bằng danh sách từ chặn: dữ liệu thật có biệt danh "Top",
  "Nam", "Vietnam" và đội "Hà Nội", "First Blood", nên đúng chữ là chưa đủ.
- Nội dung của Wiki trên Stream đọc từ `reference-catalog` công khai. Tướng theo `autoMatch` mà Admin đặt; trang bị, phù hiệu,
  ngọc, phụ trợ theo quy tắc tên ở trên. Thuật ngữ không nhận trên Stream.
- `GET /references` giữ bản đọc trong bộ nhớ của service, không thêm Redis: danh sách nhỏ, một tiến trình, và dấu hiệu phiên
  bản đọc từ chính cơ sở dữ liệu nên không trả bản cũ sau khi công bố hay thu hồi.
