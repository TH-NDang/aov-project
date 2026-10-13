# Admin AOV

## Đăng nhập hiện tại

Form tên người dùng/email và mật khẩu nằm trong modal của admin. Backend chuyển thông tin
đến Keycloak bằng confidential client riêng; frontend không giữ client secret hoặc refresh token.
Google mở cửa sổ riêng, backend xử lý Authorization Code + PKCE rồi đặt cùng loại cookie phiên.
Giao diện không tự chuyển sang trang Keycloak khi mở admin.

Access token chỉ giữ trong bộ nhớ; refresh token nằm trong cookie HttpOnly. POST auth yêu cầu
Origin đúng và header chống CSRF. Quyền/tên người dùng lấy từ API `/api/wiki/v1/admin/me`.
Đăng xuất thu hồi refresh token và xóa cache truy vấn; không xóa dữ liệu mẫu người dùng đã sửa.
Google chỉ bật khi backend báo đã cấu hình. Không tự cấp quyền admin cho tài khoản Google mới.

## Cấu hình Keycloak cho realm đã tồn tại

File realm không tự cập nhật vào dữ liệu Docker đã tạo trước đó. Không xóa volume để áp dụng.
Trong Keycloak Admin Console, chọn realm `wikiaov`:

1. Tạo OpenID Connect client `admin-aov-backend`.
2. Bật **Client authentication**, **Standard flow**, **Direct access grants**.
   Tắt Implicit flow và Service accounts. Client frontend `admin-aov` cũ không cần đổi.
3. Valid redirect URI: `http://localhost:5175/api/wiki/v1/auth/google/callback`.
   Không cần thêm Web Origins vì backend thực hiện trao đổi token.
4. Trong Advanced, đặt PKCE code challenge method **S256**, access token lifespan **5 phút**.
5. Thêm audience mapper cho access token với Included Client Audience = `wiki-service`.
   Giữ client scope `roles` để token có `resource_access.wiki-service.roles`.
6. Lấy secret ở tab Credentials và đặt vào biến môi trường `ADMIN_AUTH_CLIENT_SECRET` của backend.
   Không đưa secret vào frontend, Git hoặc nội dung chat.
7. Bật brute-force protection của realm. Trong Tokens bật Revoke Refresh Token, Max Reuse = 0.

Tài khoản local có sẵn trong realm vẫn dùng được nếu có capability `catalog:read`.
Direct Grant không hỗ trợ required actions/MFA nhiều bước. Xử lý các tài khoản có yêu cầu này
trong Keycloak; không bỏ yêu cầu xác minh để làm cho form hoạt động. Xem ADR-007.

## Google

Trong realm `wikiaov`, tạo Identity Provider **Google**, alias `google`, bật Enabled và hiển thị
trên trang đăng nhập. Tạo OAuth client dạng Web application trong Google Cloud:

- Authorized redirect URI local: `http://localhost:8081/realms/wikiaov/broker/google/endpoint`.
- Điền Google Client ID và Client Secret vào Identity Provider của Keycloak, không điền ở frontend.
- Nếu ứng dụng Google đang ở chế độ testing, thêm tài khoản thử vào danh sách test users.
- Giữ bước xác nhận liên kết tài khoản; không tự liên kết tài khoản chỉ dựa vào email chưa xác minh.
- Gán quyền quản trị phù hợp cho tài khoản Google tại Keycloak trước khi dùng admin.

Sau khi cấu hình xong, đặt `GOOGLE_LOGIN_ENABLED=true` ở backend và khởi động lại backend.
Nếu chưa có Google OAuth credentials thì đăng nhập tài khoản vẫn dùng được; nút Google bị vô hiệu hóa.

## Chạy local

Bạn tự chạy các lệnh sau (agent không tự khởi động dịch vụ):

Trong `backend/wiki-service`, sau khi đã có client/secret:

```powershell
$env:ADMIN_AUTH_CLIENT_SECRET = "SECRET_TU_KEYCLOAK"
docker compose --profile identity up -d
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Với realm hoàn toàn mới, compose truyền biến secret này vào file import. Với realm đã tồn tại,
phải thực hiện các bước cấu hình client trên; import không ghi đè realm.

Trong `frontend`:

```powershell
pnpm --filter @aov/admin-aov dev
```

Mở `http://localhost:5175`. Vite proxy `/api/wiki` về `http://localhost:8080`.
Đặt biến môi trường shell `WIKI_API_TARGET` nếu cần đổi backend target.

Production dùng HTTPS, cookie Secure mặc định bật; đặt `ADMIN_ORIGIN` bằng origin chính xác
(không có dấu / cuối), `ADMIN_BASE_PATH=/admin/` nếu phục vụ app dưới /admin/.
Build Vite với base tương ứng và reverse proxy phục vụ cả các file HTML/JS trong public/auth.
Keycloak redirect URI phải khớp origin production + `/api/wiki/v1/auth/google/callback`.
Không triển khai Vite dev/preview ra public. State Google hiện lưu trong bộ nhớ một backend;
muốn nhiều replica cần cấu hình/thiết kế bổ sung theo ADR-007.

## Phạm vi dữ liệu

Auth nối backend thật. Các trang tướng/trang phục/trang bị vẫn dùng `createMockApi()`;
JSON storage vẫn là công cụ phát triển cục bộ, không phải API production có phân quyền.
Khi chuyển dữ liệu sang backend, dùng `backendRequest` để gửi Bearer token.

## Kiểm tra sau thay đổi

Trong `frontend`:

```powershell
pnpm exec prettier --write apps/admin-aov/src/app/auth apps/admin-aov/src/main.tsx apps/admin-aov/src/lib/api/authenticated-client.ts apps/admin-aov/tests/auth.test.ts
pnpm --filter @aov/admin-aov typecheck
pnpm --filter @aov/admin-aov test:auth
pnpm --filter @aov/admin-aov build
```

Trong `backend/wiki-service`:

```powershell
./mvnw.cmd spotless:apply
./mvnw.cmd "-Dtest=AuthControllerTest,AuthGuardsTest,AuthSessionsTest,SecurityConfigurationTest,KeycloakJwtAuthenticationConverterTest,SecurityContextCurrentActorTest" test
./mvnw.cmd verify
```

Kiểm tra thủ công: sai mật khẩu; đúng mật khẩu có/không quyền; reload khôi phục phiên; đăng xuất;
Google thành công/hủy/chặn popup; modal trên mobile; logout ở tab khác.

## Hồ sơ người dùng và avatar

- Menu **Hồ sơ của tôi** (`/profile`): tên hiển thị, giới thiệu, ngôn ngữ, múi giờ; chọn/gỡ avatar rồi bấm **Lưu hồ sơ**.
- Menu **Người dùng** (`/users`) chỉ hiện khi token có client role `wiki-service:user:read`.
  Sửa hồ sơ người khác cần thêm `user:write`. Admin API vẫn cần `catalog:read`.
- Có thể tự động áp dụng quyền cho admin bằng `./scripts/sync-user-roles.ps1` từ `backend/wiki-service`.
  Script hỏi tài khoản quản trị Keycloak, bổ sung quyền còn thiếu và kiểm tra lại; chạy lại không tạo trùng.
- Với realm đã tồn tại, thêm hai client role `user:read`, `user:write` vào `wiki-service`, thêm chúng vào composite
  `wiki-admin` hoặc gán cho quản trị viên phù hợp, rồi đăng xuất/đăng nhập lại. Không cấp mặc định cho mọi editor.
  Import realm mới đã chứa các role này; khởi động lại Keycloak không tự cập nhật realm đang có.
- Backend mới áp dụng migration V003 khi bạn khởi động lại. Không reset database. Hồ sơ tạo ở lần lưu đầu;
  danh sách này không phải toàn bộ tài khoản Keycloak. Thông tin hồ sơ dùng backend thật ngay cả khi dữ liệu wiki đang là mock.
- Avatar: PNG/JPEG/WebP tối đa 25 MB (backend có thể cấu hình thấp hơn); browser PUT trực tiếp tới URL ký sẵn,
  backend complete xác minh file rồi mới cho gắn asset. Không gửi token hoặc cookie admin tới storage.
- Bucket local tự cấu hình CORS khi `wiki.storage.create-bucket-if-missing=true`, đúng `ADMIN_ORIGIN`
  (mặc định `http://localhost:5175`). Backend không đọc file ảnh từ form multipart.
- Production: provision CORS trên bucket cho origin frontend, methods PUT/GET/HEAD, headers cần ký;
  storage endpoint dùng để ký URL phải truy cập được từ browser, HTTPS nếu frontend là HTTPS.
- Avatar được đọc qua URL ký sẵn 15 phút; query làm mới định kỳ. Chưa crop/resize ảnh.
- Gỡ avatar chỉ gỡ liên kết, không xóa bytes. File đã upload nhưng chưa lưu hồ sơ vẫn nằm trong media,
  có thể kiểm tra qua media usage trước khi áp dụng chính sách dọn file.

Kiểm tra: `pnpm --filter @aov/admin-aov test:users`. Backend: `./mvnw.cmd verify`
(chạy PostgreSQL/SeaweedFS test riêng bằng Testcontainers, không dùng dữ liệu local của bạn).
