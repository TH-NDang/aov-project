# ADR-012: Danh mục tham chiếu gọn và Redis cho read model

Ngày: 2026-10-20. Trạng thái: Chấp nhận theo yêu cầu tối ưu truy vấn và bổ sung Redis.

## Bối cảnh

Admin tải danh sách tướng rồi gọi chi tiết từng revision chỉ để lấy tên, mô tả ngắn và ảnh head.
Kho trang bị tải cả nội dung và công thức. Danh mục công khai còn truy vấn Media theo từng dòng.
HTTP ETag giảm băng thông nhưng chưa tránh việc dựng lại kết quả trên backend.

## Quyết định

- Bổ sung API danh mục admin gọn, chỉ lấy projection cần cho tham chiếu bằng truy vấn theo nhóm,
  giữ toàn bộ bản dịch và ngữ cảnh ruleset. Admin được dùng bản nháp; public chỉ dùng bản đã xuất bản.
- Redis là cache có thể bỏ, không phải nguồn dữ liệu chính. Chỉ cache JSON read model danh mục
  tham chiếu admin/public và thuật ngữ công khai. Không cache bytes ảnh, token, phiên đăng nhập,
  hồ sơ cá nhân hoặc kết quả lỗi. Không dùng Java serialization hoặc polymorphic default typing.
- Mỗi namespace có TTL ngắn, tiền tố có phiên bản schema, khóa ngữ cảnh được băm và giới hạn
  dung lượng mỗi giá trị. Admin kiểm tra quyền trước khi đọc cache, namespace tách khỏi public.
- `platform.catalog_cache_epoch` là hàng điều phối nhỏ trong PostgreSQL. Cache key chứa epoch.
  Mọi thay đổi catalog đã ghi audit tăng epoch trong cùng transaction trước commit, một lần mỗi
  transaction. Flush JPA trước khi khóa hàng epoch để không giữ khóa cache rồi mới khóa domain.
  Rollback cũng rollback epoch. Không gọi Redis trong transaction ghi.
- Mỗi cache lookup đọc epoch từ DB chính. Chi phí một truy vấn nhỏ thay cho nhiều truy vấn dựng
  catalog; tránh dữ liệu cũ sống lại sau khi Redis ngừng hoạt động, restart hoặc một request cũ
  ghi cache muộn. Khóa epoch cũ tự hết TTL, không quét/xóa toàn bộ Redis.
- Không đọc/ghi cache dùng chung trong transaction ghi, tránh chia sẻ dữ liệu chưa commit.
  Danh mục public xác định lại patch đang hiệu lực trước lookup để lịch phát hành tự chuyển đúng mốc.
- Khi Redis lỗi, đọc trực tiếp DB, timeout ngắn và tạm ngừng thử Redis trong khoảng backoff.
  Có counter hit/miss/bypass/error để quan sát hiệu quả. Lỗi DB vẫn được báo đúng, không che bằng cache cũ.
- Compose local thêm Redis chỉ bind loopback, giới hạn bộ nhớ, không lưu bền. Production bật bằng
  cấu hình riêng, dùng mạng riêng và thông tin xác thực/TLS từ môi trường.

## Hệ quả

Không cần gọi từng tướng từ trình duyệt. Số truy vấn dựng danh mục tăng theo số module, không theo
số dòng; tham chiếu Media được đọc theo lô. Redis giảm tải dựng lại cùng read model giữa các client.
Epoch chung là invalidation bảo thủ; nhập liệu liên tục sẽ giảm cache hit và có thêm một thao tác
ghi nhỏ mỗi transaction. Chỉ tách epoch theo domain khi số liệu thực tế chứng minh cần thiết.
Redis không thay HTTP cache/CDN. Việc nâng phiên bản ảnh vẫn dùng URL bất biến và làm mới metadata.

## Mở rộng kỹ năng (2026-10-20)

Kỹ năng dùng endpoint tìm kiếm phân trang và lookup tối đa 50 khóa ghép tướng/kỹ năng; không đổ
toàn bộ kỹ năng vào catalog. Cache giá trị page có kiểu JSON cụ thể, tiền tố `skills:v1`, tách khóa
q/IDs, ruleset, locale, heroId, page/size; public thêm region và patch đang áp dụng. Chính sách epoch,
quyền trước cache và bypass lỗi giữ nguyên. Đọc projection theo lô trong transaction REPEATABLE_READ,
đóng transaction trước khi ghi Redis. Không cache lịch sử chưa đủ quyền hoặc ảnh thư viện như dữ
liệu gameplay công khai.
