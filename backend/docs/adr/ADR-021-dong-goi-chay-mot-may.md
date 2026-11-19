# ADR-021 — Đóng gói toàn hệ thống trên một máy và các đường dẫn proxy bổ sung

**Trạng thái:** Chấp nhận, cùng [bổ sung 17/11/2026](#bổ-sung-17112026-object-storage-là-cloudflare-r2),
[bổ sung 18/11/2026](#bổ-sung-18112026-cập-nhật-không-gián-đoạn),
[bổ sung 19/11/2026](#bổ-sung-19112026-việc-chạy-theo-lịch) và
[bổ sung 19/11/2026 về cảnh báo và backup ngoài máy](#bổ-sung-19112026-cảnh-báo-qua-email-backup-ngoài-máy-mail-của-keycloak),
mỗi bổ sung được người dùng duyệt cùng ngày
**Ngày:** 2026-11-07
**Phạm vi:** `infra/`, `wiki-service`, `community-service`, `aov-stream`

## Bối cảnh

Đặc tả 01 mục 3.3, 3.4, 3.6 định nghĩa reverse proxy theo tiền tố `/`, `/stream/`, `/admin/`, `/api/wiki/**`,
`/api/community/**`, `/media/**`. Khi đóng gói để chạy như production trên một máy, có ba chỗ đặc tả chưa quyết định:

1. Keycloak nằm ở đâu. `/auth/callback` đã là route của các app nên không dùng được `/auth/`; chưa có tên miền nên
   cũng chưa có `auth.<domain>`.
2. Backend gọi Keycloak và object storage bằng địa chỉ trong mạng Compose (`keycloak:8080`, `seaweedfs:8333`), trong khi
   trình duyệt và JWT cần địa chỉ công khai. Trước đây `wiki-service` chỉ có một địa chỉ cho mỗi bên.
3. Trình duyệt tải ảnh lên bằng presigned URL (ADR-006). Local dùng cổng S3 riêng và CORS; production một máy chưa có
   đường nào như vậy.

## Quyết định

- **Keycloak ở `/idp/`, cùng origin**, không rewrite (`KC_HTTP_RELATIVE_PATH=/idp`). Proxy chỉ mở `/idp/realms/*` và
  `/idp/resources/*`, chặn realm `master`. Console quản trị chỉ nghe trên `127.0.0.1:<KEYCLOAK_ADMIN_PORT>`.
- **Tách địa chỉ công khai và địa chỉ nội bộ bằng cấu hình.** `wiki.auth.identity-backchannel-uri`
  (`JWT_BACKCHANNEL_ISSUER_URI`) cho token/revoke qua mạng nội bộ, JWKS đặt qua `jwk-set-uri` chuẩn của Spring; issuer trong
  token và URL đưa trình duyệt đi vẫn là địa chỉ công khai. `wiki.storage.public-endpoint` (`STORAGE_PUBLIC_ENDPOINT`) chỉ dùng
  cho presigned URL. Bỏ trống thì mọi thứ như cũ, local không đổi.
- **Kiểm tra media với `community-service` được dùng HTTP tới tên service nội bộ** (không có dấu chấm), ngoài HTTPS và loopback,
  vì request này mang token của người gọi. Host công khai qua HTTP vẫn bị từ chối.
- **Presigned upload đi qua proxy cùng origin**, tại đường dẫn path-style `/{bucket}/*`, chỉ khi có `X-Amz-Signature`. Không
  rewrite và giữ nguyên `Host` nên chữ ký S3 vẫn đúng; không cần CORS và không cần thêm cổng. Bucket vẫn đóng với request
  không có chữ ký, nên quy tắc "chỉ mở `assets/`, `incoming/` không public" của 01 mục 3.6 vẫn giữ: đường này không đọc được
  gì nếu `wiki-service` chưa ký. Khi dùng dịch vụ S3 có sẵn, đặt `STORAGE_PUBLIC_ENDPOINT` về endpoint đó và đường này
  không còn được dùng. *Đã bỏ cùng đường `/media/**` ngày 17/11/2026, xem phần bổ sung.*
- **Service tin `X-Forwarded-*` ở profile `prod`** (`server.forward-headers-strategy: native`). Chỉ proxy tới được cổng service,
  proxy luôn ghi đè các header này. Nếu không, mọi người dùng có cùng IP là IP của proxy và giới hạn đăng nhập theo IP của
  ADR-007 trở thành giới hạn chung cho toàn hệ thống.
- **Caddy kèm module `caddy-ratelimit`**, vì ADR-007 và 01 mục 3.3 yêu cầu giới hạn tần suất tại proxy mà Caddy gốc không có.
  Chỉ giới hạn các đường đăng nhập và form liên hệ theo IP, không giới hạn đọc wiki để tránh chặn nhầm người dùng chung IP.
- **Không thêm dịch vụ chạy nền.** Backup và khởi tạo bucket là container chạy một lần rồi thoát (`preflight`, `db-backup`,
  `storage-init`, `media-*`). `rclone` được chọn cho media vì đi qua API S3, dùng được cho cả SeaweedFS và R2.
  *Từ 17/11/2026 không còn `storage-init`; `media-*` chép R2, xem phần bổ sung.*
- **`AUTH_SECURE_COOKIES`** mặc định `true`. Chỉ origin HTTP loopback mới được đặt `false`; `preflight` từ chối mọi origin khác.

## Hệ quả

- Backup trước khi migrate tự động: mỗi lần `docker compose up`, `db-backup` chạy xong thì service mới khởi động và Flyway
  mới chạy.
- Đổi `PUBLIC_ORIGIN` cần build lại frontend và cập nhật realm đã import, vì import realm chỉ chạy một lần.
- Frontend biên dịch sẵn địa chỉ công khai nên một image proxy chỉ dành cho một origin.
- Realm production (`infra/keycloak/wikiaov-realm.json`) tách khỏi realm local. Thêm role hoặc client phải sửa cả hai file.
- Nếu đặt CDN hoặc load balancer trước Caddy phải khai báo `trusted_proxies`, nếu không IP thật bị mất.

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Keycloak ở subdomain riêng | Chưa có tên miền; vẫn có thể chuyển sau bằng cấu hình và build lại frontend |
| Network alias để service gọi Keycloak qua địa chỉ công khai | Không dùng được với `localhost`, và đẩy traffic nội bộ qua proxy cùng giới hạn tần suất |
| Mở cổng S3 riêng cho trình duyệt | Thêm cổng cần TLS và CORS trong khi cùng origin đã đủ |
| Nginx (có sẵn `limit_req`) | Mất tự cấp TLS, vốn là lý do 01 mục 3.4 chọn Caddy |
| Tar volume SeaweedFS để backup media | Phụ thuộc định dạng nội bộ, phải dừng storage khi chép, không dùng được cho R2 |

## Bổ sung 17/11/2026: object storage là Cloudflare R2

### Bối cảnh

- ADR-030 mục 14 cho dev dùng thẳng R2 và để lại stack này: "Chuyển stack đó sang R2 là việc riêng".
- Dev và production đã dùng R2, ảnh công khai qua `img.athahub.com` (ADR-014). Stack vẫn chạy SeaweedFS riêng, tốn RAM và
  đĩa trên VPS 8 GB, và là một kho ảnh không khớp với kho thật.
- Proxy còn hai đường cho SeaweedFS: `/media/*` đọc ảnh, `/{bucket}/*` cho presigned URL. Stack chưa có
  `STORAGE_SOURCES_BUCKET` nên các màn ảnh đối chứng của Admin không có dữ liệu.
- Người dùng quyết định ngày 17/11/2026: khi ra mắt, database dev chuyển lên VPS và trở thành dữ liệu thật. Không tạo bộ bucket
  mới cho VPS. Sau ngày ra mắt máy dev không ghi vào các bucket thật nữa; dev tiếp sẽ dùng một bộ bucket dev nhỏ, tạo sau.

### Quyết định

1. **Bỏ `seaweedfs`, `storage-init` và volume `seaweedfs-data`.** Stack không tạo bucket và không ghi CORS. Bucket, tên miền
   ảnh và cache rule đã có từ dev; token và CORS cho VPS được làm trên Cloudflare (ADR-014, ADR-030). `rclone` đặt
   `no_check_bucket`, nên cũng không thử tạo bucket.
2. **Proxy không còn đường nào tới object storage.** Ảnh công khai đi thẳng từ `https://img.<domain>/assets/...`
   (`MEDIA_PUBLIC_BASE_URL`). Trình duyệt PUT vào `incoming/` và GET `sources/` thẳng trên endpoint R2 bằng presigned URL.
   `STORAGE_PUBLIC_ENDPOINT` để trống thì URL ký sẵn dùng `STORAGE_ENDPOINT`, mà trình duyệt cũng tới được. Vì khác
   origin, bucket riêng tư và bucket tệp nguồn cần CORS cho `PUBLIC_ORIGIN`. Bỏ luôn bộ lọc `X-Amz-*` trong log, vì không
   request ký sẵn nào còn đi qua Caddy.
3. **Cấu hình R2 bắt buộc trên mọi origin, do `preflight` kiểm tra.** Trong `compose.yaml` các biến R2 mặc định rỗng
   thay vì `:?`, để `preflight` liệt kê cùng lúc mọi chỗ sai thay vì Compose dừng ở biến đầu tiên:
   - thiếu biến hoặc còn giá trị mẫu (giá trị mẫu viết trong ngoặc nhọn);
   - endpoint không phải HTTPS;
   - `MEDIA_PUBLIC_BASE_URL` không có dạng `https://…/assets`;
   - bucket ảnh công khai trùng bucket riêng tư hoặc bucket tệp nguồn, tức là sẽ công khai upload đang chờ hoặc tệp nguồn;
   - purge bật mà thiếu zone ID 32 ký tự hex hoặc token.

   Không thành phần nào khởi động khi còn lỗi. `MEDIA_CLOUDFLARE_PURGE_ENABLED=false` vẫn được chạy, với lời nhắc rằng Admin
   sẽ từ chối xóa ảnh.
4. **Sao lưu: giữ `media-backup` và `media-restore`, chép R2 ra đĩa của máy chạy stack bằng rclone.** Lý do:
   - 02 mục 41 bắt buộc backup cả object storage: database khôi phục mà thiếu bytes thì hệ thống không trọn.
   - R2 bền trước hỏng phần cứng, nhưng không giữ lại object đã bị xóa. Có nhiều cách xóa: xóa vĩnh viễn ảnh trong Admin, dọn
     bytes mồ côi, lifecycle rule đặt nhầm, token bị lộ, xóa bucket, mất tài khoản Cloudflare.
   - `assets/` không bao giờ bị ghi đè, nhưng vẫn bị xóa. Khôi phục một bản dump cũ hơn lần xóa ảnh thì cần lại đúng bytes
     đó, nên backup chỉ thêm, không bao giờ bớt.
   - `sources/` là bản gốc riêng tư. Từ khi `resources/` rời git, ngoài R2 chỉ còn bản cục bộ trên máy phát triển, mà người
     dùng có thể xóa.
   - Chi phí nhỏ. Container chạy một lần, không tốn RAM khi nghỉ. Đĩa bằng tổng ba bucket, khoảng 4,4 GB. Mỗi lần chạy chỉ
     tốn khoảng một thao tác lớp A cho mỗi 1.000 key (`--fast-list`), cộng GetObject cho object mới. Tải ra khỏi R2 không
     tính phí.
5. **Cách chép.**
   - Backup bỏ `incoming/`, dùng `--ignore-existing`: key không bao giờ bị ghi lại, nên tệp đã có thì không đọc lại.
   - Restore cũng `--ignore-existing`: chỉ đưa lên key mà bucket còn thiếu, không ghi đè và không xóa.
   - `assets/` lấy Content-Type theo đuôi tệp, kèm `Cache-Control` bất biến công khai như `MediaIngestion`.
   - `sources/<sha256>` không có đuôi. Khi backup, mỗi tệp nguồn mới được HEAD một lần để ghi Content-Type vào
     `backups/media/<bucket>.types`. Restore đưa lên theo từng nhóm Content-Type, với `Cache-Control` riêng tư như
     `SourceUploads`. Tệp chưa có dòng trong danh sách vẫn được đưa lên, dạng `application/octet-stream`, kèm cảnh báo.
   - ListObjects là thao tác lớp A. ADR-030 mục 2 và 9 cấm ứng dụng liệt kê object; công cụ vận hành ngoài ứng dụng thì
     vẫn được dùng, như ADR này đã chọn rclone từ đầu.
6. **Stack nhận lại database và bucket của dev.** Stack dùng luôn `aov-media-private`, `aov-media-assets`,
   `aov-source-private` và `img.athahub.com`; `.env.example` ghi sẵn các tên này. Database dev đi theo bản dump, còn bytes
   nằm nguyên trên bucket nên không chép object nào. Việc trên Cloudflare chỉ còn:
   - thêm origin thật vào CORS của `aov-media-private` và `aov-source-private`, giữ các origin `localhost`;
   - một R2 API token mới chỉ dành cho VPS, Object Read & Write trên đúng ba bucket, để thu hồi token của máy dev không làm
     VPS mất quyền;
   - một token Cache Purge trên zone `athahub.com`.
7. **Một database, một bộ bucket.** Hai database dùng chung bucket không ghi đè nhau, vì key ảnh là UUID, nhưng vẫn xóa
   được của nhau: tệp nguồn lưu theo SHA-256, và database chép từ database kia trỏ tới cùng object. Với quyết định 6, ba
   bucket thật luôn chỉ có một database dùng: database dev tới ngày chuyển, database của stack từ đó. Quy tắc áp dụng khi có
   database thứ hai: dev trên máy sau ngày ra mắt, stack chạy thử với database trống, một bản diễn tập chuyển dữ liệu. Database
   đó cần bộ bucket, token và địa chỉ ảnh riêng. Riêng bản diễn tập trên bucket thật thì khi nó còn chạy, không xóa ảnh và
   không dọn bytes mồ côi ở cả hai bên, và database diễn tập bị bỏ trước khi chuyển thật.
8. **Chuyển dev lên bằng ba công cụ** (các bước ở mục "Chuyển dữ liệu dev lên" của `infra/README.md`):
   - `backend/wiki-service/scripts/dev/export-for-stack.ps1` trên máy dev: `pg_dump` hai database, và xuất người dùng của
     realm bằng `kc.sh export` chạy trên bản chép của volume Keycloak, vì Keycloak mở file H2 để ghi. Script dừng khi Keycloak
     dev còn chạy, khi backend dev còn trả lời, hoặc khi database có migration mà checkout không có.
   - `dev-import` trên VPS: khôi phục `wiki`, `community`, rồi đổi mọi issuer kết thúc bằng `/realms/wikiaov` sang issuer
     của stack. Các trigger bất biến của bản đã xuất bản và nhật ký chặn mọi UPDATE; đổi issuer không đổi nội dung, nên riêng
     transaction đó chạy với `session_replication_role = replica`. Không khóa ngoại nào chứa cột issuer.
   - Provider Google là cài đặt làm tay duy nhất của realm dev cần mang theo (so realm dev với bản import mới của realm local:
     ngoài nó chỉ có khác biệt về thứ tự, giá trị `localhost` và cài đặt mà realm mẫu đã có). Script xuất chỉ lấy
     `identityProviders` ra khỏi file realm, không mang secret của client nào khác; `dev-users-import` thêm nó với `SKIP`,
     nên provider đã cấu hình trên stack được giữ. Dùng lại OAuth client của dev, vốn đã có redirect URI của `athahub.com`.
   - `dev-users-import` trên VPS: `partialImport` của Keycloak với `OVERWRITE` thêm người dùng với nguyên ID, mật khẩu đã băm,
     vai trò và liên kết Google, và thay `service-account-wiki-importer` của realm mẫu bằng bản dev. Realm vẫn là realm mẫu:
     realm dev mang redirect URI `localhost`, các client chỉ có ở dev và secret của dev. Lệnh từ chối realm đã có người dùng,
     và khóa `admin`, `editor`, `publisher`, vì mật khẩu của chúng nằm trong realm local của repo công khai.
9. **Không đổi:** test Testcontainers và profile `local-storage` trong `backend/wiki-service/compose.yaml` vẫn dùng SeaweedFS
   (ADR-030 mục 14).

### Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Bỏ hẳn sao lưu media, tin vào độ bền của R2 | Trái 02 mục 41; độ bền không chống được xóa nhầm, token lộ hay mất tài khoản; bản dump cũ có thể trỏ tới bytes đã xóa |
| Chỉ sao lưu `sources/` | Ảnh tải lên qua Admin sau đợt nhập (logo đội, avatar, ảnh mới) chỉ có trên R2; thêm khoảng 1 GB đĩa là rẻ |
| Chép sang bucket thứ hai trong cùng tài khoản | Không chống được mất tài khoản hay token có quyền trên cả hai; ăn vào mức miễn phí 10 GB |
| Giữ Content-Type bằng `rclone --metadata` (xattr) | Mất khi chép thư mục backup sang máy khác bằng công cụ thường; bind mount của Docker Desktop trên Windows không có xattr |
| Lấy Content-Type từ database khi khôi phục | Cần cả psql và rclone trong một bước, và phải chép lại quy tắc thêm `charset` của backend |
| Giữ SeaweedFS trong stack | Đúng thứ cần bỏ: tốn RAM và đĩa trên VPS, và là kho ảnh tách khỏi kho thật |
| Realm mới, tạo lại tài khoản bằng tay | Nội dung mất tác giả: trong bản chép dev, 474 bản sửa tướng thuộc bốn tài khoản và service account nhập dữ liệu; hồ sơ và đội hình không còn chủ |
| Nhập nguyên realm dev | Mang theo redirect URI `localhost`, client chỉ dành cho dev (`admin-aov`, `wiki-local-cli`) và secret của dev, phải sửa tay từng chỗ |
| Để backend chấp nhận cả issuer dev | Sửa code để giữ mãi hai danh tính cho một người; issuer của dev là địa chỉ `localhost` không còn ai phát token |
| Bộ bucket mới cho VPS, chép object của dev sang | Hai bộ cùng nội dung, khoảng 4,4 GB mỗi bộ, gần chạm mức miễn phí 10 GB; thêm một lần chép chưa thử. Database dev chuyển lên nên bộ bucket thật vẫn chỉ có một database dùng |

### Hệ quả

- Stack cần mạng và tài khoản Cloudflare để chạy. Làm việc không có mạng thì dùng dev với profile `local-storage`.
- Lúc chuyển, dev ngừng ghi từ lúc xuất.
- Phiên đăng nhập và cài đặt realm sửa tay ở dev không được chuyển; mọi người đăng nhập lại, `sync-account-security.ps1` chạy
  lại như với realm mới.
- Tài khoản chỉ đăng nhập bằng Google dùng provider `google` chuyển từ dev; `GOOGLE_LOGIN_ENABLED=true` bật nút ở Admin.
- Mục nhật ký cài đặt tài khoản (ADR-028) dùng mã tính từ issuer và subject (`AccountCaller.accountId`); mục ghi ở dev giữ mã
  cũ, nên lịch sử cài đặt của một tài khoản tách làm hai đoạn.
- Issuer của stack được khai báo một lần (`x-public-issuer` trong `compose.yaml`) cho `wiki-service`, `community-service`
  và `dev-import`.
- Vào ngày ra mắt, token R2 của máy dev bị thu hồi hoặc đổi sang chỉ đọc.
- Đổi `PUBLIC_ORIGIN` phải đổi cả CORS của hai bucket riêng tư trên Cloudflare.
- Khi bật Content-Security-Policy phải cho phép endpoint R2 (`connect-src`, `img-src`) và tên miền ảnh (`img-src`). Hiện chưa
  có CSP nào nên không có gì chặn.
- Bản chép media nằm cùng máy với stack: giữ được dữ liệu khi R2 mất object, không giữ được khi mất máy. Sao lưu ra ngoài
  máy vẫn là việc còn mở.
- **Stack đã chạy bản cũ:** container `seaweedfs`, `storage-init` và volume `<project>_seaweedfs-data` còn lại sau khi cập
  nhật. Stack chưa từng chạy với dữ liệu thật, nên ảnh trong volume đó chỉ là ảnh thử. Không đưa chúng lên bucket thật: không
  database nào sẽ tham chiếu tới chúng. `docker compose up -d --wait --remove-orphans` bỏ hai container cũ;
  `docker volume rm <project>_seaweedfs-data` xóa volume.

### Kiểm chứng (17/11/2026)

- `docker compose config` hợp lệ với `.env.example`; `infra/` không còn chữ "seaweed" nào.
- `preflight` với chín bộ `.env`: liệt kê đủ 9 biến của file mẫu; báo đúng biến thiếu, sai định dạng, bucket trùng, cờ
  purge sai; qua khi đủ giá trị. Bản cũ hỏng trên mọi origin công khai vì không nhận `WIKI_SERVICE_CLIENT_SECRET`; đã sửa.
- `media.sh` với một S3 tạm chạy riêng, ngoài stack:
  - backup bỏ `incoming/`, chạy lại không tải gì, lần sau chỉ tải và HEAD tệp mới;
  - restore với backup chỉ đọc đưa lại object đã xóa với đúng Content-Type và `Cache-Control`, không ghi đè object đã đổi;
  - tệp không rõ loại lên dạng `application/octet-stream`; chạy lại không đưa lên gì.
- Stack chạy với tên project riêng và R2 giả (tên miền `.invalid`, không gửi gì tới Cloudflare): mọi thành phần healthy
  khi không có kho ảnh đi kèm.
  - `/media/...` trả 404; đường `/{bucket}/...?X-Amz-Signature=...` không còn tới storage.
  - URL upload backend cấp trỏ thẳng `https://<endpoint>/<bucket riêng tư>/incoming/...`.
  - `media-backup` gọi đúng endpoint và thoát mã lỗi khi không tới được; thiếu biến bucket thì báo tên biến.
- Chưa thử với R2 thật: upload từ origin của stack, CORS, ảnh qua CDN, `media-backup` và `media-restore` trên bucket thật.
- Sau quyết định 6: `preflight` với `.env.example` mới chỉ còn báo năm giá trị phải điền (endpoint, hai khóa, Zone ID, token
  purge). Volume `keycloak-data` của dev, mở ở chế độ chỉ đọc, giữ realm trong `h2/keycloakdb.mv.db`.
- Chuyển dev lên, trên bản chép của hai volume dev (PostgreSQL và Keycloak, chép ở chế độ chỉ đọc; dev không chạy và không bị
  đụng tới), vào một stack riêng với origin loopback và R2 giả:
  - `export-for-stack.ps1` trên Windows PowerShell 5.1: hai bản dump, 4 tài khoản và 1 service account; dừng đúng khi Keycloak
    dev còn chạy, khi cổng 8082 có tiến trình nghe, và khi database có một migration giả mà checkout không có.
  - `dev-import`: lần đầu dừng ở trigger bất biến của `arcana_revision`, đã sửa như quyết định 8. Sau đó đổi 75.070 giá trị
    trong 58 cột; không cột text hay jsonb nào còn chứa `localhost:8081`; `local-maintenance` và `urn:wikiaov:migration`
    giữ nguyên.
  - `dev-users-import`: 4 thêm, 1 ghi đè; ID trùng với bản xuất; liên kết `google` nằm trong database Keycloak; ba tài khoản
    thử bị khóa; chạy lần hai bị từ chối.
  - `up`: Flyway áp V072, V073 trên dữ liệu dev, mọi thành phần healthy, `wiki-prerender` tạo 786 trang. Token
    `client_credentials` của `wiki-importer` có `sub` của dev và issuer của stack, gọi API admin được (200). Tài khoản
    `editor`, mở khóa tạm, đăng nhập bằng mật khẩu của realm local: `sub` của dev, `/users/me` trả 200; khóa lại sau đó.
  - Lần chạy thứ hai, với Postgres của bản chép không mở cổng nào: script xuất chạy được cả khi stderr bị chuyển hướng (lần
    đầu dừng vì Windows PowerShell coi dòng tiến trình của docker là lỗi, đã sửa); provider `google` được thêm (client ID
    trùng với dev, secret có), liên kết `google` của tài khoản hiện ra.
  - Chưa thử: chạy trên VPS, `pwsh` trên Ubuntu, đăng nhập Google thật.

## Bổ sung 18/11/2026: cập nhật không gián đoạn

### Bối cảnh

- Stack chạy thật trên VPS từ 18/11/2026. Mỗi lần cập nhật, image được build ngay trên VPS (3–5 phút, giành CPU với site), rồi
  `up` tạo lại container: API mất 1–2 phút, Keycloak khoảng 1 phút, proxy vài giây.
- Stream và Admin nằm trong image Caddy, cấu hình Caddy cũng đóng sẵn trong image (`admin off`), nên sửa một dòng giao diện
  hay một route cũng phải thay container proxy.
- Job prerender của Wiki đã thay site trong volume theo thứ tự file mới trước, file cũ sau (ADR-022), nhưng xóa bundle cũ
  ngay. Tab đang mở mà tải thêm một chunk sau đó sẽ lỗi.
- Người dùng yêu cầu ngày 18/11/2026: khi `main` có commit mới thì VPS tự lấy về; bản mới chỉ nhận traffic khi đã ổn định, bản
  cũ chạy tới lúc đó rồi mới tắt.

### Quyết định

1. **Kích hoạt.** Trên VPS, systemd timer `aov-deploy.timer` (`infra/systemd/`) chạy `infra/scripts/deploy.sh` năm phút một
   lần.
   - Script lấy `origin/main` và chỉ triển khai khi mọi check run GitHub giữ cho commit đó đã xong và đạt (`success`,
     `skipped`, `neutral`). Repo công khai nên đọc API không cần token, VPS không giữ khóa GitHub nào.
   - Commit lỗi được ghi vào `infra/.deploy/rejected` và timer không thử lại; commit mới hơn hoặc chạy tay thì có.
   - Timer chỉ đi tới: commit của `main` phải nối tiếp commit đang chạy. `main` bị viết lại lịch sử, hoặc máy chủ đang chạy
     một commit chưa vào `main`, thì timer không làm gì; quay lui là việc chạy tay.
   - `deploy.sh <commit>` triển khai một commit bất kỳ, kể cả để quay lui. `deploy.sh --refresh` chạy lại các bước không gián
     đoạn trên commit đang chạy, dùng sau khi đổi `.env`.
2. **Image.** Workflow `images.yml` build năm image (`wiki-service`, `community-service`, `keycloak`, `reverse-proxy`, `web`)
   cho mỗi commit của `main` và đẩy lên GHCR với tag là SHA.
   - VPS tải image về rồi gắn lại tên `aov/<image>:local` mà Compose dùng, nên `docker compose` gõ tay vẫn chạy đúng bản đang
     chạy.
   - Không tải được (package còn private, workflow chưa xong) thì build ngay trên VPS, trong lúc container cũ vẫn phục vụ.
3. **Backend: chạy song song rồi mới đổi.** Với `wiki-service` và `community-service`:
   - script nhân đôi số container (`up --no-recreate --scale`); container cũ giữ image cũ;
   - container mới phải healthy và trả lời được một API công khai thì container cũ mới dừng. `stop_grace_period: 40s` để
     Spring trả nốt các request đang chạy;
   - container mới hỏng thì bị xóa, container cũ không bị đụng tới.

   Caddy tìm backend theo tên service bằng DNS của Docker (`dynamic a`, làm mới mỗi giây), nên thấy cả container cũ lẫn mới.
   Request không kết nối được tới một container (container đó đang tắt) được thử ở container kia, trong tối đa 10 giây.
4. **Frontend ra khỏi image Caddy.** Image `web` chứa bản build của ba app và chạy hai job một lần:
   - `web-publish` đưa Stream và Admin vào volume `web-apps`;
   - `wiki-prerender` đưa Wiki vào `wiki-site` như trước.

   Cả hai dùng chung `publishSite`: file mới trước, file cũ sau, mỗi file thay bằng đổi tên. Bundle của bản đang chạy được
   giữ thêm một lần phát hành (danh sách trong `.published-bundle.json`), bundle cũ hơn mới bị xóa, nên tab đang mở vẫn tải được
   chunk của nó. Đây là chỗ duy nhất đổi quy tắc "thay toàn bộ nội dung volume" của ADR-022. *Từ 19/11/2026, đưa lại cùng
   bản cũng không xóa bundle đó, xem bổ sung 19/11/2026.*
5. **Caddy.**
   - Image chỉ còn Caddy và module rate limit. Compose mount thư mục `infra/proxy` vào `/etc/caddy`: mount thư mục chứ không
     mount file, vì git thay file khi checkout, mà mount một file thì vẫn giữ file cũ.
   - Caddyfile mới được kiểm tra (`caddy validate`) rồi áp bằng `caddy reload`, không tạo lại container. Admin API của Caddy
     nghe ở `localhost:2019` trong container và không mở cổng nào. CI cũng kiểm tra Caddyfile bằng đúng image đó.
   - Container proxy chỉ được thay khi `infra/proxy/Dockerfile` đổi. Khi đó request dừng vài giây.
6. **Keycloak không chạy song song**, vì chỉ có một instance với cache cục bộ và cổng quản trị cố định. Nó chỉ được tạo lại
   khi file của nó đổi (`infra/keycloak/` và các theme). Keycloak 26 lưu phiên đăng nhập trong database nên không ai bị đăng
   xuất; chỉ có khoảng một phút không đăng nhập mới được.
7. **Migration phải để bản cũ chạy được.** Trong lúc chuyển, hai bản cùng chạy trên schema mới.
   - Được: thêm bảng, thêm cột cho phép null hoặc có giá trị mặc định.
   - Phải tách làm hai lần phát hành (thêm trước, bỏ sau khi bản cũ không còn chạy): xóa hoặc đổi tên cột, bảng; thêm ràng
     buộc mà code cũ có thể vi phạm.

   `db-backup` chạy trước khi container mới khởi động, như với `up`.
8. **Thứ tự:** lấy image, `preflight`, `db-backup`, `community-service`, `wiki-service`, `web-publish`, `wiki-prerender`,
   Caddy, Keycloak, rồi các service khác khi `compose.yaml` đổi. Backend đi trước để trang mới không gọi API chưa có. Cuối
   cùng script gọi các địa chỉ công khai qua Caddy ngay trên máy đó.

### Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Blue/green: hai bộ service tên riêng, đổi upstream trong Caddyfile | Gấp đôi khai báo trong `compose.yaml` và sửa Caddyfile mỗi lần; nhân đôi container tạm thời cho cùng kết quả với một khai báo |
| Plugin `docker rollout` | Thêm phụ thuộc ngoài cho việc vài dòng shell làm được; không lo Keycloak, frontend, backup |
| GitHub Actions SSH vào VPS để triển khai | VPS phải mở SSH cho GitHub, repo công khai phải giữ khóa SSH; timer tự kéo về không cần khóa nào |
| Watchtower tự cập nhật image | Không chờ healthy trước khi tắt bản cũ, không có thứ tự backend trước frontend, không backup trước migration |
| Kubernetes hoặc Docker Swarm | Quá nặng cho một máy 8 GB; AGENTS.md cấm thêm Kubernetes khi chưa có ADR riêng |
| Hai Keycloak chạy song song | Cần cluster cache Infinispan; một phút không đăng nhập mới, chỉ khi Keycloak đổi, là chấp nhận được |

### Hệ quả

- Merge vào `main` là phát hành: commit nào CI xanh cũng lên VPS trong vòng vài phút sau khi image build xong.
- Đổi `.env` vẫn làm tay: `deploy.sh --refresh` cho backend, frontend và Caddyfile; `docker compose up -d --wait` cho phần
  còn lại.
- Package GHCR phải công khai (hoặc VPS đăng nhập GHCR) thì VPS mới tải được image; chưa được thì VPS build như trước.
- Trong lúc chuyển, máy dùng thêm bộ nhớ của một container backend (tối đa 1,5 GB).
- Hai job định kỳ có thể chạy cùng lúc ở hai bản: job nhập tướng khóa từng dòng bằng `FOR UPDATE SKIP LOCKED`, job tỷ giá chạy
  hai lần thì vô hại.
- Image `web` trên GHCR chỉ dành cho một origin (biến repo `STACK_PUBLIC_ORIGIN`, mặc định `https://athahub.com`), vì frontend
  biên dịch sẵn địa chỉ.
- Lần đầu chuyển sang cách này, container proxy được thay một lần.

### Kiểm chứng (18/11/2026)

- `docker compose config` hợp lệ với `.env.example`; shellcheck không báo gì với `deploy.sh`. Caddyfile hợp lệ với image Caddy
  mới, và `caddy adapt` cho thấy upstream động của hai backend với `try_duration` 10 giây.
- Test của Wiki: bundle của bản đang chạy còn sau một lần đưa ra và mất ở lần sau; site cũ chưa có danh sách giữ bundle của nó
  một lần; trang gỡ xuất bản và bundle cũ hơn bị xóa.
- Trên VPS, với dữ liệu thật, một máy đo từ ngoài gọi `/`, `/admin/`, `/api/wiki/v1/regions` và một API công khai của
  community-service khoảng mỗi giây trong lúc cập nhật:
  - Lần chuyển sang cách mới (commit có cả `compose.yaml` và `proxy/Dockerfile` đổi, image build trên VPS vì GHCR chưa có): 309
    giây; hai backend đổi xong mà không request nào lỗi; đúng 1 request lỗi lúc thay container Caddy, như mục 5 đã tính.
  - `deploy.sh --refresh` (hai backend, `web-publish`, `wiki-prerender`, reload Caddyfile): 138 giây, 285 request, không lỗi
    nào. Container Caddy và Keycloak không bị khởi động lại.
- Chưa thử: tải image từ GHCR (chưa có commit nào của `main` có workflow `images.yml`), timer tự triển khai một commit của `main`,
  một commit có migration thật trong lúc hai bản cùng chạy, và đổi Keycloak.

## Bổ sung 19/11/2026: việc chạy theo lịch

### Bối cảnh

- `wiki-prerender` chỉ chạy khi một lần cập nhật đổi frontend hoặc `wiki-service`. Nội dung xuất bản trong Admin giữa hai lần
  cập nhật không có trang riêng và không có dòng trong `sitemap.xml`: địa chỉ của nó rơi về `200.html` có `noindex`, bản xem
  trước liên kết (Facebook, Zalo, Discord) hiện tiêu đề trang chủ. ADR-022 để tần suất làm mới cho người vận hành.
- `db-backup` chỉ chạy trước những lần cập nhật đổi backend. Ngày không cập nhật thì không có bản dump nào; `infra/README.md`
  mới gợi ý một dòng cron, VPS chưa đặt. `media-backup` chưa chạy lần nào trên VPS.
- `publishSite` chạy lại trên cùng bản (cùng bundle) thì xóa bundle của bản trước, vì danh sách `.published-bundle.json` lúc đó
  đã là bundle hiện tại. Quyết định 4 của bổ sung 18/11/2026 hứa giữ bundle đó thêm một lần phát hành. Tới nay việc này chỉ xảy
  ra khi một lần cập nhật chỉ đổi `wiki-service`; có lịch chạy lại thì nó xảy ra sau mỗi lần phát hành.
- Người dùng yêu cầu ngày 19/11/2026 làm nốt những phần triển khai còn thiếu.

### Quyết định

1. **Hai timer systemd mới** trong `infra/systemd/`, cùng gọi `infra/scripts/scheduled.sh`:
   - `aov-wiki-pages.timer`, 15 phút một lần: `scheduled.sh pages` chạy `wiki-prerender` trên bản đang chạy. Lỗi thì site giữ
     trang cũ, như ADR-022 quy định cho cùng bản.
   - `aov-backup.timer`, mỗi ngày lúc 03:00 giờ Việt Nam: `scheduled.sh backup` chạy `db-backup` với nhãn `daily` (giữ
     `BACKUP_KEEP` bản mới nhất, riêng với nhãn `auto`), rồi `media-backup`. Database đi trước, để mọi object mà bản dump nhắc
     tới đều có trong bản chép ngay sau đó. `Persistent=true`: máy tắt lúc 03:00 thì việc chạy khi máy bật lại.
2. **Chung khóa với `deploy.sh`** (`infra/.deploy/lock`), nên không việc nào chạy giữa một lần cập nhật:
   - `pages` gặp khóa đang bị giữ thì bỏ lượt đó, vì lần cập nhật tự chạy prerender.
   - `backup` chờ khóa tối đa một giờ rồi mới dump, để không dump trong lúc Flyway đang migrate. Khóa được nhả trước
     `media-backup`, vì việc chép R2 không đụng tới stack và lần đầu có thể kéo dài.
   - `deploy.sh` gặp khóa đang bị giữ thì như trước, bỏ lượt và thử lại sau năm phút.
3. **`pages` chỉ chạy khi checkout nằm đúng ở commit đang chạy** (`infra/.deploy/deployed`). Một lần cập nhật dừng giữa chừng
   có thể đã gắn tên `aov/web:local` cho image của commit mới. Job của image đó sẽ coi đây là bản mới và đưa bundle mới ra
   trước backend mới (ADR-022, bổ sung 19/11/2026), nên script dừng với mã lỗi và chờ một lần cập nhật thành công.
4. **`publishSite` giữ bundle của bản trước khi đưa lại cùng bản.** Bản build trùng bundle đang phục vụ thì mọi file bundle đang
   có trên site được giữ (bundle hiện tại cùng bundle của bản trước). Lần phát hành bản khác kế tiếp mới xóa bundle cũ hơn, như
   quyết định 4 của bổ sung 18/11/2026.
5. Kết quả xem bằng `journalctl -u aov-wiki-pages.service` và `journalctl -u aov-backup.service`; lỗi hiện trong
   `systemctl --failed`. Chưa có cảnh báo gửi đi đâu: việc theo dõi vẫn để mở như mục "Còn lại cho máy chủ thật" của
   `infra/README.md`. Backup vẫn nằm cùng máy; sao lưu ra ngoài máy cũng vẫn để mở.

### Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Backend gọi prerender ngay khi xuất bản | Container backend phải ra được host hoặc Docker socket, và nhiều module xuất bản (tướng, bản cập nhật, kho trang bị, thuật ngữ) đều phải gọi; trễ tối đa 15 phút là chấp nhận được |
| Cron | VPS đã dùng systemd timer cho deploy; timer ghi log vào journal, có `Persistent`, không chạy chồng một lượt đang chạy |
| Service thường trực lặp prerender | Trái với job một lần của ADR-022, và giữ thêm một container chạy suốt |
| Chỉ prerender khi nội dung đổi | Cần API mới cho dấu thời gian xuất bản; một lần chạy chỉ mất vài giây và `publishSite` bỏ qua file không đổi |
| Backup ngay trong `deploy.sh` mỗi ngày | Trộn hai việc khác nhịp; ngày không có commit mới thì `deploy.sh` không làm gì |

### Hệ quả

- Nội dung vừa xuất bản có trang riêng và nằm trong `sitemap.xml` sau tối đa khoảng 15 phút, không cần lần cập nhật nào.
- Mỗi ngày có một bản dump dù không cập nhật; `backups/db/` giữ tới `BACKUP_KEEP` bản `daily` và `BACKUP_KEEP` bản `auto`.
- Lần `media-backup` đầu tiên tải toàn bộ object R2 về đĩa VPS (khoảng 4,4 GB theo ADR-030); các lần sau chỉ tải object mới.
- Cài hai timer là việc làm tay một lần trên VPS, như `aov-deploy.timer`; `deploy.sh` không cài unit. Đổi file unit trong repo
  thì phải chép lại.
- Sau một lần cập nhật dừng giữa chừng, `aov-wiki-pages.service` báo lỗi mỗi 15 phút cho tới khi một lần cập nhật thành công.

### Kiểm chứng (19/11/2026)

- `tests/seo-prerender.test.ts` của Wiki: đưa lại cùng bản giữ bundle của bản trước và danh sách vẫn là bundle hiện tại; lần
  phát hành bản khác kế tiếp xóa bundle đó. Test đầu thất bại với mã cũ.
- shellcheck không báo gì với `scheduled.sh` và `deploy.sh`. `systemd-analyze verify` trên VPS nhận bốn file unit; lịch
  `03:00:00 Asia/Ho_Chi_Minh` rơi vào 20:00 UTC.
- Trên VPS, `scheduled.sh` chạy trong một checkout tạm với `docker` giả (stack thật không bị đụng tới):
  - `pages` gọi `docker compose run --rm --no-deps wiki-prerender` khi đang giữ khóa;
  - đang có lần cập nhật giữ khóa thì `pages` thoát mã 0 mà không gọi gì;
  - checkout khác commit trong `deployed` thì `pages` thoát mã 1 mà không gọi gì;
  - `backup` dump với nhãn `daily` khi đang giữ khóa, rồi chép R2 khi khóa đã nhả;
  - `backup` chờ lần cập nhật giữ khóa xong rồi mới chạy.
- Chưa thử: cài hai timer và để chúng chạy thật trên VPS, lần `media-backup` đầu tiên với R2 thật.

## Bổ sung 19/11/2026: cảnh báo qua email, backup ngoài máy, mail của Keycloak

### Bối cảnh

- Lần cập nhật, prerender hay backup lỗi chỉ hiện trong journal của VPS. Không ai biết site ngừng trả lời hay đĩa sắp đầy, trừ
  khi tự mở máy ra xem.
- Backup nằm cùng máy với stack: mất máy là mất cả dữ liệu lẫn bản dump.
- Realm `wikiaov` chưa có SMTP và tắt "Quên mật khẩu". Biến `MAIL_*` của wiki-service (ADR-028) trên VPS còn trống, nên đổi
  mật khẩu bằng mã email cũng chưa chạy.
- DigitalOcean chặn cổng 25, 465 và 587 đi ra từ droplet; đã thử ngày 19/11/2026, `smtp.gmail.com` không kết nối được, cổng
  2525 và 2587 của các dịch vụ gửi mail thì được.
- Người dùng chọn ngày 19/11/2026: cảnh báo gửi tới email của chủ dự án; gửi qua Resend; backup ngoài máy là một bucket R2
  riêng.

### Quyết định

1. **Một cấu hình mail cho cả ba việc.** `MAIL_*` trong `.env` trỏ tới SMTP của Resend (`smtp.resend.com`, cổng 2587 với
   STARTTLS, người dùng `resend`, mật khẩu là API key). Địa chỉ gửi nằm trên tên miền của site, ví dụ
   `no-reply@athahub.com`, đã xác minh trong Resend bằng bản ghi DNS. wiki-service, Keycloak và các script trên máy chủ cùng
   dùng nó.
2. **Cảnh báo việc chạy lỗi.** `aov-deploy.service`, `aov-wiki-pages.service` và `aov-backup.service` có
   `OnFailure=aov-alert@%n.service`. `infra/scripts/alert.sh` gửi tới `ALERT_EMAIL` log của đúng lần chạy đó.
   - Cùng một lỗi lặp lại (so bằng dòng log cuối, bỏ dấu thời gian) chỉ gửi một lần mỗi sáu giờ: một lần cập nhật dừng giữa
     chừng làm `pages` lỗi mỗi 15 phút mà không thành 96 email một ngày. Lỗi khác thì gửi ngay.
   - Chưa đặt `MAIL_HOST`, `MAIL_PASSWORD` hoặc `ALERT_EMAIL` thì không gửi gì, nội dung chỉ vào journal.
   - Địa chỉ nhận chỉ nằm trong `.env` của máy chủ, không nằm trong repo công khai.
3. **Kiểm tra sức khỏe năm phút một lần** (`aov-watch.timer`, `scheduled.sh watch`), trên chính máy đó:
   - các địa chỉ công khai trả lời qua Caddy, như bước cuối của `deploy.sh`, thêm một API công khai của community-service;
   - `postgres`, `redis`, `keycloak`, `wiki-service`, `community-service`, `reverse-proxy` đang chạy và không `unhealthy`;
   - đĩa dưới 85%;
   - bản backup `daily` mới nhất chưa quá 26 giờ (khi đã có ít nhất một bản).

   Thấy lỗi thì thử lại sau 30 giây; còn lỗi mới gửi. Danh sách lỗi đổi (không tính chữ số) thì gửi ngay; còn y như cũ thì sáu
   giờ một lần. Hết lỗi thì gửi một email báo đã ổn. Đang có lần cập nhật giữ khóa thì bỏ lượt, vì Keycloak có thể đang khởi
   động lại.
4. **Backup ngoài máy.** `scheduled.sh backup` chép thư mục dump sang bucket R2 riêng (`OFFSITE_BUCKET`) bằng service
   `db-offsite`, ngay sau khi dump và trước `media-backup`.
   - Token riêng, chỉ có Object Read & Write trên bucket đó.
   - Thư mục dump được ghi một lần nên thư mục đã có được bỏ qua. Script không bao giờ xóa gì trên bucket; bản cũ hết hạn bằng
     quy tắc vòng đời của bucket (đề xuất 60 ngày), đặt trên Cloudflare.
   - Bỏ qua thư mục đang ghi (`.partial`) và bản chuyển dữ liệu dev (`dev-*`).
   - Ảnh và tệp nguồn vốn nằm trên R2 nên không chép thêm. `.env` không lên bucket: chủ dự án giữ một bản riêng, ví dụ trong
     trình quản lý mật khẩu.
   - Chép lỗi thì `media-backup` vẫn chạy, rồi lần chạy báo lỗi.
5. **Mail của Keycloak.** Service một lần `keycloak-mail` (profile `ops`, `infra/keycloak/configure-mail.sh`) đặt SMTP của
   realm theo `MAIL_*` và bật "Quên mật khẩu". Chạy tay mỗi khi đổi `MAIL_*`, vì Keycloak chỉ đọc file realm lần đầu. Không bật
   "Xác minh email": bật lên sẽ buộc mọi tài khoản đang có xác minh ở lần đăng nhập kế.

### Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Gmail với mật khẩu ứng dụng | Cổng 465 và 587 bị DigitalOcean chặn; email của Keycloak sẽ đi từ Gmail cá nhân |
| Xin DigitalOcean mở cổng 587 | Không chắc được duyệt, và vẫn cần một nơi gửi trên tên miền của site |
| Dịch vụ theo dõi uptime bên ngoài | Cổng 443 hiện chỉ mở cho IP của chủ dự án nên dịch vụ ngoài không gọi được; xét lại khi mở site |
| Gửi qua API HTTP của Resend | Keycloak và Spring Mail chỉ nói SMTP; một cách gửi cho cả ba việc đơn giản hơn |
| DigitalOcean Backups | Người dùng chọn bucket R2; ảnh chụp cả máy tốn thêm tiền mỗi tháng |
| Script tự xóa bản cũ trên bucket | Token của VPS sẽ cần quyền xóa có chủ đích; quy tắc vòng đời của bucket làm việc đó mà VPS không phải nhớ |

### Hệ quả

- Chủ dự án phải làm trên tài khoản của mình: tạo tài khoản Resend, thêm tên miền và bản ghi DNS trên Cloudflare, tạo API key;
  tạo bucket backup, token của nó và quy tắc vòng đời; dán các khóa vào `.env` trên VPS. Hướng dẫn ở `infra/README.md`.
- Sau khi dán `MAIL_*`: `deploy.sh --refresh` để wiki-service đọc giá trị mới, và `docker compose run --rm keycloak-mail`.
- Gói miễn phí của Resend gửi 100 email mỗi ngày, đủ cho cảnh báo và email tài khoản lúc này.
- Kiểm tra sức khỏe chạy trên chính VPS: máy tắt hẳn hoặc mất mạng thì không có email nào. Cần một dịch vụ bên ngoài khi cổng
  443 mở cho mọi người.
- Một lần cập nhật đổi Keycloak làm `/idp/` ngừng trả lời khoảng một phút, nhưng lúc đó lần cập nhật giữ khóa nên không có cảnh
  báo.
