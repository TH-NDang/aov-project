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
