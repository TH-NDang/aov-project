# Chạy toàn hệ thống như production trên một máy

Thư mục này đóng gói Wiki, Stream, Admin, `wiki-service`, `community-service` cùng PostgreSQL, Keycloak, Redis và reverse
proxy Caddy. Ảnh và tệp nguồn nằm trên Cloudflare R2 như môi trường dev, nên máy chạy stack không giữ kho ảnh nào. Không
triển khai đi đâu cả và không đụng tới môi trường dev trong `backend/wiki-service/compose.yaml`. Lý do các lựa chọn nằm ở
[ADR-021](../backend/docs/adr/ADR-021-dong-goi-chay-mot-may.md).

Cần Docker kèm Compose và các bucket R2 đã chuẩn bị theo [Cloudflare R2](#cloudflare-r2). Bản build không đọc `resources/`
(ADR-030), nên clone không cần Git LFS.

## Khởi động

Chạy trong `infra/`, dùng được cả PowerShell lẫn bash. Lần đầu chép file mẫu:

```bash
cp .env.example .env
```

Điền phần object storage trong `.env`: giá trị trong ngoặc nhọn là mẫu. Rồi khởi động:

```bash
docker compose up -d --build --wait
```

`preflight` liệt kê mọi biến R2 còn thiếu hoặc còn giá trị mẫu, và khi đó không thành phần nào khởi động; đọc bằng
`docker compose logs preflight`. Lần đầu phải tải dependency và build image: đo trên máy đang bận là khoảng 18 phút build và
5 phút khởi động. Lệnh chỉ trả về khi mọi thành phần đã healthy.

| Địa chỉ | Là gì |
|---|---|
| <http://localhost:18080/> | AOV Wiki |
| <http://localhost:18080/stream/> | AOV Stream |
| <http://localhost:18080/admin/> | Admin |
| <http://localhost:18081/idp/admin/> | Console Keycloak, chỉ nghe trên máy này, dùng `KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD` |

Tài khoản thử: `admin`, `editor`, `publisher`, mật khẩu là `TEST_USER_PASSWORD` trong `.env`. Hệ thống mới không có dữ liệu Wiki,
danh mục trống là đúng; xem [Đưa dữ liệu vào](#đưa-dữ-liệu-vào).

## Dừng và xóa

```bash
docker compose stop
```

```bash
docker compose down
```

Cả hai đều giữ dữ liệu; `down` xóa container, lần `up` sau tạo lại. Chỉ lệnh sau mới xóa toàn bộ dữ liệu trên máy (database,
chứng chỉ, trang tĩnh), không thể khôi phục nếu không có backup. Object trên R2 không bị đụng tới:

```bash
docker compose down -v
```

## Thứ tự khi khởi động

`preflight` → `postgres` → `db-backup` → `keycloak`, `wiki-service`, `community-service` → `reverse-proxy`. `redis` chạy trước
`wiki-service`; tài khoản thử được tạo sau `keycloak`.

- **`preflight`** kiểm tra cấu hình R2 trên mọi origin: thiếu biến, còn giá trị mẫu, endpoint không phải HTTPS,
  `MEDIA_PUBLIC_BASE_URL` không kết thúc bằng `/assets`, bucket ảnh công khai trùng bucket riêng tư hoặc bucket tệp nguồn,
  purge bật mà thiếu zone hay token. Với origin công khai, nó còn từ chối secret mẫu, tài khoản thử và origin không phải HTTPS.
- **Lần đầu**, `postgres` tạo ba database `wiki`, `community`, `keycloak`, mỗi database một user riêng; Keycloak import realm từ
  `keycloak/wikiaov-realm.json`.
- **`db-backup`** chạy ở mỗi lần `docker compose up`, dump cả ba database vào `backups/db/auto-<giờ UTC>/`, giữ `BACKUP_KEEP`
  bản mới nhất. Backup lỗi thì service không khởi động. Máy khởi động lại tự chạy lại service mà không qua bước này, và cũng không có migration mới.
- **Flyway** chạy khi `wiki-service` và `community-service` khởi động, tức là ngay sau bản dump trên. Migration lỗi thì service
  dừng, không bao giờ healthy và proxy không mở. Xử lý bằng cách khôi phục bản dump `auto-` mới nhất rồi sửa migration.
- Health check dùng `/actuator/health` của hai service, `/health/ready` của Keycloak. Xem bằng `docker compose ps`; proxy chỉ chạy
  sau khi tất cả đã healthy. `/actuator` không đi qua proxy. `wiki-service` không gọi R2 lúc khởi động, nên khóa sai chỉ lộ ra
  khi tải ảnh lên.

## Cloudflare R2

Stack không tạo bucket, không ghi CORS và không đổi gì trên Cloudflare (ADR-014). Chủ dự án chuẩn bị trong dashboard:

| Bucket | Biến | Chứa | Truy cập |
|---|---|---|---|
| Riêng tư | `STORAGE_BUCKET` | `incoming/` (upload chờ kiểm tra), `imports/` | Không public. CORS cho `PUT`, `GET`, `HEAD` từ origin của stack |
| Ảnh công khai | `STORAGE_ASSETS_BUCKET` | `assets/` (ảnh đã kiểm tra, bất biến) | Custom domain `img.<tên miền>`, cache rule như dev |
| Tệp nguồn | `STORAGE_SOURCES_BUCKET` | `sources/` (ảnh đối chứng, dữ liệu nhập) | Không public, không custom domain, không `r2.dev`. CORS cho `GET`, `HEAD` từ origin của stack |

1. **Bucket**: ba bucket Standard như trên. Cách dev đã làm và cache rule của tên miền ảnh nằm trong
   [infra/cloudflare/README.md](../backend/wiki-service/infra/cloudflare/README.md) của `wiki-service`.
2. **Khóa**: một R2 API token chỉ có quyền Object Read & Write trên đúng ba bucket, điền vào `STORAGE_ACCESS_KEY`,
   `STORAGE_SECRET_KEY`. Endpoint là `https://<account-id>.r2.cloudflarestorage.com`.
3. **CORS**: thêm đúng `PUBLIC_ORIGIN` (không có `/` cuối, không wildcard) vào `AllowedOrigins` của bucket riêng tư theo
   [upload-cors.json](../backend/wiki-service/infra/cloudflare/upload-cors.json) và của bucket tệp nguồn theo
   [source-cors.json](../backend/wiki-service/infra/cloudflare/source-cors.json). Admin và Stream cùng một origin nên một
   dòng là đủ. Thiếu CORS thì trình duyệt không tải ảnh lên được, và các màn ảnh gốc, cửa hàng, build, xếp hạng không đọc
   được bộ tệp nguồn.
4. **Tên miền ảnh**: gắn `img.<tên miền>` vào bucket ảnh công khai, đặt `MEDIA_PUBLIC_BASE_URL=https://img.<tên miền>/assets`.
5. **Purge cache**: Zone ID của tên miền (không phải Account ID) và token chỉ có quyền Zone / Cache Purge trên zone đó, điền vào
   `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CACHE_PURGE_TOKEN`. Đặt `MEDIA_CLOUDFLARE_PURGE_ENABLED=false` thì hệ thống vẫn chạy
   nhưng Admin từ chối xóa ảnh.
6. **Tùy chọn**: token chỉ có quyền Account Analytics: Read cùng `CLOUDFLARE_ACCOUNT_ID` để tab Dung lượng R2 của Admin có
   số thật của Cloudflare (ADR-030 mục 9).

**Một database, một bộ bucket.** Hai database dùng chung bucket không ghi đè nhau, vì key ảnh là UUID, nhưng vẫn xóa được của
nhau: tệp nguồn lưu theo SHA-256, nên dọn bytes mồ côi ở database này có thể xóa đúng bytes mà database kia còn dùng; và nếu
một database là bản sao của database kia thì xóa ảnh ở một bên làm hỏng ảnh ở bên còn lại. Stack chạy thử với database trống
cần bộ bucket riêng và tên miền ảnh riêng. Chỉ trỏ vào bucket của dev khi stack này thay hẳn database dev.

Trình duyệt tải lên và đọc tệp nguồn thẳng từ endpoint R2 bằng URL ký sẵn, còn ảnh công khai đến từ tên miền ảnh. Không byte
nào đi qua Caddy hay `wiki-service`.

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
| `WIKI_SERVICE_CLIENT_SECRET` | Secret client `wiki-service` cho trang Cài đặt tài khoản (ADR-028); chỉ đọc khi import realm. Sau lần import đầu (hoặc với realm đã có) chạy `backend/wiki-service/scripts/sync-account-security.ps1 -ServerUrl http://localhost:18081/idp` để bật form mã khôi phục, flow hỏi mã sau Google và áp secret |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SMTP_AUTH`, `MAIL_STARTTLS`, `MAIL_FROM` | SMTP gửi mã xác nhận đổi mật khẩu; để trống `MAIL_HOST` thì trang Cài đặt không cho đổi mật khẩu |
| `STORAGE_ENDPOINT` | Endpoint S3 của R2, `https://<account-id>.r2.cloudflarestorage.com` |
| `STORAGE_PUBLIC_ENDPOINT` | Địa chỉ ghi vào URL ký sẵn; để trống là dùng `STORAGE_ENDPOINT`, đúng với R2 |
| `STORAGE_REGION`, `STORAGE_PATH_STYLE` | `auto` và `true` với R2 |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Khóa của R2 API token |
| `STORAGE_BUCKET`, `STORAGE_ASSETS_BUCKET`, `STORAGE_SOURCES_BUCKET` | Bucket riêng tư, bucket ảnh công khai, bucket tệp nguồn; xem [Cloudflare R2](#cloudflare-r2) |
| `MEDIA_PUBLIC_BASE_URL` | `https://img.<tên miền>/assets`; đuôi `/assets` là bắt buộc |
| `MEDIA_CLOUDFLARE_PURGE_ENABLED`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CACHE_PURGE_TOKEN` | Purge cache Cloudflare khi xóa ảnh |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_TOKEN` | Tùy chọn: số liệu R2 thật trong Admin |
| `REDIS_PASSWORD` | Mật khẩu cache |
| `COMMUNITY_EXCHANGE_RATES_ENABLED` | Lấy tỷ giá hằng ngày từ `api.frankfurter.dev`; đặt `false` nếu không muốn gọi ra ngoài |
| `IMAGE_TAG`, `WIKI_MEM_LIMIT`, `COMMUNITY_MEM_LIMIT`, `KEYCLOAK_MEM_LIMIT` | Tùy chọn: nhãn image, giới hạn RAM |

Hai điều dễ nhầm khi đổi `.env` sau lần chạy đầu:

- Đổi `PUBLIC_ORIGIN` cần `docker compose up -d --build --wait`, sửa redirect URI của client trong console Keycloak, vì realm chỉ
  import một lần, và thay origin trong CORS của hai bucket riêng tư.
- Mật khẩu database, secret client và `KEYCLOAK_ADMIN_PASSWORD` đã nằm trong volume. Đổi `.env` thôi thì không đủ: phải đổi ở
  PostgreSQL (`ALTER ROLE`) hoặc trong console Keycloak trước, rồi mới đổi `.env`.

## Backup

Backup nằm trong `infra/backups/` (Git bỏ qua), có chứa dữ liệu người dùng, mật khẩu đã băm và tệp nguồn riêng tư. Hãy chép thư
mục này và cả file `.env` sang máy khác; client secret trong realm chỉ khớp với `.env` cũ.

```bash
docker compose run --rm -e BACKUP_LABEL=manual db-backup
```

```bash
docker compose run --rm media-backup
```

Lệnh đầu tạo `backups/db/manual-<giờ UTC>/`, bản `manual-` không tự hết hạn; nhãn khác giữ `BACKUP_KEEP` bản mới nhất.

Lệnh sau chép R2 về `backups/media/<tên bucket>/`: `imports/` của bucket riêng tư, `assets/` của bucket ảnh công khai và
`sources/` của bucket tệp nguồn; `incoming/` chỉ chứa upload đang chờ nên bị bỏ qua.

- Không key nào bị ghi lại, nên tệp đã có trong backup không bị tải lại.
- Không gì bị xóa khỏi backup: ảnh hay tệp nguồn đã xóa trên R2 vẫn còn ở đây, và bản dump cũ khôi phục lại vẫn có đủ bytes.
- Tệp nguồn không có đuôi, nên Content-Type của chúng được ghi vào `backups/media/<bucket tệp nguồn>.types` để khôi phục đúng.
- Mỗi lần chạy tốn một thao tác lớp A cho mỗi 1.000 object khi liệt kê, một GetObject cho mỗi object mới và một HeadObject
  cho mỗi tệp nguồn mới. R2 không tính phí tải ra. Với khoảng 10.000 object hiện có, chạy hằng ngày tốn chưa tới 0,1% mức
  miễn phí mỗi tháng.
- Thư mục chiếm chỗ bằng tổng ba bucket, khoảng 4,4 GB theo ước tính của ADR-030.

Đặt lịch hằng ngày trên máy chủ thật, database trước để mọi object mà bản dump tham chiếu đều có trong bản chép ngay sau đó,
ví dụ với cron:

```text
0 3 * * * cd /duong-dan/infra && docker compose run --rm -e BACKUP_LABEL=daily db-backup && docker compose run --rm media-backup
```

Bản chép này nằm cùng máy với stack: nó giữ được dữ liệu khi mất object trên R2, không giữ được khi mất máy.

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
`docker compose up -d --build --wait` một lần để có volume và user database, chép `backups/` về rồi làm các bước trên. Đã diễn tập
phần database của quy trình này: xóa hết volume, khởi động lại từ trống, khôi phục, tài khoản và dữ liệu trở về nguyên vẹn.

`media-restore` ghi lên R2 thật, nhưng chỉ đưa lên những tệp backup mà bucket còn thiếu; không ghi đè và không xóa object nào.
Bỏ qua bước này nếu R2 không mất gì. Object được ghi lại với header như backend đã ghi:

- `assets/`: Content-Type theo đuôi tệp, `Cache-Control: public, max-age=31536000, immutable`.
- `sources/`: Content-Type theo file `.types`, `Cache-Control: private, max-age=31536000, immutable`. Tệp chưa có dòng trong
  `.types` (backup bị ngắt giữa chừng) vẫn được đưa lên, với `application/octet-stream`.
- `imports/`: như khi chép về.

Ảnh công khai đã khôi phục có thể vẫn trả 404 từ cache của Cloudflare tới khi cache đó hết hạn hoặc được purge.

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
dạng `pg_dump --format=custom`, đặt vào `backups/db/<tên>/` đúng ba tên file `wiki.dump`, `community.dump`, `keycloak.dump` rồi
khôi phục database như trên. Bản dump Keycloak của dev có redirect URI và tài khoản local, nên phải sửa lại realm sau đó.

Bytes đi theo bucket, không theo dump. Stack trỏ vào chính bucket của dev thì không cần chép gì, nhưng đọc lại quy tắc "một
database, một bộ bucket" ở [Cloudflare R2](#cloudflare-r2). Stack có bucket riêng thì phải chép object của dev sang đó trước,
giữ nguyên key và metadata, ví dụ bằng `rclone copy` giữa hai bucket trong cùng tài khoản. Cách này chưa được chạy thử với dữ
liệu dev thật.

Stack cũ còn container và volume của kho ảnh đi kèm trước đây: xem phần bổ sung ngày 17/11/2026 của ADR-021 để dọn.

## Còn lại cho máy chủ thật

Những việc sau chủ dự án phải quyết định hoặc làm, repo không đoán thay:

- **Máy chủ và tên miền**: chọn nơi thuê, trỏ DNS, mở cổng 80 và 443.
- **TLS**: đặt `SITE_ADDRESS=<tên miền>`, `PUBLIC_ORIGIN=https://<tên miền>`, `PUBLIC_BIND_ADDRESS=0.0.0.0`, `HTTP_PORT=80`,
  `HTTPS_PORT=443`, `AUTH_SECURE_COOKIES=true`, bỏ `COMPOSE_PROFILES`, sinh secret mới rồi build lại. Bước này chưa chạy thử vì chưa có
  tên miền.
- **R2 cho stack này**: chuẩn bị theo [Cloudflare R2](#cloudflare-r2). R2 đã chạy thật ở dev (upload, CopyObject, CDN); trên
  origin của stack còn phải thử một lần: tải ảnh lên trong Admin, xem ảnh qua tên miền ảnh, mở ảnh gốc ở trang tướng.
- **Sao lưu ra ngoài máy**: backup hiện nằm cùng máy. Cần chỗ lưu riêng và lịch chạy.
- **Email của Keycloak**: chưa có SMTP nên quên mật khẩu và xác minh email chưa hoạt động. Đăng ký mở sẵn như realm local
  (`registrationAllowed`), cần quyết định có giữ không.
- **Đăng nhập Google**: tạo OAuth client, cấu hình provider trong Keycloak, đặt `GOOGLE_LOGIN_ENABLED=true`.
- **Tài khoản thật**: tạo biên tập viên và gán vai trò trong console; bật MFA nếu cần.
- **CDN hoặc load balancer**: nếu đặt trước Caddy phải khai báo `trusted_proxies`, nếu không giới hạn tần suất theo IP sẽ sai.
- **Theo dõi**: chưa có giám sát uptime, cảnh báo đầy đĩa hay gom log; log JSON hiện chỉ xoay vòng trong Docker.
- **Tính năng chỉ có ở Vite dev**: JSON storage của Admin cần dev server, nên bản build trả 404 cho nó.
- **Content-Security-Policy** chưa đặt, nên hiện không có gì chặn R2. Khi bật phải liệt kê nguồn thật: ít nhất `img-src` có
  tên miền ảnh và endpoint R2 (ảnh đối chứng qua URL ký sẵn), `connect-src` có endpoint R2 (upload, manifest tệp nguồn), cùng
  các nguồn khác như YouTube.
