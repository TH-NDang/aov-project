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

### Thị trường dữ liệu

Header có bộ chọn thị trường: VN hiện dùng; TH, TW, ID và GLOBAL hiển thị nhưng khóa, kèm lý do.
Danh mục lấy từ `GET /api/wiki/v1/regions`; backend cần khởi động lại để áp dụng migration V004.
Khi API chưa sẵn sàng, hiển thị lỗi và nút thử lại, không tạo danh mục giả ở frontend.
Admin hiện chỉ có adapter dữ liệu VN; bật region trong database chưa đủ để mở thị trường khác trên UI.
Global là mục chờ xác định dữ liệu quốc tế, không tự trộn dữ liệu các thị trường.
Chọn thị trường không đổi locale/múi giờ hồ sơ. Chưa triển khai bộ chọn trên Wiki.

### Hồ sơ

- Menu **Hồ sơ của tôi** (`/profile`): avatar và tên hiển thị trên nền cover, dùng biểu tượng bút để sửa.
  Hướng dẫn định dạng ảnh chỉ hiện trong phần sửa avatar. Giới thiệu nằm dưới tên;
  ngôn ngữ và múi giờ có danh sách tìm kiếm riêng, mở lại luôn hiện đầy đủ lựa chọn. Bấm **Lưu thay đổi** để áp dụng.
- Hồ sơ chưa lưu được gợi ý ngôn ngữ và múi giờ độc lập từ trình duyệt. Hồ sơ đã lưu giữ nguyên lựa chọn;
  Đây là thông tin hồ sơ, chưa tự đổi ngôn ngữ toàn bộ giao diện admin.
  Backend dùng `USER_DEFAULT_LOCALE` (mặc định `vi-VN`) và `USER_DEFAULT_TIME_ZONE`
  (mặc định `Asia/Ho_Chi_Minh`) khi khởi tạo hồ sơ; frontend giữ giá trị dự phòng nếu không đọc được thiết lập trình duyệt.
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

## Biên tập Hero với backend

- `/heroes`: công cụ chuẩn bị tài nguyên hiện có; thay đổi mock lưu trong trình duyệt, chưa publish.
- `/publishing`: danh mục backend, tạo Hero, chọn ruleset, mở draft/revision.
- `/publishing/:heroId`: sửa từng section, lưu với optimistic version, fork/publish/discard.
- `/publishing-media`: upload MediaAsset và nâng chất lượng cùng artwork mà không sửa HeroRevision.

Từ `/publishing`, mở **Gameplay context** để tạo ruleset, gán timeline vùng, tạo patch/variant,
publish variant và nhập lịch phát hành có URL nguồn. Các danh mục này đọc lại được sau khi tải trang.
Ngôn ngữ không quyết định ruleset; lịch phát hành dùng ngày giờ máy bạn và được gửi dưới dạng UTC.

Chọn ruleset rồi tạo một Hero, ví dụ `nakroth`. Trong draft, mở **Nhập từ tài nguyên**, chọn Nakroth,
bấm **Điền vào biểu mẫu**. Nguồn và đường dẫn `resources/Lien-Quan-v3/data/heroes.json` được giữ lại.
Import chỉ điền thông tin đã có: không suy đoán vai trò, chỉ số, đánh giá hoặc mô tả chiêu còn thiếu.
Điền các trường thiếu và lưu từng phần; backend kiểm tra đầy đủ nội dung trước khi nhận section.
Khi mở phần ảnh, có thể chọn asset đã có, upload file, hoặc nhập ảnh đúng vai trò từ resources.
HEAD/PORTRAIT/SPLASH là ba asset riêng; icon chiêu và artwork trang phục có semantic type riêng.
Ảnh LFS pointer phải tải bằng `git lfs pull` trước khi import.

Checklist publish nhắc các phần thiếu, và khóa publish khi còn section chưa lưu. Backend là nơi quyết
định cuối cùng về validation và quyền. Lỗi version conflict giữ nội dung biểu mẫu: ghi lại phần cần
đổi, bấm **Bỏ chỉnh sửa và tải bản mới**, rồi nhập lại. Chuyển tab của admin giữ biểu mẫu theo cơ chế
page tabs hiện có. Đóng tab hoặc tải lại trang không lưu thay đổi chưa gửi lên backend.
Bản published chỉ đọc; tạo draft kế thừa để sửa. `GAME_PATCH` cần variant của cùng ruleset;
sửa lỗi nội dung dùng `CONTENT_CORRECTION` và giữ gameplay applicability cũ.
Sau khi publish bản `GAME_PATCH`, form **Ghi lịch sử thay đổi gameplay** cho phép nhập các mục
STAT/SKILL/ROLE/VISUAL/MECHANIC/OTHER. Chỉ ghi sau khi đối chiếu snapshot nguồn và đích.

### Chạy cùng wiki-service

Khởi động PostgreSQL/SeaweedFS/Keycloak và backend theo README của wiki-service, rồi từ `frontend`:

```bash
pnpm install --frozen-lockfile
pnpm dev:admin
pnpm dev:wiki
```

Admin: http://localhost:5175/publishing, wiki: http://localhost:5173.
Đăng nhập tài khoản có `catalog:read`; chỉnh Hero cần `hero:write`, xuất bản cần `hero:publish`,
ảnh cần `media:write`, context cần `region:admin` / `patch:write` / `patch:publish` theo thao tác.
Auth dùng gateway/session hiện có, không lưu access token trong localStorage.

Vite dev/preview chuyển `/api/wiki` tới `http://localhost:8080` và `/media/{asset}/{version}.ext`
tới SeaweedFS filer `http://localhost:8888/buckets/wiki-media/assets/…`.
Chỉ GET/HEAD và đường dẫn asset hợp lệ được cho qua media proxy; `incoming/` và `imports/` không được phục vụ.
Có thể đặt `WIKI_API_TARGET`, `WIKI_MEDIA_FILER_TARGET`, `WIKI_MEDIA_BUCKET` trong shell trước khi chạy Vite.
`VITE_WIKI_URL` đổi địa chỉ nút xem wiki trong admin (mặc định `http://localhost:5173`).
Khi deploy, reverse proxy/CDN phải phục vụ `/media` chỉ từ prefix `assets/`; Vite proxy chỉ dành cho dev/preview.
Upload dùng presigned URL trực tiếp tới S3. CORS bucket phải cho phép đúng origin admin; initializer local đã hỗ trợ.
Không công khai filer hoặc dùng credential storage trên frontend production.

Kiểm tra luồng tích hợp frontend:

```bash
pnpm --filter @aov/admin-aov test:publishing
pnpm typecheck
pnpm build
```

GitHub Actions `frontend` chạy kiểm thử adapter/import/media proxy cùng typecheck/build.
`backend` chạy integration test có PostgreSQL + SeaweedFS: upload ảnh thật → sáu section → publish →
public API/ETag → activate ảnh chất lượng mới, giữ HeroRevision và kiểm tra reverse usage.
Dữ liệu tổng hợp trong các test chỉ nằm trong database/container test, không được seed vào dữ liệu thực.
