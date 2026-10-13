# ADR-008 — Module hồ sơ người dùng dùng chung

- Trạng thái: Accepted — người dùng xác nhận ngày 12/10/2026.
- Phạm vi: `wiki-service`, admin; hồ sơ dùng chung cho wiki, stream và cộng đồng sau này.

## Quyết định

Thêm module `user` trong deployable hiện tại, sở hữu schema `user_profile`. Đây là điều chỉnh
quyết định cũ đặt hồ sơ hiển thị trong `community-service`. Các frontend dùng API, không đọc
database; khi community-service có mặt, dùng API/contract của module này thay vì tạo bản sao.
Không thêm service mới. Chưa triển khai trang hồ sơ công khai.

Keycloak sở hữu danh tính, mật khẩu, email xác minh, liên kết Google, quyền và trạng thái tài khoản.
Module user chỉ sở hữu tên hiển thị, giới thiệu, locale, múi giờ và liên kết avatar.
Khóa duy nhất `(issuer, subject)` lấy từ JWT đã xác minh; client không được gửi hoặc đổi khóa đó.
Service account không có hồ sơ cá nhân. Không copy role hoặc mật khẩu vào bảng hồ sơ.

`GET /users/me` chưa có hồ sơ trả giá trị khởi tạo với `id = null`, `version = 0`, không ghi DB.
Lần lưu đầu tiên tạo UUID và version 1. Danh sách admin chỉ chứa hồ sơ đã lưu; đây không phải danh
sách toàn bộ tài khoản trong Keycloak. Không ghi đè tên hiển thị đã lưu khi đăng nhập lại.

API cá nhân cần Bearer token hợp lệ cho audience `wiki-service`, không cần `catalog:read`.
Admin API vẫn cần `catalog:read`, thêm `user:read` để đọc và `user:write` để sửa hồ sơ khác.
Gateway đăng nhập admin vẫn dành cho người có `catalog:read`; luồng đăng nhập wiki/stream triển khai sau.
Lưu hồ sơ dùng optimistic version, trả conflict khi cũ; ghi audit cùng transaction, không ghi nội dung
giới thiệu hoặc token vào metadata audit. Chưa có xóa hồ sơ, khóa tài khoản hay chỉnh role trong UI này.

## Avatar và media

- Dùng contract công khai `media.AvatarUploads`; module user không truy cập entity/repository của media.
- Chọn ảnh → tạo asset `USER_AVATAR` và upload ticket → browser PUT trực tiếp lên storage → complete kiểm tra
  chữ ký file, kích thước/pixel/hash và copy sang key `assets/` bất biến → lưu `avatarAssetId` vào hồ sơ.
- Người dùng chỉ complete upload của mình; không cần quyền `media:write`. Asset mới được gắn phải là
  avatar đang ACTIVE, đã có version READY và thuộc người đang sửa. Quản trị viên có thể tải ảnh của mình
  rồi gắn vào hồ sơ đang được phép sửa. Giữ avatar cũ không đòi người sửa sở hữu upload cũ.
- Mỗi lượt đổi avatar tạo asset mới, tránh đổi ảnh của hồ sơ khác đang cùng tham chiếu asset.
- Gỡ avatar chỉ xóa liên kết khi lưu hồ sơ; không xóa bytes. Upload hoàn tất nhưng không lưu hồ sơ có
  thể thành asset không dùng; dọn theo chính sách media, không tự xóa file có thể còn được tham chiếu.
- `UserMediaUsage` báo tham chiếu CURRENT/AVATAR để media ngăn deprecate avatar đang dùng.
- Avatar preview dùng URL GET ký sẵn 15 phút; không lưu URL có chữ ký vào DB, không truyền bytes qua backend.
  Frontend làm mới URL định kỳ. PNG/JPEG/WebP, tối đa 25 MB (cấu hình media có thể chặt hơn); chưa crop/resize.
- Local bucket initializer đặt CORS cho đúng `ADMIN_ORIGIN`, cho PUT/GET/HEAD. Production phải provision CORS
  tương ứng bên storage; endpoint ký URL phải được trình duyệt truy cập và dùng HTTPS khi admin dùng HTTPS.

## Kiểm chứng

Test PostgreSQL + SeaweedFS độc lập: tạo/sửa hồ sơ, conflict, phân quyền, từ chối giả mạo identity,
upload URL thật, complete lại an toàn, tải bytes qua URL ký sẵn, ownership và reverse usage sau gắn/gỡ.
Frontend test thứ tự upload/complete, không gửi token/cookie tới storage, không complete khi PUT thất bại.
