# Chạy toàn hệ thống như production trên một máy

Thư mục này đóng gói Wiki, Stream, Admin, `wiki-service`, `community-service` cùng PostgreSQL, Keycloak, Redis và reverse
proxy Caddy. Ảnh và tệp nguồn nằm trên Cloudflare R2 như môi trường dev, nên máy chạy stack không giữ kho ảnh nào. Không
triển khai đi đâu cả và không đụng tới môi trường dev trong `backend/wiki-service/compose.yaml`. Lý do các lựa chọn nằm ở
[ADR-021](../backend/docs/adr/ADR-021-dong-goi-chay-mot-may.md).

Cần Docker kèm Compose và quyền dùng ba bucket R2 của trang, xem [Cloudflare R2](#cloudflare-r2). Bản build không đọc
`resources/` (ADR-030), nên clone không cần Git LFS.

## Khởi động

Chạy trong `infra/`, dùng được cả PowerShell lẫn bash. Lần đầu chép file mẫu:

```bash
cp .env.example .env
```

Điền phần object storage trong `.env`: giá trị trong ngoặc nhọn là mẫu. Tên bucket và tên miền ảnh đã là của trang thật.
Rồi khởi động:

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
danh mục trống là đúng; xem [Chuyển dữ liệu dev lên](#chuyển-dữ-liệu-dev-lên). Database trống đó là database thứ hai bên cạnh
dev: khi nó trỏ vào bucket thật, đừng tải ảnh lên hay xóa ảnh trước khi đã nhận database dev (quy tắc ở
[Cloudflare R2](#cloudflare-r2)).

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

`preflight` → `postgres` → `db-backup` → `keycloak`, `wiki-service`, `community-service` → `web-publish`, `wiki-prerender` →
`reverse-proxy`. `redis` chạy trước `wiki-service`; tài khoản thử được tạo sau `keycloak`. `page-reader` chạy riêng, không
service nào chờ nó. `web-publish` đưa bản build của Stream
và Admin vào volume `web-apps`, `wiki-prerender` đưa Wiki vào `wiki-site`; Caddy phục vụ hai volume đó.

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

Stack dùng ba bucket và tên miền ảnh mà dev đang dùng, vì khi ra mắt nó nhận lại database của dev (xem
[Chuyển dữ liệu dev lên](#chuyển-dữ-liệu-dev-lên)). Nó không tạo bucket, không ghi CORS và không đổi gì trên Cloudflare (ADR-014).

| Bucket | Biến | Chứa | Truy cập |
|---|---|---|---|
| `aov-media-private` | `STORAGE_BUCKET` | `incoming/` (upload chờ kiểm tra), `imports/` | Không public. CORS cho `PUT`, `GET`, `HEAD` |
| `aov-media-assets` | `STORAGE_ASSETS_BUCKET` | `assets/` (ảnh đã kiểm tra, bất biến) | Custom domain `img.athahub.com`, nên `MEDIA_PUBLIC_BASE_URL=https://img.athahub.com/assets` |
| `aov-source-private` | `STORAGE_SOURCES_BUCKET` | `sources/` (ảnh đối chứng, dữ liệu nhập) | Không public, không custom domain, không `r2.dev`. CORS cho `GET`, `HEAD` |

Bucket, tên miền ảnh và cache rule đã có từ dev, cách làm nằm trong
[infra/cloudflare/README.md](../backend/wiki-service/infra/cloudflare/README.md) của `wiki-service`; không tạo lại. Trước khi
chạy stack trên VPS, chủ dự án làm trong dashboard:

1. **CORS**: thêm `PUBLIC_ORIGIN` của trang thật (`https://<tên miền>`, không có `/` cuối, không wildcard) vào
   `AllowedOrigins` của `aov-media-private` theo [upload-cors.json](../backend/wiki-service/infra/cloudflare/upload-cors.json)
   và của `aov-source-private` theo [source-cors.json](../backend/wiki-service/infra/cloudflare/source-cors.json). Giữ các origin
   `localhost` đang có. Admin và Stream cùng một origin nên một dòng là đủ. Thiếu CORS thì trình duyệt không tải ảnh lên được,
   và các màn ảnh gốc, cửa hàng, build, xếp hạng không đọc được bộ tệp nguồn.
2. **Token R2 của VPS**: một R2 API token mới, chỉ dành cho VPS, chỉ có quyền Object Read & Write trên đúng ba bucket trên;
   điền vào `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` của `.env` trên VPS. Không dùng lại token của máy dev: sau ngày ra mắt
   máy dev không được ghi vào các bucket này nữa, và thu hồi token của nó không được làm VPS mất quyền. Endpoint giống dev,
   `https://<account-id>.r2.cloudflarestorage.com`.
3. **Token Cache Purge**: token chỉ có quyền Zone / Cache Purge trên zone `athahub.com`, cùng Zone ID của zone đó (không phải
   Account ID), điền vào `CLOUDFLARE_CACHE_PURGE_TOKEN`, `CLOUDFLARE_ZONE_ID`. Đặt `MEDIA_CLOUDFLARE_PURGE_ENABLED=false` thì hệ
   thống vẫn chạy nhưng Admin từ chối xóa ảnh.
4. **Tùy chọn**: token chỉ có quyền Account Analytics: Read cùng `CLOUDFLARE_ACCOUNT_ID` để tab Dung lượng R2 của Admin có
   số thật của Cloudflare (ADR-030 mục 9).
5. **Vòng đời `incoming/`**: trên `aov-media-private` thêm quy tắc xóa object có prefix `incoming/` sau 1 ngày (R2 → bucket →
   Settings → Object lifecycle rules). Upload bị bỏ dở, kể cả do người cố tình xin nhiều URL rồi không gọi `complete`, sẽ không
   nằm lại mãi. Không đặt quy tắc cho `imports/` hay cho `aov-source-private`.

**Một database, một bộ bucket.** Ba bucket trên chỉ được có một database dùng: hôm nay là database dev, sau khi chuyển là
database của stack. Quy tắc này áp dụng khi xuất hiện database thứ hai, ví dụ dev trên máy sau ngày ra mắt, stack chạy thử với
database trống, hay một bản diễn tập chuyển dữ liệu. Hai database dùng chung bucket không ghi đè nhau, vì key ảnh là UUID,
nhưng vẫn xóa được của nhau: tệp nguồn lưu theo SHA-256, nên dọn bytes mồ côi ở database này có thể xóa đúng bytes mà database
kia còn dùng; và nếu một database là bản sao của database kia thì xóa ảnh ở một bên làm hỏng ảnh ở bên còn lại. Database thứ
hai cần bộ bucket riêng, token riêng và địa chỉ ảnh riêng; bộ bucket dev đó chưa được tạo.

Trình duyệt tải lên và đọc tệp nguồn thẳng từ endpoint R2 bằng URL ký sẵn, còn ảnh công khai đến từ tên miền ảnh. Không byte
nào đi qua Caddy hay `wiki-service`.

## Biến môi trường

Mọi giá trị nằm trong `.env`; Git chỉ theo dõi `.env.example`. Secret chỉ nên có chữ và số, vì Compose xử lý `$` đặc biệt.

| Biến | Ý nghĩa |
|---|---|
| `PUBLIC_ORIGIN` | Origin trình duyệt dùng, không có `/` cuối. Biên dịch vào frontend và ghi vào realm khi import |
| `SITE_ADDRESS` | `:80` trên máy này; tên miền trên máy chủ, Caddy khi đó tự lấy chứng chỉ TLS. Ghi cả hai tên trong ngoặc kép, như `"athahub.com, www.athahub.com"`, để `www.` chuyển 308 về tên chính |
| `PUBLIC_BIND_ADDRESS`, `HTTP_PORT`, `HTTPS_PORT` | Nơi proxy nghe trên máy chủ |
| `TRUSTED_PROXIES` | Chỉ khi có CDN trước Caddy (proxy Cloudflare): dải IP của CDN, cách nhau bằng dấu cách; `.env.example` có sẵn dải của Cloudflare. Để trống khi trình duyệt vào thẳng máy này. Sai giá trị thì giới hạn tần suất đếm chung cho mọi người |
| `KEYCLOAK_ADMIN_PORT` | Cổng console Keycloak, luôn chỉ trên `127.0.0.1` |
| `AUTH_SECURE_COOKIES` | `true` khi có HTTPS. `false` chỉ dành cho HTTP loopback |
| `COMPOSE_PROFILES` | `test-identity` tạo tài khoản thử; bỏ đi trên máy chủ thật |
| `TEST_USER_PASSWORD` | Mật khẩu tài khoản thử |
| `POSTGRES_SUPERUSER`, `POSTGRES_SUPERUSER_PASSWORD` | Quản trị PostgreSQL, dùng cho backup và restore |
| `WIKI_DB_PASSWORD`, `COMMUNITY_DB_PASSWORD`, `KEYCLOAK_DB_PASSWORD` | Mật khẩu user của từng database |
| `BACKUP_KEEP` | Số bản dump tự động giữ lại |
| `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD` | Tài khoản quản trị Keycloak, chỉ đọc ở lần đầu |
| `ADMIN_AUTH_CLIENT_SECRET`, `WIKI_IMPORTER_CLIENT_SECRET` | Secret của client `admin-aov-backend`, `wiki-importer`; chỉ đọc khi import realm |
| `GOOGLE_LOGIN_ENABLED` | Bật nút đăng nhập Google ở Admin; cần provider `google` trong Keycloak, có sẵn sau khi [chuyển dữ liệu dev lên](#chuyển-dữ-liệu-dev-lên) |
| `WIKI_SERVICE_CLIENT_SECRET` | Secret client `wiki-service` cho trang Cài đặt tài khoản (ADR-028); chỉ đọc khi import realm. Sau lần import đầu (hoặc với realm đã có) chạy `backend/wiki-service/scripts/sync-account-security.ps1 -ServerUrl http://localhost:18081/idp` để bật form mã khôi phục, flow hỏi mã sau Google và áp secret |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SMTP_AUTH`, `MAIL_STARTTLS`, `MAIL_FROM` | SMTP dùng chung: mã xác nhận đổi mật khẩu, link quên mật khẩu của Keycloak và cảnh báo của máy chủ (xem [Cảnh báo qua email](#cảnh-báo-qua-email)); để trống `MAIL_HOST` thì không gửi gì và trang Cài đặt không cho đổi mật khẩu |
| `ALERT_EMAIL` | Nơi nhận cảnh báo của máy chủ |
| `OFFSITE_BUCKET`, `OFFSITE_ACCESS_KEY`, `OFFSITE_SECRET_KEY` | Bucket R2 riêng và token chỉ dùng cho nó, nơi chép bản dump mỗi đêm (xem [Bản sao ngoài máy](#bản-sao-ngoài-máy)); để trống thì dump chỉ nằm trên máy này |
| `STORAGE_ENDPOINT` | Endpoint S3 của R2, `https://<account-id>.r2.cloudflarestorage.com` |
| `STORAGE_PUBLIC_ENDPOINT` | Địa chỉ ghi vào URL ký sẵn; để trống là dùng `STORAGE_ENDPOINT`, đúng với R2 |
| `STORAGE_REGION`, `STORAGE_PATH_STYLE` | `auto` và `true` với R2 |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | Khóa của R2 API token dành riêng cho máy chạy stack |
| `STORAGE_SIGN_UPLOAD_SIZE` | `true` thì URL upload ký cả kích thước đã khai, R2 từ chối tệp lớn hơn. R2 không ghi trong tài liệu là có kiểm tra, nên bật ở dev trước (tải avatar và một ảnh lên), rồi mới bật trên stack |
| `STORAGE_BUCKET`, `STORAGE_ASSETS_BUCKET`, `STORAGE_SOURCES_BUCKET` | `aov-media-private`, `aov-media-assets`, `aov-source-private`; xem [Cloudflare R2](#cloudflare-r2) |
| `MEDIA_PUBLIC_BASE_URL` | `https://img.athahub.com/assets`; đuôi `/assets` là bắt buộc |
| `MEDIA_CLOUDFLARE_PURGE_ENABLED`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CACHE_PURGE_TOKEN` | Purge cache Cloudflare khi xóa ảnh |
| `IMAGE_RESIZE` | `cloudflare` để Wiki xin ảnh Media đúng cỡ hiển thị qua Cloudflare Image Transformations (`/cdn-cgi/image/...` trên host ảnh); bật Transformations cho zone trước, rồi build lại. Để trống thì phát ảnh gốc. Image `web` do CI build (`images.yml`) lấy giá trị từ biến repo `STACK_IMAGE_RESIZE`, mặc định `cloudflare`; đặt `off` để tắt |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_TOKEN` | Tùy chọn: số liệu R2 thật trong Admin |
| `REDIS_PASSWORD` | Mật khẩu cache |
| `REQUIRE_STAFF_OTP`, `VERIFY_EMAIL` | Chỉ cho `keycloak-harden`, mặc định `false`; xem [Bảo mật realm](#bảo-mật-realm) |
| `COMMUNITY_EXCHANGE_RATES_ENABLED` | Lấy tỷ giá hằng ngày từ `api.frankfurter.dev`; đặt `false` nếu không muốn gọi ra ngoài |
| `YOUTUBE_API_KEY` | Khóa YouTube Data API v3 của `community-service`, cho phần xem kênh YouTube trong web. Tạo riêng cho máy chủ trên Google Cloud, chỉ cho phép YouTube Data API v3 và địa chỉ IP của máy chủ. Để trống thì chỉ đọc feed công khai của kênh |
| `IMAGE_TAG`, `WIKI_MEM_LIMIT`, `COMMUNITY_MEM_LIMIT`, `KEYCLOAK_MEM_LIMIT`, `PAGE_READER_MEM_LIMIT` | Tùy chọn: nhãn image, giới hạn RAM |

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

Trên máy chủ, `aov-backup.timer` chạy cả hai mỗi đêm, database trước để mọi object mà bản dump tham chiếu đều có trong bản
chép ngay sau đó (xem [Việc chạy theo lịch](#việc-chạy-theo-lịch)).

Bản chép R2 nằm cùng máy với stack: nó giữ được dữ liệu khi mất object trên R2, không giữ được khi mất máy.

### Bản sao ngoài máy

Mỗi đêm, ngay sau khi dump, `db-offsite` chép các thư mục trong `backups/db/` lên một bucket R2 riêng (ADR-021, bổ sung
19/11/2026 về cảnh báo và backup ngoài máy). Thư mục đã có trên bucket được bỏ qua; script không bao giờ xóa gì trên đó. Bản
đang ghi (`.partial`) và bản chuyển dữ liệu dev (`dev-*`) không được chép. Ảnh và tệp nguồn vốn nằm trên R2 nên không chép thêm.

Chuẩn bị một lần trên Cloudflare (R2 → Overview):

1. **Create bucket**, ví dụ `aov-backup-private`. Không gắn tên miền, không bật `r2.dev`.
2. Trong bucket đó, Settings → **Object lifecycle rules** → thêm quy tắc xóa object sau 60 ngày. Mỗi bản dump khoảng 30 MB,
   nên 60 ngày nằm trong 10 GB miễn phí. Muốn VPS không xóa được bản gần đây, thêm **Bucket lock rule** (ví dụ 30 ngày).
3. R2 → **Manage API tokens** → Create API token: quyền **Object Read & Write**, chỉ áp cho bucket vừa tạo.
4. Trên VPS, thêm vào `infra/.env` (chế độ 600):

   ```text
   OFFSITE_BUCKET=aov-backup-private
   OFFSITE_ACCESS_KEY=<Access Key ID của token>
   OFFSITE_SECRET_KEY=<Secret Access Key của token>
   ```

5. Chép thử ngay, không cần chờ tới đêm:

   ```bash
   docker compose run --rm db-offsite
   ```

`.env` không lên bucket. Hãy giữ một bản `.env` ở chỗ khác, ví dụ trong trình quản lý mật khẩu: khôi phục trên máy mới cần đúng
các secret đó.

Lấy một bản dump về máy mới, rồi khôi phục như ở mục dưới:

```bash
docker compose run --rm -v ./backups/db:/restore --entrypoint rclone db-offsite copy offsite:aov-backup-private/db/<thư mục> /restore/<thư mục>
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
`docker compose up`, sau khi `wiki-service` healthy. Nội dung mới chỉ có trang riêng sau lần chạy kế. Trên máy chủ,
`aov-wiki-pages.timer` chạy lại 15 phút một lần (xem [Việc chạy theo lịch](#việc-chạy-theo-lịch)); muốn có ngay thì chạy tay, không
cần khởi động lại proxy:

```bash
docker compose run --rm wiki-prerender
```

Lần chạy tạo trang trên `dist` của chính container, thành công mới thay toàn bộ volume `wiki-site` mà proxy phục vụ. Prerender lỗi
thì `docker compose up --wait` trả lỗi, `docker compose logs wiki-prerender` cho biết lý do, proxy vẫn chạy:

- Bundle trong image là bundle site đang phục vụ (chạy lại sau khi xuất bản): site giữ nguyên trang cũ.
- Bundle mới (sau khi build lại): bundle mới vẫn được đưa ra để khớp với backend, nhưng chưa có trang riêng và `sitemap.xml` cho tới
  lần chạy thành công kế tiếp (ADR-022, bổ sung 19/11/2026).

Hệ thống mới chưa xuất bản tướng nào vẫn khởi động bình thường, chỉ chưa có trang riêng. Trong cả hai trường hợp không có trang
riêng, mọi địa chỉ sâu rơi về `200.html` có `noindex`.

Sau một lần cập nhật dừng giữa chừng, tên `aov/web:local` có thể đã trỏ tới image của commit mới. Đừng chạy tay lúc đó: job sẽ coi
đây là bản mới và đưa bundle mới ra trước backend mới. Timer tự bỏ qua trường hợp này cho tới khi một lần cập nhật thành công.

Kiểm tra sau khi chạy: địa chỉ của một tướng phải trả về đúng tên tướng trong `<title>`, không phải tiêu đề trang chủ.

```bash
curl -s http://localhost:18080/hero/airi | grep -i "<title>"
```

## Cập nhật không gián đoạn

Trên máy chủ, `scripts/deploy.sh` đưa stack lên một commit mới mà site không dừng (ADR-021, bổ sung 18/11/2026):

- **Backend** (`wiki-service`, `community-service`): container mới chạy bên cạnh container cũ. Chỉ khi container mới healthy và trả
  lời được API, container cũ mới dừng sau khi trả nốt request đang chạy. Container mới hỏng thì bị xóa, bản cũ vẫn chạy.
- **Frontend**: `web-publish` và `wiki-prerender` chép file mới vào volume trước, xóa file cũ sau; bundle của bản trước được giữ
  thêm một lần để tab đang mở không lỗi. Caddy không phải khởi động lại.
- **Caddyfile**: áp bằng `caddy reload`. Container Caddy chỉ thay khi `proxy/Dockerfile` đổi (dừng vài giây).
- **Keycloak**: chỉ khởi động lại khi `keycloak/` hoặc theme đổi. Khoảng một phút không đăng nhập mới được; phiên đang có được giữ.
- **`page-reader`**: thay thẳng khi `page-reader/` hoặc `compose.yaml` đổi. Không lên được thì lần cập nhật vẫn đi tiếp, chỉ trang
  tin Indonesia chưa được đọc.
- Trước khi container backend mới chạy migration, `db-backup` dump database như với `up`.

Migration phải để bản cũ vẫn chạy được, vì hai bản cùng chạy một lúc trên schema mới. Xóa hay đổi tên cột, bảng thì làm qua hai lần
phát hành: thêm cái mới trước, bỏ cái cũ ở lần sau.

Image lấy từ GHCR (`ghcr.io/th-ndang/aov-project/<image>:<commit>`, workflow `images.yml` build cho mỗi commit của `main`). Không
tải được thì script build ngay trên máy, trong lúc container cũ vẫn phục vụ. Muốn máy chủ tải được mà không cần đăng nhập, đặt sáu
package của repo trên GitHub ở chế độ Public (Package settings → Change visibility).

Chạy tay, trong thư mục checkout trên máy chủ:

```bash
bash infra/scripts/deploy.sh
```

```bash
bash infra/scripts/deploy.sh <commit>
```

```bash
bash infra/scripts/deploy.sh --refresh
```

- Không tham số: commit mới nhất của `main`, chỉ khi mọi check của commit đó trên GitHub đã xong và đạt, và commit đó nối tiếp
  commit đang chạy. Timer chỉ đi tới: `main` bị viết lại lịch sử hoặc lùi về thì nó không làm gì.
- `<commit>`: đúng commit đó, kể cả khi check chưa đạt; dùng để quay lui về commit trước. Chỉ khi chưa ván đấu nào có `build`
  (trang bị đã lên) mới quay lui được về bản chưa biết trường này, vì bản đó từ chối trường lạ và trả 500 cho ván có `build`; đã
  có thì sửa bằng một commit mới.
- `--refresh`: chạy lại các bước không gián đoạn trên commit đang chạy, dùng sau khi đổi `.env` cho backend. Đổi giá trị của
  Keycloak, PostgreSQL hay Caddy trong `.env` thì vẫn dùng `docker compose up -d --wait`.

Commit đang chạy nằm trong `infra/.deploy/deployed`. Commit lỗi được ghi vào `infra/.deploy/rejected` và không được thử lại tự
động; commit mới hơn hoặc chạy tay thì có.

Tự động mỗi năm phút bằng systemd, sau khi checkout nằm ở `/opt/aov-project`:

```bash
sudo cp /opt/aov-project/infra/systemd/aov-deploy.service /opt/aov-project/infra/systemd/aov-deploy.timer /etc/systemd/system/
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now aov-deploy.timer
```

Xem các lần chạy:

```bash
journalctl -u aov-deploy.service -n 100
```

## Việc chạy theo lịch

Ba timer systemd nữa chạy `scripts/scheduled.sh` giữa các lần cập nhật (ADR-021, hai bổ sung 19/11/2026):

| Timer | Khi nào | Làm gì |
|---|---|---|
| `aov-wiki-pages.timer` | 15 phút một lần | `scheduled.sh pages`: chạy lại `wiki-prerender` trên bản đang chạy, để nội dung vừa xuất bản có trang riêng và có trong `sitemap.xml`. Lỗi thì site giữ trang cũ |
| `aov-backup.timer` | 03:00 giờ Việt Nam mỗi ngày | `scheduled.sh backup`: `db-backup` với nhãn `daily`, `db-offsite` (khi có `OFFSITE_BUCKET`), rồi `media-backup` |
| `aov-watch.timer` | 5 phút một lần | `scheduled.sh watch`: kiểm tra sức khỏe, gửi email khi có vấn đề và khi hết (xem [Cảnh báo qua email](#cảnh-báo-qua-email)) |

- Cả ba dùng chung khóa với `deploy.sh`, nên không chạy giữa một lần cập nhật. `pages` và `watch` gặp khóa thì bỏ lượt (lần cập
  nhật tự prerender và tự gọi thử các địa chỉ công khai); `backup` chờ tối đa một giờ, và nhả khóa trước khi chép.
- `db-offsite` lỗi thì `media-backup` vẫn chạy, rồi lần chạy báo lỗi.
- `pages` chỉ chạy khi checkout nằm đúng ở commit trong `infra/.deploy/deployed`. Một lần cập nhật dừng giữa chừng làm nó báo lỗi
  mỗi 15 phút cho tới khi một lần cập nhật thành công.
- Bản `daily` giữ `BACKUP_KEEP` bản mới nhất, riêng với bản `auto` của các lần cập nhật. Lần `media-backup` đầu tiên tải toàn bộ
  object R2 về, khoảng 4,4 GB.
- Máy tắt lúc 03:00 thì backup chạy khi máy bật lại.

Cài một lần, sau khi checkout nằm ở `/opt/aov-project`; đổi file unit trong repo thì chép lại:

```bash
sudo cp /opt/aov-project/infra/systemd/aov-* /etc/systemd/system/
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now aov-wiki-pages.timer aov-backup.timer aov-watch.timer
```

Xem các lần chạy và lần chạy kế tiếp:

```bash
journalctl -u aov-wiki-pages.service -u aov-backup.service -u aov-watch.service -n 100
```

```bash
systemctl list-timers 'aov-*'
```

## Cảnh báo qua email

Máy chủ gửi email tới `ALERT_EMAIL` qua SMTP của `MAIL_*` (ADR-021, bổ sung 19/11/2026 về cảnh báo và backup ngoài máy):

- **Một lần chạy lỗi** của `aov-deploy`, `aov-wiki-pages` hay `aov-backup`: `OnFailure=` gọi `aov-alert@.service`, gửi log của
  đúng lần chạy đó. Cùng một lỗi lặp lại (cùng dòng log cuối) chỉ gửi một lần mỗi sáu giờ; lỗi khác gửi ngay.
- **Kiểm tra sức khỏe** năm phút một lần (`aov-watch.timer`): các địa chỉ công khai trả lời qua Caddy, các service chạy và không
  `unhealthy`, đĩa dưới 85%, bản backup `daily` mới nhất chưa quá 26 giờ. Lỗi được thử lại sau 30 giây rồi mới gửi; danh sách
  đổi thì gửi ngay, giữ nguyên thì sáu giờ một lần, hết lỗi thì có một email báo đã ổn.
- Kiểm tra chạy trên chính VPS: máy tắt hẳn hay mất mạng thì không có email nào.
- Chưa đặt `MAIL_HOST`, `MAIL_PASSWORD` hoặc `ALERT_EMAIL` thì không gửi gì; nội dung chỉ vào journal.

DigitalOcean chặn cổng 25, 465 và 587 đi ra từ droplet, nên Gmail không dùng được. Cách đang dùng là Resend qua cổng 2587:

1. Tạo tài khoản ở resend.com, vào **Domains** → **Add Domain** → `athahub.com`.
2. Thêm các bản ghi DNS Resend đưa ra (DKIM, SPF cho `send.athahub.com`) trong Cloudflare → DNS của `athahub.com`, để
   **DNS only**. Chờ Resend báo **Verified**.
3. **API Keys** → Create API Key, quyền **Sending access**, chỉ cho `athahub.com`.
4. Trên VPS, trong `infra/.env`:

   ```text
   MAIL_HOST=smtp.resend.com
   MAIL_PORT=2587
   MAIL_USERNAME=resend
   MAIL_PASSWORD=<API key>
   MAIL_FROM=AOV <no-reply@athahub.com>
   ALERT_EMAIL=<email nhận cảnh báo>
   ```

5. Cho wiki-service đọc giá trị mới, đặt SMTP cho Keycloak (bật "Quên mật khẩu"), rồi gửi thử một email:

   ```bash
   bash scripts/deploy.sh --refresh
   ```

   ```bash
   docker compose run --rm keycloak-mail
   ```

   ```bash
   echo "Thử gửi từ máy chủ." | bash scripts/alert.sh send "test"
   ```

`keycloak-mail` phải chạy lại mỗi khi đổi `MAIL_*`, vì Keycloak chỉ đọc file realm lần đầu tạo realm. Nó không bật "Xác minh
email": bật lên sẽ buộc mọi tài khoản đang có phải xác minh ở lần đăng nhập kế.

Cài unit cùng các timer ở [Việc chạy theo lịch](#việc-chạy-theo-lịch); `aov-alert@.service` không cần `enable`.

## Chuyển dữ liệu dev lên

Khi ra mắt, stack nhận lại database và bucket của dev, và dữ liệu dev trở thành dữ liệu thật. Database `wiki`, `community` và
các tài khoản đi theo bản xuất. Ảnh và tệp nguồn nằm nguyên trên ba bucket, vì key trong database trỏ đúng object đang có,
nên không chép object nào.

Hai điều làm việc này khác một lần [khôi phục](#khôi-phục) bình thường:

- Keycloak của dev chạy `start-dev`: realm và người dùng nằm trong file H2 của volume `keycloak-data`, không trong PostgreSQL,
  nên không có `keycloak.dump`. Chỉ tài khoản được chuyển, realm (client, redirect URI, secret) vẫn là realm mẫu của stack.
- Database nhận diện người dùng theo cặp issuer và subject: hồ sơ, người tạo và người sửa nội dung, đội hình và lượt thích,
  nhật ký. Subject được giữ vì tài khoản giữ nguyên ID; issuer thì đổi, từ `http://localhost:8081/realms/wikiaov` của dev sang
  `<PUBLIC_ORIGIN>/idp/realms/wikiaov` của stack.

**Trên máy dev**, trong `backend/wiki-service`, bằng PowerShell:

1. Dừng `wiki-service` và `community-service` để không còn gì ghi vào database. Dừng Keycloak dev, giữ PostgreSQL chạy:

   ```powershell
   docker compose stop keycloak
   ```

2. Xuất:

   ```powershell
   ./scripts/dev/export-for-stack.ps1
   ```

   Script tạo `infra/backups/db/dev-<giờ UTC>/` gồm `wiki.dump`, `community.dump`, `keycloak-users.json` và
   `keycloak-identity-providers.json` (provider Google của dev, kèm secret của OAuth client). Nó không đổi gì ở dev: `pg_dump`
   chỉ đọc, còn tài khoản được xuất từ một bản chép của volume Keycloak trong container tạm. Nó dừng lại nếu
   Keycloak dev còn chạy, nếu cổng 8080 hoặc 8082 còn trả lời, hoặc nếu database có migration mà checkout này không có, vì
   stack sẽ không khởi động được trên database đó.
3. Chép thư mục đó vào `infra/backups/db/` trên VPS bằng kênh riêng, ví dụ `scp -r`, rồi xóa bản trên máy dev. Thư mục chứa
   mật khẩu đã băm, dữ liệu người dùng và secret Google. Muốn khóa nó trên VPS thì để thư mục `750`, hai file `.json` là
   `640` và hai file `.dump` là `600`, chủ là `root`: `dev-users-import` chạy bằng user `keycloak` (uid 1000, nhóm `root`),
   nên với `700` hoặc `600` nó không đọc được file tài khoản.

**Trên VPS**, trong `infra/`, sau khi stack đã `up` một lần và realm chưa có người dùng nào (không bật `test-identity`):

```bash
docker compose stop reverse-proxy wiki-service community-service
```

```bash
docker compose run --rm dev-import dev-20261117T030000Z
```

```bash
docker compose run --rm dev-users-import dev-20261117T030000Z
```

```bash
docker compose up -d --wait
```

- `dev-import` thay `wiki` và `community` bằng bản dump, rồi đổi mọi issuer kết thúc bằng `/realms/wikiaov` sang issuer của
  stack và in số giá trị đã đổi. Issuer của tác nhân ngoài Keycloak (`local-maintenance`, `urn:wikiaov:migration`) giữ nguyên.
  Chạy lại được: lần nào cũng bắt đầu từ bản dump.
- `dev-users-import` thêm provider Google của dev (bỏ qua nếu stack đã có provider `google`), rồi thêm tài khoản vào realm
  với nguyên ID, mật khẩu đã băm, vai trò và liên kết Google.
  `service-account-wiki-importer` của dev thay cho bản của realm mẫu, để nội dung nó đã nhập vẫn có tác giả. Ba tài khoản thử
  `admin`, `editor`, `publisher` bị khóa, vì mật khẩu của chúng nằm trong repo công khai. Lệnh từ chối chạy khi realm đã có
  người dùng, để sau ngày ra mắt không ai chép đè bản dev cũ lên tài khoản đang dùng.
- `up` chạy các migration mới hơn của Flyway, rồi `wiki-prerender` tạo trang tĩnh từ dữ liệu vừa chuyển.

Sau đó:

- Provider Google dùng chính OAuth client của dev. Client đó phải có redirect URI
  `<PUBLIC_ORIGIN>/idp/realms/wikiaov/broker/google/endpoint` trong Google Cloud Console; với `https://athahub.com` thì đã có.
  Đặt `GOOGLE_LOGIN_ENABLED=true` trong `.env` rồi `docker compose up -d --wait` để Admin hiện nút Google. Tài khoản chỉ
  đăng nhập bằng Google vào lại đúng tài khoản cũ.
- Chạy `sync-account-security.ps1` như với một realm mới (xem `WIKI_SERVICE_CLIENT_SECRET` ở [Biến môi trường](#biến-môi-trường)).
- Mọi người phải đăng nhập lại: phiên đăng nhập không được chuyển. Cài đặt realm sửa tay trong console của dev cũng không.

Lúc chuyển phải giữ:

- Dev ngừng ghi từ lúc xuất. Từ đó chỉ stack ghi vào ba bucket.
- Bản diễn tập trên VPS trước ngày ra mắt là database thứ hai. Có thể xuất khi backend dev còn chạy bằng
  `-AllowRunningServices`. Khi bản diễn tập còn chạy, không xóa ảnh và không dọn bytes mồ côi ở cả hai bên; diễn tập xong thì
  bỏ database đó (`docker compose down -v`) trước khi chuyển thật.

Stack cũ còn container và volume của kho ảnh đi kèm trước đây: xem phần bổ sung ngày 17/11/2026 của ADR-021 để dọn.

## Bảo mật realm

Keycloak chỉ đọc `keycloak/wikiaov-realm.json` khi tạo realm lần đầu, nên realm đã có không tự nhận thay đổi của file. Chạy
lại sau mỗi lần file đổi phần bảo mật (an toàn khi chạy nhiều lần):

```bash
docker compose run --rm keycloak-harden
```

Luôn áp hai việc: client công khai `aov-wiki` và `aov-stream` không còn đưa role vào token (`fullScopeAllowed=false`), và chính
sách mật khẩu `length(12) and maxLength(128) and notUsername and notEmail and passwordHistory(3)` cho mật khẩu mới hoặc đổi;
mật khẩu đang có vẫn dùng được. Hai service cũng chỉ cấp quyền cho token do `admin-aov-backend` hoặc `wiki-importer` cấp
(claim `azp`), nên token của Wiki và Stream không làm được việc admin dù realm chưa chạy lệnh này.

Hai việc chỉ chạy khi bật, vì có thể chặn người đăng nhập tới khi họ làm theo:

- `REQUIRE_STAFF_OTP=true docker compose run --rm keycloak-harden`: mọi tài khoản có role `wiki-*` hoặc `community-*` chưa
  có app xác thực phải cài ở lần đăng nhập kế tiếp, tại `<PUBLIC_ORIGIN>/idp/realms/wikiaov/account`. Tới khi cài xong, form
  đăng nhập Admin báo tài khoản chưa thiết lập xong. Sau đó form Admin hỏi mã 6 số. Cài app xác thực cho chính mình trước, rồi
  mới chạy.
- `VERIFY_EMAIL=true docker compose run --rm keycloak-harden`: tài khoản mới phải xác minh email. Cần chạy `keycloak-mail`
  trước; tài khoản cũ chưa xác minh sẽ được hỏi ở lần đăng nhập kế tiếp.

## Theo dõi bản cập nhật Liên Quân

`wiki-service` đọc danh sách bài cập nhật của Garena VN, RoV TH, Garena TW và máy chủ thử nghiệm TW theo lịch của từng nguồn, mặc
định 08:00 giờ Việt Nam mỗi ngày, đổi trong Admin ở mục Theo dõi cập nhật (ADR-035). Trang tin Indonesia chỉ hiện bài sau khi
script của nó chạy, nên `page-reader` mở trang đó bằng Chromium không giao diện như trình duyệt của người xem, rồi trả lại trang
đã hiện bài. Nó chỉ mở đúng trang đó, bật trình duyệt cho từng lần đọc rồi tắt (khoảng 200 đến 300 MB trong lúc đọc), không mở
cổng ra ngoài mạng của stack và chỉ chạy trên máy chủ. Thiếu `page-reader` thì các nguồn khác vẫn chạy.

Xem lần đọc gần nhất:

```bash
docker compose logs --tail 20 page-reader
```

## Còn lại cho máy chủ thật

Những việc sau chủ dự án phải quyết định hoặc làm, repo không đoán thay:

- **Máy chủ và tên miền**: chọn nơi thuê, trỏ DNS, mở cổng 80 và 443.
- **TLS**: đặt `SITE_ADDRESS=<tên miền>`, `PUBLIC_ORIGIN=https://<tên miền>`, `PUBLIC_BIND_ADDRESS=0.0.0.0`, `HTTP_PORT=80`,
  `HTTPS_PORT=443`, `AUTH_SECURE_COOKIES=true`, bỏ `COMPOSE_PROFILES`, sinh secret mới rồi build lại. Bước này chưa chạy thử vì chưa có
  tên miền.
- **R2 cho stack này**: CORS, token R2 và token purge của VPS theo [Cloudflare R2](#cloudflare-r2). R2 đã chạy thật ở dev
  (upload, CopyObject, CDN); trên origin của stack còn phải thử một lần: tải ảnh lên trong Admin, xem ảnh qua tên miền ảnh, mở
  ảnh gốc ở trang tướng.
- **Chuyển dữ liệu dev**: các bước ở [Chuyển dữ liệu dev lên](#chuyển-dữ-liệu-dev-lên) đã chạy thử trên bản chép dữ liệu dev
  với origin loopback, chưa chạy trên VPS và chưa chạy với PowerShell 7 trên Ubuntu.
- **Sau ngày ra mắt**: máy dev không ghi vào ba bucket thật nữa. Thu hồi token R2 của máy dev hoặc đổi nó sang chỉ đọc; khi cần
  dev tiếp thì tạo bộ bucket dev nhỏ, gần như trống, với token và địa chỉ ảnh riêng.
- **Sao lưu ra ngoài máy**: mã đã có ([Bản sao ngoài máy](#bản-sao-ngoài-máy)); còn phải tạo bucket, quy tắc vòng đời và
  token trên Cloudflare rồi điền `OFFSITE_*`.
- **Email**: mã đã có ([Cảnh báo qua email](#cảnh-báo-qua-email)); còn phải tạo tài khoản Resend, xác minh tên miền và điền
  `MAIL_*`, `ALERT_EMAIL`. "Xác minh email" vẫn tắt. Đăng ký mở sẵn như realm local (`registrationAllowed`), cần quyết định có
  giữ không.
- **Đăng nhập Google**: provider `google` đi theo khi chuyển dữ liệu dev lên; đặt `GOOGLE_LOGIN_ENABLED=true`. Chưa đăng nhập
  thử qua Google trên origin thật.
- **Tài khoản thật**: tạo biên tập viên và gán vai trò trong console; bắt buộc app xác thực bằng
  [Bảo mật realm](#bảo-mật-realm).
- **CDN hoặc load balancer**: nếu đặt trước Caddy phải điền `TRUSTED_PROXIES`, nếu không giới hạn tần suất theo IP sẽ sai.
- **Theo dõi**: kiểm tra sức khỏe chạy trên chính VPS. Khi mở cổng 443 cho mọi người, thêm một dịch vụ theo dõi bên ngoài để biết
  cả khi máy tắt hẳn. Chưa gom log; log JSON chỉ xoay vòng trong Docker.
- **Tính năng chỉ có ở Vite dev**: JSON storage của Admin cần dev server, nên bản build trả 404 cho nó.
- **Content-Security-Policy** đặt trong `proxy/Caddyfile` cho mọi đường dẫn trừ `/idp/`: script chỉ từ chính trang và API
  player của YouTube (`www.youtube.com`, `s.ytimg.com`) cho trình phát của Stream và Admin; ảnh, video và `connect-src` nhận
  mọi nguồn `https:` (tên miền ảnh, endpoint R2 cho ảnh đối chứng qua URL ký sẵn, upload, manifest tệp nguồn); iframe chỉ
  YouTube (gồm `www.youtube-nocookie.com`), Twitch, Facebook, TikTok. Thêm nhúng mới hay script ngoài thì sửa chính sách ở
  đó. `Referrer-Policy: strict-origin-when-cross-origin` cũng nằm ở đó và phải giữ, nếu không YouTube trả lỗi 153. Nếu bật
  proxy Cloudflare, các tính năng chèn script như Web Analytics, Rocket Loader hay Email Obfuscation sẽ bị chặn.
