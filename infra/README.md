# Chạy toàn hệ thống như production trên một máy

Thư mục này đóng gói Wiki, Stream, Admin, `wiki-service`, `community-service` cùng PostgreSQL, Keycloak, SeaweedFS, Redis và
reverse proxy Caddy. Không triển khai đi đâu cả và không đụng tới môi trường dev trong `backend/wiki-service/compose.yaml`.
Lý do các lựa chọn nằm ở [ADR-021](../backend/docs/adr/ADR-021-dong-goi-chay-mot-may.md).

Cần Docker kèm Compose, và Git LFS khi clone (bản build Wiki đóng gói ảnh kỹ năng từ `resources/`).

## Khởi động

Chạy trong `infra/`, dùng được cả PowerShell lẫn bash:

```bash
cp .env.example .env; docker compose up -d --build --wait
```

Lần đầu phải tải dependency và build image: đo trên máy đang bận là khoảng 18 phút build và 5 phút khởi động. Lần sau bỏ `cp .env.example .env;`. Lệnh chỉ trả về khi mọi thành phần đã healthy.

| Địa chỉ | Là gì |
|---|---|
| <http://localhost:18080/> | AOV Wiki |
| <http://localhost:18080/stream/> | AOV Stream |
| <http://localhost:18080/admin/> | Admin |
| <http://localhost:18081/idp/admin/> | Console Keycloak, chỉ nghe trên máy này, dùng `KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD` |

Tài khoản thử: `admin`, `editor`, `publisher`, mật khẩu là `TEST_USER_PASSWORD` trong `.env`. Hệ thống mới không có dữ liệu Wiki,
danh mục trống là đúng; xem [Đưa dữ liệu vào](#đưa-dữ-liệu-vào).

Lỗi `holds Git LFS pointers` khi build nghĩa là checkout chưa có ảnh thật:

```bash
git lfs pull --include="resources/Lien-Quan-v3/assets/skill/*"
```

## Dừng và xóa

```bash
docker compose stop
```

```bash
docker compose down
```

Cả hai đều giữ dữ liệu; `down` xóa container, lần `up` sau tạo lại. Chỉ lệnh sau mới xóa toàn bộ dữ liệu, không thể khôi phục nếu
không có backup:

```bash
docker compose down -v
```

## Thứ tự khi khởi động

`preflight` → `postgres` → `db-backup` → `keycloak`, `wiki-service`, `community-service` → `reverse-proxy`. `seaweedfs`, `storage-init` (tạo bucket) và `redis` chạy trước `wiki-service`; tài khoản thử được tạo sau `keycloak`.

- **`preflight`** từ chối chạy nếu origin công khai còn dùng secret mẫu, còn bật tài khoản thử hoặc không phải HTTPS.
- **Lần đầu**, `postgres` tạo ba database `wiki`, `community`, `keycloak`, mỗi database một user riêng; Keycloak import realm từ
  `keycloak/wikiaov-realm.json`.
- **`db-backup`** chạy ở mỗi lần `docker compose up`, dump cả ba database vào `backups/db/auto-<giờ UTC>/`, giữ `BACKUP_KEEP`
  bản mới nhất. Backup lỗi thì service không khởi động. Máy khởi động lại tự chạy lại service mà không qua bước này, và cũng không có migration mới.
- **Flyway** chạy khi `wiki-service` và `community-service` khởi động, tức là ngay sau bản dump trên. Migration lỗi thì service
  dừng, không bao giờ healthy và proxy không mở. Xử lý bằng cách khôi phục bản dump `auto-` mới nhất rồi sửa migration.
- Health check dùng `/actuator/health` của hai service, `/health/ready` của Keycloak. Xem bằng `docker compose ps`; proxy chỉ chạy
  sau khi tất cả đã healthy. `/actuator` không đi qua proxy.

## Biến môi trường

Mọi giá trị nằm trong `.env`; Git chỉ theo dõi `.env.example`. Secret chỉ nên có chữ và số, vì Compose xử lý `$` đặc biệt.

| Biến | Ý nghĩa |
|---|---|
| `PUBLIC_ORIGIN` | Origin trình duyệt dùng, không có `/` cuối. Biên dịch vào frontend và ghi vào realm khi import |
| `SITE_ADDRESS` | `:80` trên máy này; tên miền trên máy chủ, Caddy khi đó tự lấy chứng chỉ TLS |
| `PUBLIC_BIND_ADDRESS`, `HTTP_PORT`, `HTTPS_PORT` | Nơi proxy nghe trên máy chủ |
| `KEYCLOAK_ADMIN_PORT` | Cổng console Keycloak, luôn chỉ trên `127.0.0.1` |
| `AUTH_SECURE_COOKIES` | `true` khi có HTTPS. `false` chỉ dành cho HTTP loopback |
| `COMPOSE_PROFILES` | `test-identity` tạo tài khoản thử; bỏ đi trên máy chủ thật |
| `TEST_USER_PASSWORD` | Mật khẩu tài khoản thử |
| `POSTGRES_SUPERUSER`, `POSTGRES_SUPERUSER_PASSWORD` | Quản trị PostgreSQL, dùng cho backup và restore |
| `WIKI_DB_PASSWORD`, `COMMUNITY_DB_PASSWORD`, `KEYCLOAK_DB_PASSWORD` | Mật khẩu user của từng database |
| `BACKUP_KEEP` | Số bản dump tự động giữ lại |
| `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD` | Tài khoản quản trị Keycloak, chỉ đọc ở lần đầu |
| `ADMIN_AUTH_CLIENT_SECRET`, `WIKI_IMPORTER_CLIENT_SECRET` | Secret của client `admin-aov-backend`, `wiki-importer`; chỉ đọc khi import realm |
| `GOOGLE_LOGIN_ENABLED` | Bật đăng nhập Google ở admin; cần cấu hình thêm provider trong Keycloak |
| `WIKI_SERVICE_CLIENT_SECRET` | Secret client `wiki-service` cho trang Cài đặt tài khoản (ADR-024); chỉ đọc khi import realm. Sau lần import đầu (hoặc với realm đã có) chạy `backend/wiki-service/scripts/sync-account-security.ps1 -ServerUrl http://localhost:18081/idp` để bật form mã khôi phục, flow hỏi mã sau Google và áp secret |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SMTP_AUTH`, `MAIL_STARTTLS`, `MAIL_FROM` | SMTP gửi mã xác nhận đổi mật khẩu; để trống `MAIL_HOST` thì trang Cài đặt không cho đổi mật khẩu |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET` | Khóa và bucket object storage |
| `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ASSETS_BUCKET`, `MEDIA_PUBLIC_BASE_URL` | Chỉ khi dùng dịch vụ S3 có sẵn thay SeaweedFS; xem chú thích trong `.env.example` |
| `REDIS_PASSWORD` | Mật khẩu cache |
| `COMMUNITY_EXCHANGE_RATES_ENABLED` | Lấy tỷ giá hằng ngày từ `api.frankfurter.dev`; đặt `false` nếu không muốn gọi ra ngoài |
| `IMAGE_TAG`, `WIKI_MEM_LIMIT`, `COMMUNITY_MEM_LIMIT`, `KEYCLOAK_MEM_LIMIT` | Tùy chọn: nhãn image, giới hạn RAM |

Hai điều dễ nhầm khi đổi `.env` sau lần chạy đầu:

- Đổi `PUBLIC_ORIGIN` cần `docker compose up -d --build --wait` và sửa redirect URI của client trong console Keycloak, vì realm chỉ
  import một lần.
- Mật khẩu database, secret client và `KEYCLOAK_ADMIN_PASSWORD` đã nằm trong volume. Đổi `.env` thôi thì không đủ: phải đổi ở
  PostgreSQL (`ALTER ROLE`) hoặc trong console Keycloak trước, rồi mới đổi `.env`.

## Backup

Backup nằm trong `infra/backups/` (Git bỏ qua), có chứa dữ liệu người dùng và mật khẩu đã băm. Hãy chép thư mục này và cả file `.env`
sang máy khác; client secret trong realm chỉ khớp với `.env` cũ.

```bash
docker compose run --rm -e BACKUP_LABEL=manual db-backup
```

```bash
docker compose run --rm media-backup
```

Lệnh đầu tạo `backups/db/manual-<giờ UTC>/`, bản `manual-` không tự hết hạn; nhãn khác giữ `BACKUP_KEEP` bản mới nhất. Lệnh sau chép ảnh
mới vào `backups/media/`, không bao giờ xóa khỏi backup nên ảnh xóa nhầm vẫn còn. Đặt lịch hằng ngày trên máy chủ thật, ví dụ với cron:

```text
0 3 * * * cd /duong-dan/infra && docker compose run --rm -e BACKUP_LABEL=daily db-backup && docker compose run --rm media-backup
```

## Khôi phục

Khôi phục thay toàn bộ cả ba database bằng bản đã chọn; dữ liệu hiện tại sẽ mất.

```bash
docker compose stop reverse-proxy wiki-service community-service keycloak
```

```bash
docker compose run --rm db-restore manual-20261107T030000Z
```

```bash
docker compose run --rm media-restore
```

```bash
docker compose up -d --wait
```

Chạy `docker compose run --rm db-restore` không tham số để xem danh sách bản backup. Khôi phục trên máy mới: dùng lại `.env` cũ, chạy
`docker compose up -d --build --wait` một lần để có volume và user database, chép `backups/` về rồi làm các bước trên. Đã diễn tập đúng
quy trình này: xóa hết volume, khởi động lại từ trống, khôi phục, tài khoản và dữ liệu trở về nguyên vẹn.

## Trang tĩnh của Wiki

Service một lần `wiki-prerender` tạo trang riêng cho từng tướng, trang phục, mục kho trang bị, thuật ngữ và bản cập nhật, kèm
`sitemap.xml`, để công cụ tìm kiếm và bản xem trước liên kết đọc được mà không cần chạy JavaScript (ADR-022). Nó chạy mỗi lần
`docker compose up`, sau khi `wiki-service` healthy. Nội dung mới chỉ có trang riêng sau lần chạy kế, nên hãy chạy lại khi vừa xuất
bản hoặc đặt theo lịch; không cần khởi động lại proxy:

```bash
docker compose run --rm wiki-prerender
```

Lần chạy tạo trang trên `dist` của chính container, thành công mới thay toàn bộ volume `wiki-site` mà proxy phục vụ. API lỗi thì
site giữ nguyên trang cũ, proxy vẫn chạy, nhưng `docker compose up --wait` trả lỗi và `docker compose logs wiki-prerender` cho biết
lý do; sau khi build lại, site vẫn ở bundle cũ cho tới khi có một lần chạy thành công. Hệ thống mới chưa xuất bản tướng nào vẫn khởi
động bình thường, chỉ chưa có trang riêng. Trong môi trường đó, mọi địa chỉ sâu rơi về `200.html` có `noindex`.

Kiểm tra sau khi chạy: địa chỉ của một tướng phải trả về đúng tên tướng trong `<title>`, không phải tiêu đề trang chủ.

```bash
curl -s http://localhost:18080/hero/airi | grep -i "<title>"
```

## Đưa dữ liệu vào

Hệ thống này không tự lấy dữ liệu từ môi trường dev. Để đưa dữ liệu sang, dump database `wiki`, `community` và cả realm từ dev ở định
dạng `pg_dump --format=custom`, đặt vào `backups/db/<tên>/` đúng ba tên file `wiki.dump`, `community.dump`, `keycloak.dump`, chép ảnh
vào `backups/media/wiki-media/` rồi khôi phục như trên. Bản dump Keycloak của dev có redirect URI và tài khoản local, nên phải sửa
lại realm sau đó. Cách này chưa được chạy thử với dữ liệu dev thật.

## Còn lại cho máy chủ thật

Những việc sau chủ dự án phải quyết định hoặc làm, repo không đoán thay:

- **Máy chủ và tên miền**: chọn nơi thuê, trỏ DNS, mở cổng 80 và 443.
- **TLS**: đặt `SITE_ADDRESS=<tên miền>`, `PUBLIC_ORIGIN=https://<tên miền>`, `PUBLIC_BIND_ADDRESS=0.0.0.0`, `HTTP_PORT=80`,
  `HTTPS_PORT=443`, `AUTH_SECURE_COOKIES=true`, bỏ `COMPOSE_PROFILES`, sinh secret mới rồi build lại. Bước này chưa chạy thử vì chưa có
  tên miền.
- **Object storage**: giữ SeaweedFS trên máy đó, hoặc chuyển sang R2 theo ADR-006 và ADR-014. R2 cần smoke test CopyObject thật.
- **Sao lưu ra ngoài máy**: backup hiện nằm cùng máy. Cần chỗ lưu riêng và lịch chạy.
- **Email của Keycloak**: chưa có SMTP nên quên mật khẩu và xác minh email chưa hoạt động. Đăng ký mở sẵn như realm local
  (`registrationAllowed`), cần quyết định có giữ không.
- **Đăng nhập Google**: tạo OAuth client, cấu hình provider trong Keycloak, đặt `GOOGLE_LOGIN_ENABLED=true`.
- **Tài khoản thật**: tạo biên tập viên và gán vai trò trong console; bật MFA nếu cần.
- **CDN hoặc load balancer**: nếu đặt trước Caddy phải khai báo `trusted_proxies`, nếu không giới hạn tần suất theo IP sẽ sai.
- **Theo dõi**: chưa có giám sát uptime, cảnh báo đầy đĩa hay gom log; log JSON hiện chỉ xoay vòng trong Docker.
- **Tính năng chỉ có ở Vite dev**: JSON storage, ảnh gốc của patch, ảnh shop và nhập từ `/__resources/` trong Admin cần `resources/` và
  dev server, nên bản build trả 404 cho chúng.
- **Content-Security-Policy** chưa đặt; cần liệt kê nguồn thật như YouTube trước khi bật.
