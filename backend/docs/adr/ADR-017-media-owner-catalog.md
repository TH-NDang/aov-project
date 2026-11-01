# ADR-017 — Danh mục chủ sở hữu ảnh

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-01

## Bối cảnh

Từ V035, mỗi nguồn ảnh (`media_provenance`) lưu `owner_name` là chuỗi tự do. Người biên tập gõ tay
nên cùng một chủ sở hữu dễ có nhiều cách viết ("Garena", "garena", "Garena / Liên Quân Mobile").
Khi đó số liệu bản quyền bị tách đôi, và muốn sửa một cách viết phải bổ sung lại nguồn cho từng ảnh.
Nguồn ảnh chỉ được thêm, không sửa, nên không có cách đổi tên chủ sở hữu cho mọi ảnh cùng lúc.

## Quyết định

- Thêm bảng `media.media_owner`: `id`, `name` (tên hiển thị, tối đa 200), `name_key` (duy nhất),
  `contact_url` tùy chọn, `lock_version`, `created_at`, `updated_at`. `name` là tên đã bỏ khoảng trắng
  đầu/cuối và gộp khoảng trắng liên tiếp; `name_key` là `name` viết thường. Hai tên chỉ khác hoa/thường
  hoặc khoảng trắng là cùng một chủ sở hữu.
- `media_provenance` thêm `owner_id` (nullable, FK). `owner_name` vẫn được giữ làm bản sao tên hiển
  thị, nên mọi luồng đọc (chi tiết, danh sách, bộ lọc thiếu nguồn, `MediaCredit` công khai) không đổi.
- Khi ghi nguồn (tạo asset, hoàn tất upload, đăng ký import, bổ sung nguồn), `ownerName` vẫn là chuỗi.
  Backend chuẩn hóa tên, gắn vào chủ sở hữu cùng `name_key`, chưa có thì tạo mới. Tên được lưu là tên
  hiển thị của chủ sở hữu. Tạo mới dùng `INSERT ... ON CONFLICT DO NOTHING` để hai yêu cầu đồng thời
  không tạo trùng. Nguồn không ghi `contactUrl` thì nhận `contact_url` của chủ sở hữu.
- Đổi tên hoặc liên hệ của chủ sở hữu cập nhật bản sao trên mọi nguồn của chủ sở hữu đó trong cùng
  transaction. Liên hệ chỉ được thay ở các nguồn đang mang liên hệ cũ của chủ sở hữu; liên hệ riêng
  của từng nguồn giữ nguyên.
- Gộp chủ sở hữu chuyển mọi nguồn sang chủ sở hữu đích (cả `owner_id` lẫn `owner_name`) rồi xóa chủ
  sở hữu cũ. Nhãn, URL, ghi chú, thời điểm của nguồn không đổi.
- Đây là ngoại lệ có chủ đích với tính chỉ-thêm của nguồn ảnh: chỉ `owner_id`, `owner_name`,
  `contact_url` được viết lại, và chỉ qua thao tác trên danh mục chủ sở hữu, có audit
  `MEDIA_OWNER_UPDATED` / `MEDIA_OWNERS_MERGED`.
- Migration tạo chủ sở hữu từ các `owner_name` đang có; cách viết dùng nhiều nhất của mỗi khóa thành
  tên hiển thị, rồi gắn `owner_id` và đồng bộ `owner_name` cho nguồn cũ.
- Backend vẫn không tự suy ra chủ sở hữu từ URL, tên file hay tên đội. Giao diện chỉ gợi ý tên đã có
  và hỏi lại khi tên mới gần giống tên sẵn có (so sánh không dấu); người biên tập quyết định.

## Đánh đổi

- Bản sao `owner_name` làm việc đổi tên phải cập nhật nhiều dòng, nhưng giữ nguyên mọi truy vấn đọc
  và hợp đồng công khai. Số nguồn hiện khoảng vài nghìn dòng nên cập nhật trong một transaction là đủ.
- Khóa chỉ bỏ qua hoa/thường và khoảng trắng; "Garena" và "Garena / Liên Quân Mobile" vẫn là hai chủ
  sở hữu. Việc nhận ra hai tên gần giống thuộc về giao diện, và người biên tập có thể gộp sau.
- Phiên upload đang chờ vẫn giữ tên đã gõ; nếu chủ sở hữu bị đổi tên trước khi hoàn tất, tên cũ sẽ
  tạo lại một chủ sở hữu và có thể gộp.

## Kiểm chứng

- Test tích hợp: ghi nguồn với tên khác hoa/thường dùng chung một chủ sở hữu và tên hiển thị chuẩn;
  đổi tên cập nhật nguồn trong chi tiết, danh sách và `MediaAssets`; trùng tên trả
  `MEDIA_OWNER_NAME_TAKEN`; phiên bản cũ trả `MEDIA_OWNER_VERSION_CONFLICT`; gộp chuyển nguồn và xóa
  chủ sở hữu cũ; người chỉ có `catalog:read` không đổi tên hay gộp được.
- Kiểm tra OpenAPI bao phủ ba endpoint mới.
