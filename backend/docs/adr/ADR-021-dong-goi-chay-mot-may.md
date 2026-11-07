# ADR-021 — Đóng gói toàn hệ thống trên một máy và các đường dẫn proxy bổ sung

**Trạng thái:** Chấp nhận
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
  (`JWT_BACKCHANNEL_ISSUER_URI`) cho token/revoke và JWKS qua mạng nội bộ; issuer trong token và URL đưa trình duyệt đi vẫn
  là địa chỉ công khai. `wiki.storage.public-endpoint` (`STORAGE_PUBLIC_ENDPOINT`) chỉ dùng cho presigned URL. Bỏ trống thì
  mọi thứ như cũ, local không đổi.
- **Presigned upload đi qua proxy cùng origin**, tại đường dẫn path-style `/{bucket}/*`, chỉ khi có `X-Amz-Signature`. Không
  rewrite và giữ nguyên `Host` nên chữ ký S3 vẫn đúng; không cần CORS và không cần thêm cổng. Bucket vẫn đóng với request
  không có chữ ký, nên quy tắc "chỉ mở `assets/`, `incoming/` không public" của 01 mục 3.6 vẫn giữ: đường này không đọc được
  gì nếu `wiki-service` chưa ký. Khi dùng dịch vụ S3 có sẵn, đặt `STORAGE_PUBLIC_ENDPOINT` về endpoint đó và đường này
  không còn được dùng.
- **Service tin `X-Forwarded-*` ở profile `prod`** (`server.forward-headers-strategy: native`). Chỉ proxy tới được cổng service,
  proxy luôn ghi đè các header này. Nếu không, mọi người dùng có cùng IP là IP của proxy và giới hạn đăng nhập theo IP của
  ADR-007 trở thành giới hạn chung cho toàn hệ thống.
- **Caddy kèm module `caddy-ratelimit`**, vì ADR-007 và 01 mục 3.3 yêu cầu giới hạn tần suất tại proxy mà Caddy gốc không có.
  Chỉ giới hạn các đường đăng nhập và form liên hệ theo IP, không giới hạn đọc wiki để tránh chặn nhầm người dùng chung IP.
- **Không thêm dịch vụ chạy nền.** Backup và khởi tạo bucket là container chạy một lần rồi thoát (`preflight`, `db-backup`,
  `storage-init`, `media-*`). `rclone` được chọn cho media vì đi qua API S3, dùng được cho cả SeaweedFS và R2.
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
