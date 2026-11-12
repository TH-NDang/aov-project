# ADR-028 — Cài đặt bảo mật tài khoản: đổi mật khẩu bằng mã email, phiên đăng nhập, xác thực hai bước

- Trạng thái: Chấp nhận — chủ dự án chọn phương án ngày 09/11/2026: gửi mã qua SMTP chuẩn (Mailpit ở local),
  nhập mật khẩu mới trong trang Wiki, xác thực hai bước tùy chọn cho mọi tài khoản và Admin có ô nhập mã,
  màn hình bật/tắt xác thực hai bước nằm trên trang Keycloak theme `aov-public`.
- Phạm vi: module `user` trong `wiki-service`, realm Keycloak `wikiaov` (local và `infra/`), theme `aov-public`,
  frontend `aov-wiki` (dùng được cho app công khai khác cùng đăng nhập), ô mã trong form đăng nhập `admin-aov`.
- Bổ sung: [ADR-007](ADR-007-admin-auth-gateway.md) (ô mã OTP ở Direct Grant) và
  [ADR-008](ADR-008-shared-user-profiles.md) (ngoại lệ form mật khẩu trong frontend).

## Bối cảnh

Người đọc đăng nhập Wiki/Stream bằng Code + PKCE trên trang Keycloak theme AOV. Keycloak sở hữu mật khẩu,
bí mật OTP, mã khôi phục và phiên; module `user` chỉ giữ hồ sơ hiển thị (ADR-008). Trang Cài đặt tài khoản cần:
đổi mật khẩu có mã một lần gửi qua email trước khi mật khẩu mới có hiệu lực; xem và đăng xuất thiết bị;
bật/tắt xác thực hai bước bằng ứng dụng Authenticator (TOTP).

Kiểm tra trên Keycloak 26.4.0 local (realm thử riêng, đã xóa sau khi thử):

- Có sẵn required action `CONFIGURE_TOTP` (QR, khóa nhập tay, mã đầu tiên), `CONFIGURE_RECOVERY_AUTHN_CODES`
  (12 mã, chỉ hiện một lần) và `delete_credential`, gọi được từ ứng dụng bằng tham số `kc_action`.
  Keycloak quay về `redirect_uri` kèm `kc_action_status=success|cancelled` và một authorization code mới.
- Browser flow mặc định có subflow `Browser - Conditional 2FA`: khi tài khoản có OTP, sau mật khẩu sẽ hỏi mã 6 số.
  Form mã khôi phục trong subflow đang DISABLED.
- `delete_credential` kèm `max_age=0` bắt nhập lại mật khẩu rồi mã OTP trước khi xác nhận xóa.
  Xóa OTP không xóa mã khôi phục còn lại.
- Direct Grant với tài khoản có OTP cần tham số `totp`; sai mật khẩu, thiếu mã hoặc sai mã đều trả
  `401 invalid_grant` giống nhau.
- Không có OTP qua email dựng sẵn. Admin API trả phiên (IP, thời điểm, client) nhưng không có trình duyệt/HĐH.
  Account API (`/account/sessions/devices`) có trình duyệt/HĐH và đánh dấu phiên hiện tại; token phải có
  audience `account` và role `manage-account`. Standard Token Exchange V2 (bật sẵn ở 26.4) đổi được token người dùng
  sang audience `account` mà giữ nguyên `sid`.

## Quyết định

### Phân chia trách nhiệm

| Tính năng | Nơi xử lý | Dữ liệu wiki-service giữ |
|---|---|---|
| Đổi/đặt mật khẩu | wiki-service gửi và kiểm mã email, rồi đặt mật khẩu qua Keycloak Admin API | Phiếu mã (hash, hạn, số lần thử) |
| Thiết bị và phiên | wiki-service đọc Admin API, bổ sung thông tin thiết bị từ Account API qua token exchange; đăng xuất qua Admin API | Không |
| Xác thực hai bước | Keycloak (required action trên trang theme AOV); wiki-service chỉ đọc trạng thái | Không |

Không lưu mật khẩu, bí mật OTP, mã khôi phục hoặc bản sao phiên trong database của wiki-service.

### Client Keycloak cho backend

- Client `wiki-service` thành confidential client thật: secret chỉ backend giữ qua biến môi trường
  `WIKI_SERVICE_CLIENT_SECRET`, không log, không trả về frontend. Không bật standard flow hoặc Direct Grant.
- Service account có đúng hai role `realm-management`: `view-users`, `manage-users`.
  Lộ secret cho phép sửa tài khoản trong realm; xoay vòng secret khi nghi lộ, giới hạn mạng tới Keycloak khi deploy.
- Bật `standard.token.exchange.enabled` và audience mapper `account` cho client này. Backend chỉ đổi token
  của chính request đang xử lý, dùng ngay để đọc thiết bị, không lưu. Đổi token thất bại hoặc người dùng không có
  role `manage-account` thì danh sách phiên vẫn trả về, chỉ thiếu thông tin thiết bị.
- Token của SPA giữ nguyên audience; SPA không gọi Admin API hoặc Account API của Keycloak.
- Backend gọi Keycloak qua `wiki.auth.identity-backchannel-uri` như gateway admin (ADR-021); trình duyệt vẫn dùng
  địa chỉ công khai.

### Đổi mật khẩu bằng mã email

- Trang Cài đặt nhận mật khẩu mới (ngoại lệ có chủ đích với ADR-008). Mật khẩu chỉ đi qua backend ở bước xác nhận,
  được chuyển ngay sang Admin API `reset-password`, không lưu, không log, không ghi audit.
- Bước 1 tạo phiếu: sinh mã 6 chữ số bằng `SecureRandom`, chỉ lưu SHA-256 của `(id phiếu, mã)`, hạn 10 phút,
  tối đa 5 lần nhập sai. Phiếu mới vô hiệu phiếu cũ còn chờ. Giới hạn 1 phiếu/60 giây và 5 phiếu/giờ cho mỗi tài khoản.
  Gửi tới email Keycloak đang lưu, kể cả khi email chưa xác minh; giao diện hiển thị email đã che.
- Bước 2 nhận mã và mật khẩu mới cùng lúc. Đúng mã thì chuyển phiếu sang trạng thái đang áp dụng trong một
  transaction, gọi Keycloak ngoài transaction, rồi đánh dấu đã dùng và ghi audit. Keycloak từ chối theo password
  policy thì trả phiếu về trạng thái chờ để thử mật khẩu khác bằng cùng mã còn hạn.
- Tài khoản chỉ đăng nhập Google (chưa có mật khẩu) dùng cùng luồng để đặt mật khẩu.
- Mặc định đăng xuất các phiên khác sau khi đổi; người dùng bỏ chọn được. Gửi thêm email thông báo đã đổi mật khẩu;
  lỗi gửi thông báo không hoàn tác việc đổi mật khẩu.
- Phiếu hết hạn quá 1 ngày được xóa khi tạo phiếu mới.

### Thiết bị và phiên

- Phiên hiện tại xác định bằng claim `sid` của access token. Danh sách lấy từ Admin API (nguồn chính) và ghép trình
  duyệt, hệ điều hành, loại thiết bị từ Account API nếu có. Chỉ hiển thị IP, chưa suy ra vị trí: chưa có cơ sở dữ liệu
  GeoIP. Production phải cấu hình proxy để Keycloak ghi IP thật của người dùng.
- Đăng xuất một phiên kiểm tra phiên thuộc tài khoản trong token; không đăng xuất phiên hiện tại qua API này
  (dùng nút Đăng xuất bình thường). "Đăng xuất thiết bị khác" giữ phiên hiện tại.
- Access token đã cấp cho phiên bị đăng xuất vẫn hợp lệ tới hết hạn (giới hạn đã nêu ở ADR-007).

### Xác thực hai bước (TOTP)

- Tùy chọn cho mọi tài khoản, kể cả quản trị viên. Bật: trang Cài đặt chuyển sang Keycloak với
  `kc_action=CONFIGURE_TOTP`, xong quay về và tự mở tiếp `CONFIGURE_RECOVERY_AUTHN_CODES` để hiện mã khôi phục một lần.
- Tắt: `kc_action=delete_credential:{otpCredentialId}` kèm `max_age=0`, Keycloak bắt nhập lại mật khẩu và mã.
  Sau đó backend xóa mã khôi phục còn lại; endpoint dọn mã từ chối khi tài khoản vẫn còn OTP.
  Tạo lại mã khôi phục cũng đi qua `max_age=0`.
- Realm bật form mã khôi phục (ALTERNATIVE) trong `Browser - Conditional 2FA`. Identity provider (Google) dùng
  post-login flow `aov post broker 2fa` để hỏi mã khi tài khoản đã bật. Theme `aov-public` có bản dịch tiếng Việt cho
  các trang cấu hình OTP, mã khôi phục, nhập mã và xác nhận xóa.
- Admin: `POST /auth/login` nhận thêm `otp` tùy chọn (6 chữ số), gửi tới Keycloak dưới tên `totp`. Form không phân biệt
  được sai mật khẩu với thiếu mã nên luôn có ô mã tùy chọn. Direct Grant không nhận mã khôi phục; mất điện thoại thì
  đăng nhập Google hoặc Wiki bằng mã khôi phục.

### Email

- wiki-service gửi qua SMTP chuẩn (Spring Mail). Production chọn nhà cung cấp bằng biến môi trường `MAIL_*`;
  thiếu cấu hình người gửi thì bước gửi mã trả `503` và trang Cài đặt báo chưa đổi được mật khẩu.
- Local dùng container Mailpit trong Compose (profile `mail`, SMTP `127.0.0.1:1025`, giao diện `127.0.0.1:8025`)
  chỉ để xem email; không phải service của ứng dụng và không chạy ở production.
- Gửi email luôn ngoài transaction database.

## Đánh đổi

- Mật khẩu mới đi qua frontend và backend một lần, đổi lại bắt buộc mã email trước khi có hiệu lực. Trang Keycloak
  vẫn có thể đổi mật khẩu bằng required action `UPDATE_PASSWORD` (ví dụ quên mật khẩu) mà không qua mã email;
  luồng mã email chỉ áp dụng cho trang Cài đặt.
- Màn hình bật/tắt 2FA nằm trên Keycloak nên có một lượt chuyển trang, đổi lại bí mật OTP không rời Keycloak và
  không phụ thuộc định dạng lưu credential nội bộ của Keycloak.
- Backend phụ thuộc Admin API và Account API của Keycloak; khi nâng Keycloak phải kiểm tra lại các endpoint này,
  required action, flow và bản dịch theme.
- Phiếu mã lưu trong PostgreSQL nên đúng với nhiều replica; giới hạn tần suất tính từ bảng phiếu.

## Kiểm chứng

- Test backend: tạo phiếu, sai mã, hết hạn, quá số lần, giới hạn tần suất, mật khẩu bị policy từ chối, phiên thuộc
  người khác, phiên hiện tại, service account bị từ chối, dọn mã khôi phục khi còn OTP; adapter Keycloak với máy chủ HTTP
  giả; `POST /auth/login` chuyển `otp` và hiểu `401 invalid_grant`.
- Kiểm tra tay trên stack local: nhận mã ở Mailpit, đổi mật khẩu rồi đăng nhập lại, đăng xuất một thiết bị và các thiết bị
  khác, bật 2FA bằng mã sinh từ khóa nhập tay, đăng nhập lại được hỏi mã, tắt 2FA phải nhập mã.
- Cấu hình realm: `scripts/sync-account-security.ps1` (realm đã có, và sau lần import đầu để bật form mã khôi phục và
  flow hỏi mã sau Google, vì realm template không chứa authentication flow).
