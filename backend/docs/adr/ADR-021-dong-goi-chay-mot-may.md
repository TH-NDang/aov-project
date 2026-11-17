# ADR-021 — Đóng gói toàn hệ thống trên một máy và các đường dẫn proxy bổ sung

**Trạng thái:** Chấp nhận; [bổ sung 17/11/2026](#bổ-sung-17112026-object-storage-là-cloudflare-r2) chờ người dùng duyệt
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

### Quyết định

1. **Bỏ `seaweedfs`, `storage-init` và volume `seaweedfs-data`.** Stack không tạo bucket và không ghi CORS. Ba bucket, token
   và tên miền ảnh được chuẩn bị trên Cloudflare (ADR-014, ADR-030). `rclone` đặt `no_check_bucket`, nên cũng không thử tạo
   bucket.
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
6. **Một database, một bộ bucket.** Hai database dùng chung bucket không ghi đè nhau, vì key ảnh là UUID, nhưng vẫn xóa
   được của nhau: tệp nguồn lưu theo SHA-256, và database chép từ database kia trỏ tới cùng object. Stack chạy thử có bộ
   bucket và tên miền ảnh riêng; chỉ trỏ vào bucket của dev khi stack thay hẳn database dev.
7. **Không đổi:** test Testcontainers và profile `local-storage` trong `backend/wiki-service/compose.yaml` vẫn dùng SeaweedFS
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

### Hệ quả

- Stack cần mạng và tài khoản Cloudflare để chạy. Làm việc không có mạng thì dùng dev với profile `local-storage`.
- Đổi `PUBLIC_ORIGIN` phải đổi cả CORS của hai bucket riêng tư trên Cloudflare.
- Khi bật Content-Security-Policy phải cho phép endpoint R2 (`connect-src`, `img-src`) và tên miền ảnh (`img-src`). Hiện chưa
  có CSP nào nên không có gì chặn.
- Bản chép media nằm cùng máy với stack: giữ được dữ liệu khi R2 mất object, không giữ được khi mất máy. Sao lưu ra ngoài
  máy vẫn là việc còn mở.
- **Stack đã chạy bản cũ:** container `seaweedfs`, `storage-init` và volume `<project>_seaweedfs-data` còn lại sau khi cập
  nhật. Stack chưa từng chạy với dữ liệu thật. Nếu volume có ảnh cần giữ:
  1. chạy `media-backup` của bản cũ trước khi cập nhật;
  2. chuyển `backups/media/wiki-media/assets` sang `backups/media/<bucket ảnh công khai>/assets`, và `imports` sang
     `backups/media/<bucket riêng tư>/imports`;
  3. chạy `media-restore` của bản mới.

  Sau đó `docker compose up -d --wait --remove-orphans` bỏ hai container cũ; `docker volume rm <project>_seaweedfs-data`
  xóa volume.

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
