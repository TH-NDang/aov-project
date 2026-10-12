# ADR-007 — Form đăng nhập admin qua backend, giữ Keycloak

- Trạng thái: Chấp nhận theo yêu cầu chủ dự án ngày 2026-10-12.
- Phạm vi: `access` trong `wiki-service`, frontend `admin-aov`.

## Bối cảnh

Admin cần form tên người dùng/email và mật khẩu nằm ngay trong modal React, không chuyển
sang giao diện Keycloak. Google vẫn mở cửa sổ riêng. Keycloak tiếp tục sở hữu tài khoản,
mật khẩu, vai trò, ký token và xác minh Google; backend không phát JWT riêng.

## Quyết định

- Thêm confidential client `admin-aov-backend`. Chỉ backend giữ client secret.
- Tài khoản/mật khẩu: backend chuyển thông tin trong request tới token endpoint của Keycloak
  bằng Direct Access Grant. Không lưu hoặc ghi log mật khẩu, request body, cookie hay token.
- Đây là ngoại lệ có chủ đích: [Keycloak](https://www.keycloak.org/securing-apps/oidc-layers)
  nêu Direct Grant không được khuyến nghị theo OAuth security BCP. Luồng này không hỗ trợ
  required actions, đăng ký hoặc MFA nhiều bước. Tài khoản cần các bước đó phải được quản trị
  viên xử lý trong Keycloak; không tắt yêu cầu bảo mật để vượt qua lỗi đăng nhập.
- Google: backend khởi tạo Authorization Code + PKCE S256, lưu state/verifier tối đa 5 phút,
  ràng buộc state với cookie HttpOnly. Popup chỉ chuyển tín hiệu hoàn tất, không chuyển token.
- Access token chỉ nằm trong bộ nhớ frontend; backend vẫn kiểm tra JWT audience `wiki-service`
  và capability. Trước khi cấp phiên admin, backend kiểm tra `catalog:read`.
- Refresh token trong cookie HttpOnly, SameSite=Lax, Secure ngoài local; path `/api/wiki/`.
  Refresh cập nhật cookie theo token mới của Keycloak. Logout revoke refresh token tại IdP
  rồi xóa cookie. Nếu revoke thất bại, báo lỗi và giữ cookie để thử lại.
- Cookie không cấp quyền gọi admin API: admin API vẫn dùng Bearer token. Các POST auth yêu cầu
  Origin khớp tuyệt đối `ADMIN_ORIGIN` và header `X-AOV-Auth: 1`; không bật CORS rộng.
- Auth response không cache. Giới hạn thử đăng nhập theo IP kết nối và tài khoản, map có giới hạn
  kích thước. Bật thêm brute-force protection của Keycloak và rate limit tại reverse proxy khi deploy.

## Giới hạn vận hành

- Mật khẩu đi qua backend một lần; production phải dùng HTTPS từ trình duyệt tới backend và IdP.
- JWT đã cấp còn hiệu lực tới hết hạn dù refresh token đã thu hồi; đặt access-token lifespan ngắn
  (5 phút cho client này). Đây không phải cơ chế thu hồi JWT tức thời.
- OAuth state và rate limiter đang lưu trong bộ nhớ một instance. Khởi động lại làm mất flow Google
  đang dở; triển khai nhiều replica cần sticky routing cho flow hoặc bổ sung lưu trữ dùng chung có ADR.
- Không tin `X-Forwarded-For` tùy ý. Limiter dùng IP kết nối; reverse proxy phải quản lý giới hạn IP thật.
- Đăng xuất ứng dụng không đăng xuất tài khoản Google trên toàn trình duyệt.
- Không tự cấp role admin cho tài khoản Google mới. Quản trị viên phải gán capability phù hợp.
- Chưa thêm reset mật khẩu, đăng ký, quản lý người dùng hoặc MFA vào UI admin.
