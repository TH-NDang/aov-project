# Admin AOV

## Trang tướng và biên dịch

`/publishing` mở danh sách có cột tên cố định, bản dịch dạng biểu tượng ngôn ngữ kèm số ngôn ngữ có nội dung thật (không tính fallback). Bấm tên/mũi tên để mở drawer trên desktop hoặc bottom sheet trên mobile; có thể mở toàn trang.

`/publishing/:heroId` ưu tiên đọc hồ sơ, kỹ năng, chỉ số, trang phục và ảnh. Bút trên từng nhóm mở trình sửa nhóm đó; Lưu gọi API draft thật với version, Hủy chỉ bỏ thay đổi của nhóm đang sửa. Metadata, nhập tài nguyên và xuất bản nằm trong các mục mở rộng. Đóng drawer/tab có thay đổi cần xác nhận; thao tác lưu đang chạy chặn đóng. Đổi tab vẫn giữ bản đang sửa; tải lại trình duyệt không tự lưu nội dung chưa gửi.

`/publishing/:heroId/translations?revision=...&locale=en-US` đối chiếu nguồn–đích cho hồ sơ, kỹ năng và trang phục. Chỉ cập nhật văn bản locale đích, giữ nguyên ngôn ngữ khác, ảnh và gameplay; cần quyền `hero:write` và revision DRAFT. Bản published cần tạo draft (lý do Bản dịch) trong phần thao tác nâng cao. Đây là dịch nội dung, không phải dịch giao diện; chưa có quy trình duyệt bản dịch riêng hay dịch tự động.

Fixture kiểm tra trực quan: `/tests/fixtures/hero-workspace.html` khi Vite dev đang chạy. Trang chỉ dùng dữ liệu tổng hợp và chặn toàn bộ fetch; không gọi hay sửa API thật, không nằm trong entry build production. Kiểm thử: `pnpm --filter @aov/admin-aov test:publishing` và `pnpm --filter @aov/admin-aov test:tabs`.

## Đóng thông báo import

Nút × trên tác vụ import đã kết thúc lưu ở backend theo tài khoản và ID tác vụ; cùng tài khoản trên trình duyệt khác nhận trạng thái qua polling khi tab hoạt động hoặc khi mở/focus lại. Lịch sử import vẫn giữ nguyên. Khi lỗi mạng, thông báo còn hiển thị để bấm × thử lại; trạng thái được tải lại nếu backend đã lưu nhưng phản hồi bị mất. Dấu đóng server từ bản localStorage cũ không tự đồng bộ: bấm × lại một lần sau khi nâng cấp. Tác vụ mới và tác vụ đang chạy vẫn hiển thị.

Cần chạy lại wiki-service với cấu hình local hiện có để Flyway áp dụng V016 (không reset database), rồi dùng frontend mới. Không đổi cấu hình secret hay khởi động lại các dịch vụ Docker đang chạy chỉ vì thay đổi này.

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

- `/heroes`, `/heroes/:slug`, `/skins` và `/reference/skins`: đường dẫn cũ chuyển về `/publishing`. Không còn trang quản lý tướng/trang phục riêng từ tài nguyên; slug tài nguyên không được chuyển thẳng thành UUID backend.
- `/publishing`: danh mục backend, tạo Hero, chọn ruleset, mở draft/revision.
- `/publishing/:heroId`: sửa từng section, lưu với optimistic version, fork/publish/discard; trang phục nằm trong tab **Trang phục** của phiên bản tướng.
- `/image-management`: xem MediaAsset, phiên bản ảnh và nơi sử dụng; đường dẫn `/publishing-media` cũ chuyển về đây.

Từ `/publishing`, mở **Gameplay context** để tạo ruleset, gán timeline vùng, tạo patch/variant,
publish variant và nhập lịch phát hành có URL nguồn. Các danh mục này đọc lại được sau khi tải trang.
Ngôn ngữ không quyết định ruleset; lịch phát hành dùng ngày giờ máy bạn và được gửi dưới dạng UTC.

Chọn ruleset rồi tạo một Hero, ví dụ `nakroth`. Trong draft, mở **Nhập từ tài nguyên**, chọn Nakroth,
bấm **Điền vào biểu mẫu**. Nguồn và đường dẫn `resources/Lien-Quan-v3/data/heroes.json` được giữ lại.
Import chỉ điền thông tin đã có: không suy đoán vai trò, chỉ số, đánh giá hoặc mô tả chiêu còn thiếu.
Điền các trường thiếu và lưu từng phần; backend kiểm tra đầy đủ nội dung trước khi nhận section.
Khi mở phần ảnh, có thể chọn asset đã có, upload file, hoặc nhập ảnh đúng vai trò từ resources.
HEAD/PORTRAIT/SPLASH là ba asset riêng; icon chiêu và artwork trang phục có semantic type riêng.
Trong tab **Ảnh tướng** của tướng, **Nguồn ảnh** dưới mỗi ảnh hiển thị link và ghi chú từ Media provenance.
Chỉ nguồn gắn với toàn bộ asset hoặc phiên bản ảnh hiện tại được hiển thị; nguồn của phiên bản ảnh cũ
không được trộn vào ảnh đang xem. Đây là nguồn của ảnh đã upload, không phải danh sách ảnh từ tài nguyên.
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

### Chuẩn hóa Hero, import và mùa xếp hạng

- **Tướng** (`/publishing`) là nơi tạo/sửa draft, import JSON/CSV, kiểm tra và publish. Chọn bộ quy tắc/ngôn ngữ trước khi mở import.
- Import tối đa 200 tướng/file 5 MB. Chọn cột mã tướng, ánh xạ vào trường backend công bố; không tạo cột tự do. Chọn bổ sung chỗ trống/ghi đè/bỏ qua theo trường, xem trước, rồi chọn các bản ghi cần nhập. Ô trống không xóa dữ liệu. Mảng kỹ năng/trang phục ghi đè cả danh sách; vai trò là mảng mã hợp lệ như `["ASSASSIN"]`.
- Import ghi draft, không publish. Mỗi tướng nguyên tử; tướng lỗi không hủy các tướng đã nhập thành công. Xung đột phiên bản yêu cầu xem trước lại.
- Cột ảnh dùng link HTTPS trực tiếp; sau xác nhận frontend tải và upload qua Media API rồi mới gắn UUID. Có thể upload/chọn ảnh ngay trong từng section. Nguồn chặn CORS hoặc chuyển hướng cần tải file về máy trước. Không có worker tải URL phía server.
- **Phiên bản và thị trường** (`/game-configuration`) quản lý ruleset, patch/release và mùa. Mùa có tên linh hoạt (S21, S1 2026) nhưng mã ổn định; có thể gắn mùa khi đặt lịch phát hành, backend kiểm tra vùng và khoảng thời gian.
- **Thư viện ảnh** (`/publishing-media`) nằm riêng. Lưu trữ cũ bị gỡ khỏi menu; `/storage` và file dữ liệu vẫn giữ để xuất/chuyển dữ liệu.
- Khởi động lại backend để áp dụng V009. Không reset database. Frontend dùng `pnpm generate:hero-api` từ thư mục `frontend` để cập nhật type từ OpenAPI; CI kiểm tra file sinh.

### Nhập dữ liệu khi chưa có lịch sử

Chọn thị trường → mùa → patch ở đầu trang Tướng. Lần đầu chọn **Dữ liệu ban đầu**: đây là mốc đã biết, không phải tướng mới ra mắt hoặc một sự kiện cập nhật. Khi có dữ liệu patch sau, chọn **Cập nhật theo patch**; hệ thống so sánh mốc trước, không lấy dữ liệu tương lai để điền quá khứ. **Bổ sung / sửa dữ liệu** sửa mốc đúng patch.

Giao diện import có ba bước: chọn mục đích/file, ánh xạ trường, duyệt kết quả. Kết quả phân biệt chưa có trong kho, mốc bổ sung, khác biệt, không đổi và thiếu mốc so sánh; có bộ lọc, chọn nhiều bản ghi và xem từng trường trước/sau. Khác biệt không tự trở thành changelog. Mỗi lần chỉ một draft/tướng/ruleset; cần xử lý draft đang có trước khi chuyển patch hoặc loại nhập.

Khởi động lại backend để áp dụng V010 sau V009. Tạo/import không còn cho bỏ trống patch. Patch phải có lịch release trong một mùa đã khai báo; ngày tương lai vẫn có thể chọn để chuẩn bị draft. Bổ sung patch quá khứ bằng tùy chọn **Chèn patch lịch sử trước** trong cấu hình game.


### Import chạy nền ở backend

Trang Import chuẩn bị dữ liệu/ảnh rồi gửi một tác vụ có UUID chống gửi trùng. Sau khi máy chủ xác nhận, có thể đóng hoặc tải lại trang. Sidebar và lịch sử Import đọc tiến trình từ backend, tự làm mới mỗi 3 giây. Lỗi mạng lúc gửi cho phép gửi lại cùng UUID. Chưa gửi tác vụ thì cần giữ trình duyệt mở. Khởi động lại backend để áp dụng migration V011 trước khi dùng.


### Import từ thư mục và ánh xạ kỹ năng/trang phục

- Chọn thư mục `resources/Lien-Quan-v3`, sau đó chọn `data/heroes.json`. Gốc ảnh mặc định là thư mục đã chọn, phù hợp các đường dẫn `assets/...`; có thể chọn thư mục con làm gốc cho bộ dữ liệu khác. JSON nhiều mảng sẽ yêu cầu chọn mảng tướng. Chưa hỗ trợ giải nén ZIP trực tiếp.
- Kỹ năng và trang phục có ánh xạ trường con do backend công bố. Biến thể kỹ năng có thể tách qua mảng `variants`, với các cột `variant.*`; tùy chọn tạo mã từ slot/index phải có giá trị ổn định. Thiếu trường bắt buộc được báo lỗi, không sinh mô tả/vai trò giả.
- Chỉ ảnh được ánh xạ và cần áp dụng mới upload. Trường bỏ qua hoặc nhóm chỉ bổ sung nhưng đã có danh sách không tải ảnh. Trường con không ánh xạ giữ giá trị cũ theo mã bản ghi, bao gồm ảnh và bản dịch khác. Ghi đè nhóm vẫn thay thế danh sách: các mã không có trong file sẽ không còn trong danh sách mới.
- Xem trước không tải ảnh. Bước xác nhận upload qua Media rồi gửi tác vụ bền vững. Ảnh lặp cùng đường dẫn và loại trong phiên import được dùng lại. File LFS pointer được báo cần tải ảnh thật trước.
- Trang phục được nhập và quản lý trong từng phiên bản tướng tại `/publishing/:heroId?tab=skins`. Các trang danh sách riêng `/skins` và `/reference/skins` đã bỏ và chuyển về danh mục tướng. Công cụ portrait/head/cover và bậc trang phục vẫn đọc bộ tài nguyên ảnh; số liệu ở đó không đại diện cho media hoặc trang phục đã nhập vào backend.

### Tổng quan phiên bản và bảng tướng

- `/game-configuration`: bảng ruleset/thị trường tại thời điểm backend; mở mùa rồi patch để xem thay đổi gameplay đã ghi nhận. Menu dấu ba chấm cạnh tiêu đề bảng chứa Tạo ruleset, Tạo mùa, Tạo patch và liên kết thị trường. Các biểu mẫu mở trong panel bên phải trên desktop, từ dưới lên trên mobile. Mùa tương lai và lịch patch tương lai được phân biệt với hiện tại.
- `/publishing`: không chọn mùa/patch thì hiển thị toàn bộ tướng cùng thay đổi gameplay gần nhất đã biên tập trong từng ruleset. Chọn mùa chỉ giữ tướng có change set trong mùa đó; chọn thêm patch thu hẹp tới patch. Mỗi tướng/ruleset có một dòng, gom mọi loại thay đổi của phạm vi và mở được từng patch. Baseline, sửa bản dịch hoặc bản nháp GAME_PATCH chưa có change set không được coi là thay đổi gameplay. Mã tướng được ghim; nút xem nhanh mở bên phải hoặc từ dưới lên theo kích thước màn hình.
- Tìm theo tên/mã và sắp xếp chỉnh sửa gần nhất được xử lý trước phân trang ở backend; tải thêm chỉ nối các kết quả thuộc cùng bộ lọc. TanStack Query phân biệt mùa, patch, ruleset, chuỗi tìm, locale và cách sắp xếp. URL giữ `q`/`sort` cùng `season`/`patch`; nhập tìm kiếm chờ 300 ms trước khi gửi. Chỉnh sửa gần nhất dùng timestamp đã lưu của hồ sơ/revision, hiển thị theo múi giờ người dùng; không thay bằng ngày patch hoặc giờ hiện tại khi thiếu.
- Biểu tượng BUFF, NERF, ADJUSTMENT, REWORK, FIX và OTHER lấy từ change set đã biên tập, có nhãn/tooltip và chú giải trên đầu cột. Mùa có cả buff và nerf giữ cả hai, không tự suy thành điều chỉnh. Fixture `tests/fixtures/hero-catalog-filtering.html?theme=dark` phục vụ kiểm tra riêng bằng dữ liệu trong bộ nhớ; không gọi API dữ liệu thật.
- Icon thị trường chỉ là nhãn, không mở popup. Trong bảng tổng quan, hover tên thị trường hiện nút mở lịch mùa/patch (nút luôn hiện trên thiết bị cảm ứng). Cột thị trường ở bảng tướng chỉ đánh dấu nơi bản đã xuất bản đang thực sự áp dụng. Bản dịch đếm nội dung theo các ngôn ngữ được hỗ trợ; bấm để xem tiến độ từng ngôn ngữ và mở đúng bản cần sửa. Chỉ số này chưa phải trạng thái duyệt hay kiểm chứng bản dịch.
- Ngôn ngữ hiển thị nội dung lấy từ locale hồ sơ người dùng; thiếu bản dịch sẽ có nhãn ngôn ngữ dự phòng. Tạo/sửa/import vẫn có ngôn ngữ nhập liệu riêng.
- Các luồng đọc dùng TanStack Query; dữ liệu tổng quan dùng chung cache giữa hai trang, tự kiểm tra lại mỗi 60 giây. Bảng thay đổi chỉ truy vấn khi mở patch. Mutations mùa/patch/changelog làm mất hiệu lực cache liên quan.
- Backend phải được khởi động lại sau khi thêm `/admin/publication-overview`; không có migration mới cho phần tổng quan này.

Lịch phát hành trong patch hiển thị từng thị trường với khoảng từ–đến. Mốc đến suy ra từ bản cập nhật tiếp theo đã lên lịch/xuất bản tại cùng thị trường hoặc kết thúc liên kết ruleset nếu đến trước; chưa có mốc thì hiển thị rõ chưa xác định. Kết thúc mùa không tự kết thúc patch. Không cần migration cho thay đổi giao diện này.

## Truy cập trong cùng Wi-Fi

Xem IPv4 Wi-Fi bằng `ipconfig`, ví dụ `192.168.1.6`. Trong `frontend` chạy:

```powershell
pnpm --filter @aov/admin-aov dev:lan
```

Trong terminal `backend/wiki-service`, giữ các biến secret hiện có và chạy:

```powershell
$env:ADMIN_ORIGIN="http://192.168.1.6:5175"
$env:STORAGE_BIND_ADDRESS="192.168.1.6"
$env:STORAGE_ENDPOINT="http://192.168.1.6:8333"
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Cả điện thoại và máy tính mở `http://192.168.1.6:5175` để khớp origin đăng nhập.
API đi qua `/api/wiki`, ảnh đọc qua `/media`, không cần mở cổng backend.
Upload trực tiếp tới cổng 8333; backend local thiết lập CORS theo `ADMIN_ORIGIN`.
Nếu tự chạy Compose, dùng cùng các biến trên và `docker compose up -d seaweedfs`
để cập nhật địa chỉ bind; giữ nguyên volume dữ liệu. Không đổi hostname URL đã ký.

Nếu bị Firewall chặn, cho phép Node.js trên mạng Private, hoặc chạy trong PowerShell Administrator:

```powershell
New-NetFirewallRule -DisplayName "AOV admin LAN" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5175,8333 -RemoteAddress LocalSubnet -Profile Private
```

Chỉ dùng HTTP trên mạng nội bộ tin cậy; Wi-Fi khách có thể chặn kết nối giữa thiết bị.
Đăng nhập mật khẩu qua backend không cần đổi issuer Keycloak. Google OAuth cần cấu hình HTTPS,
Keycloak và callback riêng, chưa được hỗ trợ bởi thiết lập LAN này.
Khi IP thay đổi, cập nhật các biến và URL. Quay lại localhost: bỏ ba biến môi trường trên,
chạy lại backend và dùng lệnh frontend `dev`.


## Mùa và patch dùng chung

Tạo mùa không chọn thị trường hay ngày. Chọn vị trí chèn trước mùa đã có hoặc nối cuối.
Tạo patch chọn mùa, ruleset và vị trí trong mùa; backend quản lý thứ tự xuyên suốt ruleset.
Sau khi tạo, form tự đóng. Mở mùa để thêm lịch bắt đầu/kết thúc từng thị trường; mở patch
để xuất bản và thêm lịch phát hành. Thị trường cần được liên kết ruleset đúng thời điểm.
Nhập/tạo tướng chỉ chọn mùa và patch, có thể soạn trên patch nháp chưa lên lịch.
Triển khai backend mới (V012) trước khi dùng các form mới. Migration đổi aov-vn thành
aov-standard giữ nguyên ID, không tạo ruleset thứ hai.

### Import thư mục và ZIP

Chọn thư mục chứa dữ liệu và ảnh hoặc ZIP, sau đó chọn JSON/CSV bên trong. ZIP được đọc tại
trình duyệt, không upload cả gói. ZIP tối đa 256 MB, tổng giải nén tối đa 512 MB, tối đa 20.000
entry; dữ liệu tối đa 5 MB/file, ảnh PNG/JPEG/WebP tối đa 25 MB/file. Bộ lớn hơn nên chọn thư mục.

Đường dẫn ảnh mặc định tính từ thư mục chứa dữ liệu: data/heroes.json dùng ../assets/… .
Với resources dùng assets/…, chọn lại thư mục gốc là gốc bộ tài nguyên (hoặc thư mục bao ngoài
trong ZIP). Hệ thống không tìm ảnh bằng tên gần giống; báo lỗi khi thiếu/trùng/thoát đường dẫn.

Chỉ ảnh ở các trường đã ánh xạ của tướng, kỹ năng và trang phục, cần áp dụng theo chính sách
nhập liệu và thuộc bản ghi được chọn mới upload. Bước xem trước chưa upload. Xác nhận lưu mới
upload qua Media, thay đường dẫn bằng asset ID rồi gửi tác vụ backend. Giữ trang mở trong khi
chuẩn bị/upload; sau khi backend nhận tác vụ mới có thể đóng trang. Git LFS pointer không phải
ảnh thật và sẽ báo lỗi, cần tải tài nguyên thực trước khi import.
### Tiếp tục upload import sau khi đóng trang

Sau khi xác nhận nhập, backend lưu phiên upload và tiến trình từng ảnh. Mở lại `/publishing/import`, mục **Upload đang dở** hiển thị các phiên của tài khoản hiện tại. Chọn **Tiếp tục upload**, chọn lại folder/ZIP ban đầu nếu thiếu ảnh rồi bấm **Tiếp tục phiên đã lưu**. Không cần chọn lại mùa/patch hay ánh xạ; chúng đã nằm trong phiên. Ảnh hoàn tất được bỏ qua, file thay thế được kiểm tra SHA-256. Có thể tiếp tục bằng máy khác khi đăng nhập cùng tài khoản và chọn đúng gói nguồn.

Upload dừng khi trình duyệt đóng; tác vụ nhập chỉ chạy tự động trên máy chủ sau khi nhận đủ dữ liệu. Ảnh đang tải dở có thể phải tải lại toàn bộ file đó, không hỗ trợ tiếp tục theo byte. **Bỏ phiên** xóa checkpoint, không xóa ảnh đã lưu. Các lượt upload trước tính năng này không có checkpoint để khôi phục. Backend cần migration V015; không lưu token, presigned URL hay file bytes trong phiên.
## Liên kết tới vị trí đang xem của tướng

- Xem bên cạnh bảng: `/publishing?hero=<hero-id>&revision=<revision-id>&tab=skills`.
- Trang đầy đủ: `/publishing/<hero-id>?revision=<revision-id>&tab=media`.
- Biên dịch: thêm `view=translations&section=SKILLS&target=en-US&source=vi-VN`; `readLocale` lưu riêng ngôn ngữ xem.
- So sánh: thêm `view=history&compare=<revision-id>&diff=split&changes=skills`.

URL giữ bộ lọc `season`/`patch` của danh sách, trạng thái mở khung chi tiết và các lựa chọn trên. Tải lại hoặc mở liên kết trực tiếp vẫn đọc đúng tướng, kể cả khi tướng chưa nằm trong các hàng đã tải. Chuyển tab/cột ngôn ngữ dùng replace để không tạo hàng loạt bước trong lịch sử; mở tướng từ bảng tạo một bước để Back đóng khung, Forward mở lại. Nút mở toàn trang mang theo trạng thái xem. Back/Forward có cảnh báo khi còn chỉnh sửa chưa lưu; URL chỉ lưu vị trí, không chứa nội dung đang sửa. Liên kết `/translations?locale=…` cũ tiếp tục đặt ngôn ngữ đích.

# Thuật ngữ và tham chiếu nội dung

Trang `/terminology` quản lý tên/alias theo locale, mô tả ngắn, icon, màu HEX, gạch dưới và đường dẫn admin/wiki; có preview trước khi lưu. Tướng được đọc từ bản dữ liệu mới nhất chưa hủy của backend để biên tập trong admin (chỉ lấy thông tin giới thiệu), trang bị từ adapter bộ tài nguyên hiện có. Đây không phải catalog công khai của Wiki. Alias trùng giữa các thực thể sẽ không tự nhận diện. Bản dịch thiếu dùng locale dự phòng và thẻ thông tin ghi rõ locale thực tế.

Tham chiếu tướng dùng ảnh head đã gắn qua media; trang bị dùng ảnh tài nguyên thật. Chỉ phân giải ảnh khi tham chiếu hoặc dòng danh mục hiển thị. Trang bị mặc định chèn bằng `@`/`<ref>` để tránh nhận nhầm từ thường trong mô tả như “ném phi tiêu”; có thể bật tự nhận diện riêng từng trang bị. Tướng và thuật ngữ tiếp tục tự nhận diện. Khi chưa có cấu hình đã lưu, admin cung cấp bộ thuật ngữ cơ bản để xem thử; không tự ghi glossary vào backend.

Mô tả tướng dùng parser và renderer chung trong `@aov/ui`, giữ nguyên chuỗi nguồn:

```text
<ref=hero:UUID>nhãn tùy chọn</ref>
<ref=item:ID>trang bị</ref>
<ref=term:UUID>thuật ngữ</ref>
<color=#2563eb>nội dung có màu</color>
<noauto>nội dung không tự nhận diện</noauto>
<b>chữ đậm</b>
<i>chữ nghiêng</i>
```

Editor dùng chung `EntityRichTextEditor` hiện tích hợp vào giới thiệu/cốt truyện tướng, mô tả chiêu, mô tả trang phục, các ô văn bản dài của bản dịch và mô tả ngắn thuật ngữ. Ô tên, locale, nguồn/URL và dữ liệu số giữ control phù hợp riêng. Editor sửa chuỗi nguồn, có preview render; không phải WYSIWYG/contenteditable hay bộ xử lý HTML. Bôi chọn rồi dùng toolbar đậm/nghiêng/màu/chèn tham chiếu; toolbar luôn hiện cho mobile và keyboard, có Ctrl/⌘ B/I/Z, Shift+Z hoặc Ctrl+Y. Formatting chèn cặp thẻ và giữ vùng chọn bên trong; chèn tham chiếu xong đặt caret sau thẻ. Vùng chọn cắt qua cấu trúc thẻ hoặc ở trong ref được từ chối kèm thông báo để tránh tạo link lồng hoặc phá nguồn.

Gõ `@` ở đầu nội dung/sau khoảng trắng hoặc dấu phân cách sẽ mở gợi ý từ danh mục thật và alias theo locale/dự phòng (tìm kiếm có thể không dấu). Email không kích hoạt; Esc đóng và giữ nguyên text, nội dung không tự biến thành ref nếu chưa chọn. Mũi tên/Enter chọn, click/chạm có cùng hành vi. Tạm dừng gợi ý và phím chọn khi IME đang composition. Bộ chọn toolbar cho phép chèn vào vị trí caret hoặc dùng nhãn văn bản đang bôi chọn. Danh sách tối đa 8 gợi ý cùng số kết quả; không có kết quả thì Enter vẫn là xuống dòng. Undo/redo lưu tối đa 100 trạng thái trong phiên của mỗi ô, gom phiên IME, có nút thao tác và hỗ trợ beforeinput history trên mobile; không lưu lịch sử qua reload. Paste lấy text/plain, giữ nguyên nguồn; không chạy HTML/script. Khi mở lại/switch locale, chuỗi nguồn không bị parse rồi serialize lại. Giới hạn nội dung chung 100.000 ký tự, mô tả glossary 4.000 ký tự; backend vẫn kiểm tra giới hạn trường riêng khi lưu.

Bảng danh mục luôn hiện ở `/terminology`: tìm tên/alias/ID, lọc loại/locale/trạng thái, đếm kết quả, phân trang 25 dòng, chọn tên để chỉnh sửa; có nguồn backend/resource/glossary, alias, locale, ID ổn định và đích resolver. Mục mất nguồn được ghi rõ, không coi đó là target backend hợp lệ. Mô tả hover hiển thị b/i/color; ref hợp lệ trong mô tả hover được đổi thành nhãn thuần và không tự nhận diện để tránh card lồng/đệ quy. Ref tại phần nội dung chính vẫn tương tác bình thường. Fixture `tests/fixtures/hero-workspace.html?annotations=1` chỉ dùng dữ liệu tổng hợp riêng cùng fetch in-memory, không gọi API tài khoản/storage thật.

Tham chiếu thủ công ưu tiên hơn tự nhận diện; không lồng liên kết. Parser không chạy HTML, kiểm tra URL/màu, giới hạn 100.000 ký tự, độ sâu 8 và 500 tham chiếu mỗi nội dung. Danh mục được cache dùng chung, tải tối đa 4 hồ sơ tướng đồng thời; không gọi API theo từ. Chạy `pnpm --filter @aov/admin-aov test:rich-text` để kiểm tra lõi, renderer và lưu thiết lập.

Thiết lập được lưu thật qua JSON storage `/__storage` của Vite dev/preview, vào bảng riêng `AOV rich text settings v1`, có kiểm tra phiên bản để tránh ghi đè. Chưa có API glossary production hoặc cơ chế phân quyền cho JSON storage này; UI ghi rõ phạm vi, lỗi lưu giữ lại bản nháp. Trước khi dùng production/wiki cần thiết kế hợp đồng đọc catalog gọn theo locale, API CRUD có quyền `catalog:read`/quyền sửa riêng và optimistic version, bảng glossary/translation/alias cùng cấu hình hiển thị tham chiếu; tướng/trang bị giữ ID từ module sở hữu, không truy cập bảng chéo module. Chưa thêm migration hay backend mới cho đề xuất này. Wiki sau này truyền catalog, locale và `context="wiki"` vào renderer chung, ánh xạ đích phù hợp router thực tế. Chưa thêm module bình luận.

## Persistence hiện tại: phạm vi và giới hạn

- Plugin `server/json-storage.ts` được đăng ký trong `vite.config.ts` bằng `jsonStorage(new URL("./storage", import.meta.url))`; chỉ chạy trong dev và preview. File được lưu ở `frontend/apps/admin-aov/storage/<UUID-do-server-tao>.json` (trên máy hiện tại: `C:\Users\ndang\Projects\aov-project\frontend\apps\admin-aov\storage\`). Không ghi vào `resources/`, DB, localStorage hay file build `dist/` để lưu glossary.
- Adapter tìm bảng có tên `AOV rich text settings v1`. Chưa tồn tại thì GET chỉ trả cấu hình mặc định trong bộ nhớ, không tự tạo file. Khi người dùng lưu lần đầu, POST tạo bảng rồi PUT một hàng `{id:"settings", settings:...}`, với `columns=["id","settings"]`, `idColumn="id"`. QA hiện dùng fetch fixture và test stub, chưa tạo file glossary thật trong thư mục storage.
- API: `GET /__storage/` liệt kê metadata không gồm rows; `GET /__storage/{uuid}` đọc bảng; `POST /__storage/` với `{name}` tạo bảng; `PUT /__storage/{uuid}` gửi cả bảng cùng `version`. Không có DELETE; bảng có thể archive bằng thuộc tính `archived` qua PUT.
- **Không có JWT, session hay capability check trên middleware này**. Đăng nhập UI không bảo vệ API storage. Middleware kiểm tra Origin nếu có (host phải khớp Host) và từ chối `Sec-Fetch-Site: cross-site`; client ngoài trình duyệt không gửi các header này vẫn có thể gọi. Đây không phải cơ chế phân quyền production, và dev server đang expose qua LAN thì các bên truy cập được server cũng có thể truy cập API. Không mở thêm host, CORS hay quyền để triển khai annotation.
- Đường dẫn: ID chỉ nhận UUID chữ thường theo regex cố định; tên file được server ghép từ UUID, client không gửi đường dẫn. Khi PUT server dùng ID trên URL thay vì `input.id`, nên không cho tên file traversal. Body và file tối đa 20 MiB; yêu cầu Content-Type JSON, kiểm tra cấu trúc bảng/cột/ID và tên bảng không trùng. Cấu hình rich text còn được adapter validate giới hạn catalog, HEX, URL và locale trước lưu/sau đọc; middleware storage tổng quát không tự validate schema rich text nên backend tương lai phải kiểm tra lại phía server.
- Concurrency: mutation đi qua hàng đợi trong một tiến trình Vite; PUT yêu cầu `input.version === current.version`, trả 409 nếu lệch và tăng version khi thành công. Ghi file tạm rồi rename trong cùng thư mục. Không có khóa liên tiến trình: không vận hành nhiều Vite instance ghi cùng thư mục. Nếu mất phản hồi sau POST/PUT, UI không khẳng định đã lưu, giữ bản nháp và yêu cầu tải lại để đối chiếu; không tự ghi đè. Test có kiểm tra version conflict và storage unavailable.

Lý do dùng adapter này ở giai đoạn đầu: repo đã có hạ tầng lưu JSON server có version, trong khi chưa có glossary API, quyền ghi glossary hay catalog trang bị backend. Nó giúp kiểm tra luồng quản lý/renderer với persistence thật mà chưa tự quyết schema và quyền mới. Đây là bản triển khai dev/preview; **chưa hoàn thành persistence dùng chung admin/wiki production**. Static hosting không có `/__storage`: UI báo không đọc/lưu được; không giả lập lưu thành công.

## Đề xuất backend tối thiểu cần chốt trước khi triển khai

Phần này là phương án, chưa có migration, endpoint hay quyền nào dưới đây được thêm/cấp. Đề xuất một module `reference` trong **wiki-service hiện tại**, không thêm service. `query` tiếp tục ghép read model; không đặt logic ghi glossary trong module query chỉ vì có sẵn controller tổng hợp. Cần ADR và cập nhật đặc tả 01/02/03 được duyệt vì danh sách module hiện tại chưa có `reference`.

| Bảng đề xuất | Dữ liệu và ràng buộc chính |
|---|---|
| `reference.settings` | Một cấu hình site: UUID, `auto_recognize`, `fallback_locale`, `version`; giá trị mặc định không kèm glossary mẫu. |
| `reference.entry` | UUID, `code` slug, `kind` TERM/HERO/ITEM, `target_id` UUID đối với hero/item; term dùng chính UUID entry. HEX, underline/show_icon, `icon_asset_id` tùy chọn, đích admin/wiki nội bộ, `archived`, version và actor issuer/subject/thời gian cập nhật. Unique `(kind,target_id)` khi có target; không tạo FK hay truy cập repository sang module khác. |
| `reference.translation` | PK `(entry_id,locale)`, tên và mô tả ngắn; FK nội bộ tới entry, giới hạn độ dài và locale tương đương parser. |
| `reference.alias` | `(entry_id,locale,normalized_alias)` cùng alias gốc, FK nội bộ tới translation; NFC + lower, giữ dấu tiếng Việt. Không đặt unique alias xuyên thực thể vì cần nhận biết/loại bỏ alias mơ hồ khi tạo index. |

Tạo một Flyway migration mới, dùng số phiên bản tiếp theo còn trống khi triển khai (V017 đã dành cho không gian ảnh); không sửa V000–V016. Cấu hình JPA giữ validate. Mutation dùng optimistic version, transaction ngắn ghi entry/translation/alias cùng audit qua `AuditLog` và `CurrentActor`; cập nhật revision cấu hình/catalog để invalidation và ETag nhất quán. Không nhận actor từ request. Nếu dùng icon asset thì đọc qua `MediaAssets`, triển khai `MediaUsageProvider`; không đọc bảng media hoặc gọi object storage trong transaction. Lỗi dùng enum của module triển khai `ApiErrorCode` và `ApiException`.

| Endpoint đề xuất (đường dẫn ngoài) | Quyền/ứng xử đề xuất |
|---|---|
| `GET /api/wiki/v1/admin/references/settings` và `GET /api/wiki/v1/admin/reference-entries` | Dùng lại `catalog:read`; whitelist query, trả `PageSlice` cho danh sách. |
| `PUT /api/wiki/v1/admin/references/settings` | `expectedVersion`; cần quyền ghi glossary riêng bên dưới. |
| `POST /api/wiki/v1/admin/reference-entries`, `PUT /api/wiki/v1/admin/reference-entries/{id}` | Tạo/sửa entry và các bản dịch/alias được validate phía server; sửa cần expectedVersion, xung đột 409. |
| `POST /api/wiki/v1/admin/reference-entries/{id}/archive` | expectedVersion, archive có thể phục hồi; không xóa cứng identity đã được chèn vào nội dung. |
| `GET /api/wiki/v1/references?region=VN&locale=vi-VN` | Snapshot công khai đã lọc entry archive và target chưa công bố; metadata nguồn, actualLocale/fallback, stable IDs, version/ETag, giới hạn catalog/payload. Không lộ actor hoặc bản nháp. Cache có revalidation; không gọi API theo từng từ. |

Trong Java vẫn map `ApiPaths.ROOT`/`ApiPaths.ADMIN` với `version="1"`, không hard-code phiên bản. Các admin endpoint dùng JWT gateway hiện có; lớp URL đã yêu cầu `catalog:read`, use case ghi thêm `@PreAuthorize`. **Đề xuất mới `reference:write`, không dùng `hero:write` để sửa thuật ngữ/trang bị/global settings** vì đó là mở rộng quyền của editor tướng sang nội dung khác. Chưa thêm constant, realm role hay composite role; cần chủ dự án chốt ai được cấp quyền này. Phương án tối thiểu là thay đổi có hiệu lực ngay sau lưu bởi người có quyền đó; nếu cần duyệt trước khi công khai thì phải chốt thêm lifecycle và `reference:publish`, không tự thêm mặc định.

Nguồn catalog hiện tại và đường chuyển đổi:

1. Tướng hiện đã dùng thật: `GET /admin/heroes?page=...&size=20`, chọn revision chưa hủy mới nhất theo revisionNo rồi `GET /admin/heroes/{heroId}/revisions/{revisionId}` lấy PROFILE translations/summary. Admin nhận diện cả bản nháp để biên tập; đây không phải catalog công khai cho Wiki. ID là UUID backend. Tải song song tối đa 4, dùng chung cache preview; ảnh head chỉ phân giải khi tham chiếu thực sự hiển thị. Đây là giới thiệu chung; chưa phân giải đầy đủ region/patch giữa nhiều ruleset. Backend production cần hợp đồng public mới như `HeroReferenceQueries` tại package gốc `hero`, trả snapshot tên/mô tả theo `GameplayContexts` và published visibility cho region; query/reference chỉ gọi hợp đồng đó, không import `hero.internal`.
2. Trang bị hiện đã dùng dữ liệu thật nhưng **qua adapter tài nguyên**, `api.getItemCatalog()` đọc `resources/Lien-Quan-v3/data/trang-bi.json` và file review qua `/__resources/`, có lớp thay đổi local của admin mock adapter. Tên và summary là vi-VN, không bịa bản dịch. Module `item` wiki-service hiện chỉ có package/placeholder, chưa có entity/repository/catalog API; không thể tuyên bố trang bị đã có persistence backend. Không đưa resource ID vào cột UUID hoặc tạo UUID giả. Giai đoạn production đầu có thể bật HERO+TERM và ghi rõ ITEM chưa sẵn sàng; để bật ITEM cần triển khai/import theo đặc tả item, mapping resource ID sang UUID bền vững và hợp đồng `ItemReferenceQueries`, là phạm vi riêng cần chốt.
3. Alias/display overrides chỉ áp dụng cho hero/item tìm thấy trong catalog thật; entry kiểu term do người dùng tạo. ID target đã mất hoặc chưa tải không được tự giả lập. Renderer chung chỉ nhận snapshot đã resolve, không fetch và không phụ thuộc admin. Wiki cần nối endpoint public và map route thật; resolver wiki mặc định hiện là điểm mở rộng, chưa đồng nghĩa đã có trang glossary/item wiki.

Chuyển dữ liệu JSON sang backend phải là bước import có preview và xác nhận target thật, validate phía server và version, audit actor; không seed mặc định file JSON của từng máy vào migration. Sau khi chuyển adapter admin sang API mới mới bỏ đường lưu Vite cho tính năng này. Các kiểm tra cần bổ sung khi được duyệt: JWT 401/403, quyền ghi mới chưa được cấp mặc định, conflict 409, rollback audit, không lộ draft, lọc region/locale, media usage, archive tham chiếu cũ, import không nhân đôi, và dữ liệu đọc đồng nhất giữa hai app.

## Luồng quản lý tướng, mốc dữ liệu và bản dịch

- Chi tiết tướng mở bên phải trên desktop, từ dưới lên trên điện thoại. Ba mục chính gồm thông tin tướng, bản dịch, lịch sử và so sánh. Các công cụ phiên bản/xuất bản nằm trong menu thao tác. Khi xem mặc định không đưa toàn bộ form biên tập lên màn hình.
- Nội dung sáu phần của một revision được đọc cùng một lần và cache chung với bảng tướng. Chỉ metadata ảnh và thư viện chọn ảnh tải theo nhu cầu. Import hoàn tất làm mới preview, danh sách revision, so sánh và catalog tham chiếu; khi đang sửa, các trường chưa lưu vẫn được bảo vệ.
- `aov-standard` là gameplay dùng chung. Mùa chứa nhiều patch có thứ tự; thị trường có lịch phát hành riêng. Không tạo bản sao nội dung chỉ vì ngày/giờ áp dụng khác nhau. Ngôn ngữ là các hàng bản dịch của cùng nội dung; phần biên dịch hiển thị nguồn và đích cạnh nhau, đếm thiếu theo đúng locale, không tính văn bản dự phòng là bản dịch hoàn tất.
- JSON `aov_heroes_manual_image_extraction` được nhận diện, đưa tên/mô tả, đánh giá suy ra từ thanh ảnh, thuộc tính và bảng cấp chiêu vào các trường backend cho phép. Không suy ra cấp tướng, tăng trưởng mỗi cấp, vai trò, đơn vị chưa rõ hoặc dạng chiêu chưa có ảnh. Giữ nguồn gốc và cờ cần kiểm tra trong `SOURCE_SNAPSHOT`; bản nháp vẫn lưu được khi thiếu dữ liệu.
- Chuẩn hóa các mã lệch đã đối chiếu như `apnette` → `annette`, `billo` → `billow`; hai bản Flowborn phải chọn dạng trước khi nhập. Edras có chiêu chụp trùng/số chiêu không khớp tên ảnh: lưu mục capture riêng để kiểm tra, không dùng nó ghi đè nhầm mã chiêu chuẩn. Import nguồn capture một phần giữ các biến thể cũ chưa được thu thập; import mảng đầy đủ thông thường vẫn theo chính sách thay thế đã chọn.
- Ghép ảnh tài nguyên là thao tác riêng có duyệt trước. Chỉ trường ảnh đã ánh xạ mới upload. Ảnh mới đi qua media presigned upload và complete như các ảnh khác, không lấy đường dẫn dev làm URL ảnh đã xuất bản. Bỏ ánh xạ ảnh sẽ giữ ID ảnh đang có theo mã kỹ năng/trang phục. Bỏ qua file GIF và trang phục tài nguyên chưa có tên thay vì tạo dữ liệu xác minh giả.
- Màn duyệt chỉ dựng nội dung khác biệt và đường dẫn ảnh khi mở từng tướng. Upload checkpoint và job dùng cùng ID bất biến, gửi lại không nhân đôi tác vụ. Phản hồi command rỗng không bị coi là JSON hỏng; dọn checkpoint thất bại sau khi job đã được nhận không đảo trạng thái thành thất bại.

Ví dụ bộ dữ liệu ngày 17/10/2026 do người cung cấp xác nhận thuộc trước S4: dùng mùa **S3 2026**, mốc quan sát `s3-2026-observed` khi chưa biết mã patch/ngày chụp chính xác. Đây là mốc quản lý dữ liệu, không tuyên bố có bản cập nhật game mang mã đó. Hai patch S4 tham khảo là [29/09/2026](https://lienquan.garena.vn/chi-tiet-ban-cap-nhat-vet-nut-thoi-khong-29-09-2026/) rồi [15/10/2026](https://lienquan.garena.vn/dieu-chinh-giua-mua-pb-vet-nut-thoi-khong-15-10-2026/). Việc bổ sung mã patch hoặc lịch chưa biết không lấy ngày tạo record làm ngày phát hành.

Nếu đã gắn nhầm bản nháp đầu tiên vào S4, phần quản lý cho phép đổi mốc có xác nhận, version và kiểm tra chưa có lịch sử xuất bản; giữ các section và ảnh. Trang import hỗ trợ duyệt/chuyển nhiều bản nháp đủ điều kiện, báo lỗi riêng từng dòng.

Sau khi xác minh và xuất bản mốc ban đầu: tạo bản nháp kế thừa vào patch tiếp theo, cập nhật các phần có nguồn, rồi so sánh các bản đã lưu. So sánh có đánh dấu theo từ và chế độ hai cột; số chưa biết khác số 0. Không có bản nguồn trả `BASELINE_ONLY`, không dựng thay đổi hoặc gọi tướng là mới ra mắt. Chênh lệch snapshot không tự thành buff/nerf hay changelog: biên tập viên kiểm tra nguồn và ghi lịch sử gameplay bằng thao tác riêng.

Màn hình so sánh gom theo `skillKey`, mỗi kỹ năng có một bảng trước/sau. Thông số trùng giữa hồi chiêu, bảng cấp chiêu và mô tả không tạo nhiều thẻ; mô tả đầy đủ được mở rộng trong cùng khối. Loại tăng/giảm/điều chỉnh/làm lại chỉ lấy từ change set khớp chính xác cả revision nguồn và đích; đổi sang cặp đối chiếu khác không giữ nhãn cũ hoặc suy luận từ dấu số.

Nút **Màu thay đổi** cho chọn riêng màu tăng/giảm và lưu trên trình duyệt, đồng bộ các tab. Mũi tên và tên loại không đổi theo màu. Ảnh kỹ năng ưu tiên media đã gắn; khi thiếu có thể dùng ảnh tài nguyên hiện tại khớp chính xác tướng/slot/biến thể, được ghi rõ là ảnh tham chiếu. Không có ảnh phù hợp thì hiển thị ô giữ chỗ; thêm/xóa liên kết ảnh trên kỹ năng hiện có hiển thị cặp trước/sau.

Link thư mục và ảnh chụp kỹ năng gốc được giữ để mở đối chiếu. Ghi chú nội dung tính theo review_index của bộ nguồn, gồm mô tả bị cắt và dạng chưa thu thập; các ghi chú đo màu/thanh đánh giá không làm tăng số tướng cần rà soát. Thông tin nguồn lặp trong mỗi kỹ năng không tạo chênh lệch kỹ năng khi chỉ đổi chỉ số tướng hoặc tên file ảnh. Ngôn ngữ đang xem và ngôn ngữ đích biên dịch được giữ độc lập khi chuyển tab.

## Không gian ảnh từ backend

`/hero/media` dùng các tab query `?tab=head`, `?tab=cover`, `?tab=badges` (mặc định Portrait), cùng một page tab và không có tiêu đề lớn lặp lại. Các URL cũ chuyển hướng và giữ bộ lọc. Ba tab ảnh dùng chung bảng nhóm theo tướng từ
`GET /admin/hero-media`, chọn ruleset và tìm mã/tên. Mở nhóm để thấy ảnh tướng, trang phục,
ảnh bổ sung và các ô chưa có ảnh. Mỗi file giữ nhãn riêng, gồm `-1`, `-2`; dấu kiểm trên thumbnail
phân biệt lựa chọn đang dùng. Chọn ảnh/tên trang phục mở chi tiết bên phải trên desktop, từ dưới trên mobile.
Metadata nguồn/ghi chú đọc qua Media và dùng cùng cache với trang tướng.

Thêm ảnh hoặc đổi ảnh chính ghi section bản nháp có expectedDraftVersion, giữ tất cả ảnh cũ,
trường của vai trò khác, nguồn và bản dịch. Snapshot đã xuất bản chỉ đọc; UI có đường mở trang
tướng để tạo bản nháp. Bộ đếm portrait chưa khớp từ tài nguyên cũ đã được gỡ khỏi sidebar/dashboard.
Không gian này không gọi catalog JSON tài nguyên để làm dữ liệu quản lý.

Tab `?tab=badges` là danh mục backend. Mở nhóm xem trang phục dùng nhãn; sửa để thêm bản dịch với
ngôn ngữ đã biết. Mỗi ngôn ngữ có tên và icon SKIN_BADGE riêng, mã nhãn dùng chung. Hiển thị có ghi
ngôn ngữ dự phòng; một bản dịch đã có nhưng chưa chọn icon giữ ô trống. Tên đầy đủ được giữ theo
nguồn, bao gồm chữ “Bậc” ở những nhãn có tiền tố này; không thêm đồng loạt cho nhãn sự kiện.
Upload vẫn qua presigned storage URL, không gửi bytes ảnh qua backend.

Nhập tài nguyên hiện có bằng `research/character-images/import-images.py` với preview, apply,
verify và checkpoint cục bộ. Lưu vào bản nháp, không tự xuất bản. Xem README cùng thư mục để chạy lại.

Không gian ảnh đã bỏ icon đi tới trang ở cuối bảng. Dòng trang phục có bậc/nhãn theo ngôn ngữ
hiện tại. Chọn ảnh hoặc thẻ trang phục liên quan mở viewer tại chỗ; chỉ nút Mở trang tướng trong
viewer điều hướng. Viewer dùng một preview của revision, có dải ảnh chính của các trang phục và
ba vai trò Head/Portrait/Cover để chuyển nhanh, giữ nguồn và công cụ chỉnh sửa bản nháp.

Tab bậc trang phục tải các nhóm RANK/THEME từ backend; mở nhóm mới tải từng trang nhãn, mở nhãn
mới tải trang phục. Có công cụ tạo/sửa bản dịch nhóm và chuyển nhãn giữa các nhóm. Nhóm chưa
phân loại là read model riêng, không tạo UUID giả. Đây là nhóm tổ chức thư viện; không tự thay
đổi phân loại bậc/sự kiện của nhãn hoặc icon ngôn ngữ. Sửa metadata nhãn bằng client cũ vẫn giữ nhóm.

Mỗi tướng là một nhóm rộng toàn trang, không còn cột tướng trống kéo dài bên trái. Thanh nhóm có
ảnh chính, tên tướng, mã sao chép và bộ đếm ảnh/trang phục; bấm toàn vùng tên để mở rộng, bấm ảnh
để xem chi tiết riêng. Thanh nhóm được ghim khi cuộn trong nhóm. Bảng ảnh và trang phục nằm ngay
bên dưới; phiên bản chỉ hiện một lần. Trên mobile, tên file chuyển vào chi tiết và bậc nằm dưới tên
trang phục để tránh cuộn ngang. Bộ đếm trang phục tính theo khóa riêng, không đếm trùng các ảnh bổ sung.
Dải tab ảnh chỉ cuộn ngang khi thiếu chiều rộng. Sao chép mã không làm mở nhóm hoặc viewer.

Danh sách tướng, nhóm nhãn, nhãn trong nhóm, trang phục liên quan và bộ chọn nhãn tự tải trang kế
tiếp khi cuộn gần cuối, không có nút Tải thêm. Observer theo đúng vùng cuộn, dừng khi đang tải,
gặp lỗi hoặc hết dữ liệu; nhóm thu gọn và tab ẩn không tiếp tục tải. Dữ liệu đã tải giữ trong TanStack Query.

Ảnh bậc trang phục có thể xem nhanh tại chỗ, giữ đúng icon của ngôn ngữ đang hiển thị. Thao tác
xem ảnh tách khỏi mở trang phục liên quan và sửa metadata; thiếu icon không mượn ảnh từ bản dịch khác.

Ảnh chính thu nhỏ nằm ngay trong thanh tên tướng được ghim; cột Ảnh chính riêng đã bỏ. Dấu kiểm nhỏ
trên thumbnail phân biệt ảnh chính của trang phục, không dùng thẻ đen lặp trong mỗi hàng. Bậc
trang phục chỉ hiện tên/icon; tạo nhãn nhập tên và thị trường, backend tự cấp mã tăng dần.

Mã tướng quốc tế và khóa trang phục đã chuẩn hóa cùng file tài nguyên theo ADR-010. Importer
nhận alias cũ trước khi ghép dữ liệu; không đổi UUID hoặc upload lại chỉ vì đổi tên file.
