# R2 và CDN cho Media

Backend local hiện đã dùng R2 để upload và lưu Media, phục vụ ảnh qua `https://img.athahub.com/assets`. Đợt chuyển ngày 23/10/2026 đã sao chép và kiểm chứng toàn bộ 5.489 phiên bản Media tại thời điểm chuyển trước khi đổi cấu hình. Cấu hình mẫu nằm ở `r2.env.example`; khóa thật chỉ nằm trong `.env.r2` bị Git bỏ qua trên máy.

Khởi động lại từ thư mục `backend/wiki-service`:

```powershell
./scripts/dev/start-local.ps1 -EnvironmentFile .env.r2
```

Launcher đọc file môi trường như dữ liệu, không thực thi nội dung. Maven chạy trực tiếp không tự đọc file này. Biến đã export trong terminal được ưu tiên hơn file; khi kiểm tra lại cấu hình, tránh để các biến `STORAGE_*` hoặc `MEDIA_PUBLIC_BASE_URL` cũ ghi đè lên cấu hình R2.

## Thiết lập

1. Kích hoạt R2 trực tiếp trong Cloudflare. Tạo hai bucket Standard `aov-media-private` và `aov-media-assets`.
2. Giữ `aov-media-private` hoàn toàn riêng tư. Gắn CORS trong `upload-cors.json` vào bucket này để admin upload trực tiếp bằng URL ký sẵn. Khi đổi địa chỉ admin, thêm origin chính xác, không dùng wildcard.
3. Tạo credential R2 có quyền object read/write chỉ trên hai bucket. Nhập vào file môi trường bị Git bỏ qua trên máy; không gửi secret vào chat hoặc commit.
4. Chỉ bật public cho `aov-media-assets` khi đã xác nhận ảnh trong đó được phép công khai. Chưa có domain thì dùng URL `r2.dev` để thử; đây không phải CDN cache và có giới hạn tốc độ.
5. Gộp các biến mẫu vào `.env.r2` riêng tư cùng các thiết lập local cần giữ. `STORAGE_CREATE_BUCKET_IF_MISSING=false` ngăn local initializer ghi đè cấu hình bucket cloud. Chạy launcher với `-EnvironmentFile .env.r2` như hướng dẫn trên.

## Chuyển dữ liệu hiện có

- Export database và lập danh sách mọi phiên bản Media trước khi chuyển. Sao chép nguyên key `assets/<assetId>/<versionId>.<ext>` sang bucket assets, giữ Content-Type và `Cache-Control: public, max-age=31536000, immutable`.
- Giữ nguyên alias `primary`, UUID, SHA-256 và metadata trong DB. Không dùng API đăng ký ảnh mới thay cho chuyển kho.
- Đối chiếu số object, kích thước và SHA-256 với nguồn; ETag không phải lúc nào cũng là checksum nội dung. Giữ kho cũ để quay lui.
- Dừng tạo upload/import mới lúc chuyển cấu hình. Xử lý các phiên đang chờ trước, hoặc chuyển cả key tạm/import cần giữ sang kho private; không xóa phiên upload đang khôi phục.
- Chỉ đổi cấu hình đang chạy sau khi đối chiếu hoàn tất. Thử upload → complete → xem ảnh, xem phiên bản cũ, avatar, skill và trang phục. Hai request ảnh phải trả đúng byte và cache header.
- Không bỏ theo dõi Git LFS hoặc xóa ảnh nguồn trước khi có bản sao cloud và backup đã kiểm chứng. File nguồn không phải ảnh Media hợp lệ cần được lưu trữ riêng, không ép chuyển định dạng âm thầm.

## CDN khi có tên miền

Thêm domain thuộc sở hữu vào Cloudflare và gắn `img.<domain>` với bucket assets. Đổi `MEDIA_PUBLIC_BASE_URL=https://img.<domain>/assets`. Đuôi `/assets` là bắt buộc với cách dựng URL hiện tại.

Ảnh PNG/JPEG/WebP dùng cache header bất biến hiện có. Chỉ tạo Cache Rule cho hostname ảnh và `/assets/` khi cần điều chỉnh; không cache URL ký sẵn, API hoặc vùng private. Kiểm chứng hai lần GET cùng URL: sau cache miss phải quan sát được `CF-Cache-Status: HIT` khi đủ điều kiện cache. Không khẳng định CDN hoạt động chỉ vì URL trả HTTP 200.

Ảnh thay đổi tạo version mới nên tự có URL mới, không cần purge ảnh phiên bản cũ. Không đặt TTL xóa tự động cho assets. Với incoming, chỉ đặt lifecycle sau khi xác định thời hạn phục hồi upload; không áp dụng quy tắc xóa cho toàn bộ bucket private hoặc imports đang chạy.

## Cấu hình thực tế của AthaHub — 23/10/2026

### Các thao tác đã thực hiện trên Cloudflare

1. Tạo hai bucket **Standard**, vị trí **Asia-Pacific**: `aov-media-assets` và `aov-media-private`.
2. Cấu hình CORS cho bucket private: chỉ origin `http://localhost:5175` và `http://127.0.0.1:5175`; phương thức PUT/GET/HEAD, header Content-Type, expose ETag, max age 600 giây. Upload vẫn cần URL ký sẵn; CORS không làm bucket công khai.
3. Trong **R2 → aov-media-assets → Settings → Custom Domains**, thêm `img.athahub.com`, xem trước bản ghi rồi chọn **Connect domain**. Cloudflare tự tạo DNS `img` trỏ vào bucket; trạng thái domain đã là **Active**, Access **Enabled**.
4. Giữ **Public Development URL** (`r2.dev`) tắt. Không nối domain công khai vào bucket private.
5. Trong **athahub.com → Caching → Cache Rules**, tạo và Deploy rule **AthaHub immutable media assets**. Rule đã **Active**.

Biểu thức của rule:

```text
(http.host eq "img.athahub.com" and starts_with(http.request.uri.path, "/assets/") and http.request.method in {"GET" "HEAD"} and not http.request.uri.query contains "X-Amz-")
```

Thiết lập:

- **Cache eligibility:** Eligible for cache.
- **Edge TTL:** Use cache-control header if present, cache request with Cloudflare's default TTL for the response status if not.
- **Browser TTL:** Respect origin TTL.
- Giữ cache key mặc định, không bỏ qua query string; không bật Cache Reserve hoặc đăng ký gói trả phí bổ sung.

Ảnh hoàn tất qua backend đã có cache header bất biến một năm. Rule tôn trọng header đó; ảnh không có header dùng TTL mặc định theo mã phản hồi ở CDN. Đây là thời hạn cache, không phải lịch xóa object trong R2.

### Kiểm chứng đã thực hiện

Upload ảnh PNG kiểm tra 80 byte với key `assets/cdn-check.png` qua dashboard, rồi GET ba lần qua HTTPS. Kết quả lần lượt `MISS`, `HIT`, `HIT`, tất cả HTTP 200 và SHA-256 khớp file gốc. Ảnh kiểm tra này không được đăng ký thành Media asset trong database.

- Ảnh kiểm tra: https://img.athahub.com/assets/cdn-check.png
- Bucket: https://dash.cloudflare.com/a43cbaa6fb08a428abb4e76e06af0b97/r2/default/buckets/aov-media-assets/settings
- Cache Rules: https://dash.cloudflare.com/a43cbaa6fb08a428abb4e76e06af0b97/athahub.com/caching/rules
- Rule: https://dash.cloudflare.com/a43cbaa6fb08a428abb4e76e06af0b97/athahub.com/caching/rules/cache/cdbbbb8eb6fd48c9950f980ede15f7fb

Biên nhận kiểm chứng và ảnh chụp dashboard nằm trong `.local-state/r2-setup/` trên máy, không đưa vào Git.

### Chuyển Media và ứng dụng sang R2

Đã hoàn tất ngày 23/10/2026:

1. Export database trước khi chuyển và ngay trước lúc đổi cấu hình. Hai bản sao local là `.local-state/r2-migration/wiki-before-r2-20261023.dump` và `.local-state/r2-migration/wiki-cutover-20261023.dump`.
2. Lập manifest toàn bộ **5.489 phiên bản**, tổng **789.035.571 byte**, rồi sao chép từ SeaweedFS sang `aov-media-assets`. Đã đọc toàn bộ bytes nguồn và đích để đối chiếu SHA-256, kích thước; kiểm tra Content-Type và cache header của object trên R2. Giữ nguyên asset ID, version ID, alias `primary` và object key.
3. Kiểm chứng **20 ảnh lấy mẫu qua CDN**: nội dung và metadata đúng, quan sát được `CF-Cache-Status: HIT`. Công cụ tự khai báo `User-Agent: AthaHub-CDN-Verification/1.0`; không giả trình duyệt hoặc tắt bảo vệ Cloudflare. User-Agent mặc định của Python từng bị Browser Integrity Check chặn nên không dùng cho phép kiểm tra này.
4. Khởi động backend bằng `.env.r2` với public base URL `https://img.athahub.com/assets`. Đổi namespace cache đọc trong Redis để dữ liệu cache cũ không tiếp tục trả URL ảnh local. Google login vẫn được bật trong môi trường này.
5. Thử luồng upload thật: backend cấp presigned URL R2 → PUT trực tiếp lên bucket private → complete. CORS cho `http://localhost:5175` hoạt động; upload lại cùng bytes trả kết quả trùng, giữ phiên bản hiện tại; key incoming được dọn sau complete và ảnh trả về qua CDN có HIT.

Biên nhận sao chép, manifest và các kết quả kiểm chứng nằm trong `.local-state/r2-migration/`. Đây là dữ liệu local bị Git bỏ qua, không phải file cần commit. Cả hai bản dump chứa dữ liệu dự án và cần được giữ riêng tư.

### Nguồn local và phạm vi còn giữ lại

SeaweedFS và ảnh nguồn trong `resources/` vẫn được giữ để đối chiếu hoặc quay lui. Việc chuyển kho trên chỉ sao chép các phiên bản đã đăng ký trong Media; không tự đăng ký mọi file resources thành Media, không ép chuyển GIF và không xóa hay bỏ theo dõi Git LFS.

Khi cần quay lại kho local, dùng bộ cấu hình local tương ứng; không thay đổi UUID hoặc object key trong DB. Nếu sau thời điểm chuyển đã có upload mới lên R2 thì phải sao chép và kiểm chứng phần phát sinh về kho local trước khi quay lui. Bản dump là điểm khôi phục, không thay cho việc giữ bytes ảnh tương ứng.

## Công cụ chuyển Media hiện có

Công cụ offline `migrate-media.py` dùng AWS SDK Python trong môi trường riêng; ứng dụng Java vẫn chỉ dùng port ObjectStorage và adapter AWS SDK Java. Không thêm dịch vụ hoặc thay schema.

Từ thư mục service:

```powershell
python -m venv .local-state/r2-tools
./.local-state/r2-tools/Scripts/python.exe -m pip install -r infra/cloudflare/requirements.txt
./.local-state/r2-tools/Scripts/python.exe infra/cloudflare/migrate-media.py --manifest .local-state/r2-migration/media-versions.json --environment-file .env.r2 --receipt .local-state/r2-migration/receipts.jsonl --plan
./.local-state/r2-tools/Scripts/python.exe infra/cloudflare/migrate-media.py --manifest .local-state/r2-migration/media-versions.json --environment-file .env.r2 --receipt .local-state/r2-migration/receipts.jsonl --apply --workers 3 --cdn-sample-size 20
```

Manifest là JSON `{ "versions": [...] }`, mỗi dòng có `id`, `asset_id`, `object_key`, `sha256`, `mime_type`, `size_bytes`, `storage_alias`, lấy từ toàn bộ media_asset_version, kể cả phiên bản lịch sử. Công cụ yêu cầu key khớp UUID và định dạng MIME, kiểm tra SHA-256 nguồn theo database, ghi R2 có điều kiện chống ghi đè, đọc lại toàn bộ bytes đích để đối chiếu, rồi ghi biên nhận JSONL có fsync. Mặc định chỉ lập kế hoạch; phải có `--apply` mới ghi object.

Chạy lại sẽ kiểm chứng ảnh đã tồn tại và bỏ qua upload nếu đúng; không chỉ tin biên nhận cũ. Không chạy nhiều bản cùng lúc trên một biên nhận. Manifest hoặc đích thay đổi phải dùng biên nhận riêng. Công cụ không sửa database, không xóa nguồn. `--cdn-verify all` dùng khi cần kiểm tra mọi ảnh qua CDN thay vì lấy mẫu; mỗi ảnh được GET ba lần và yêu cầu có HIT.

Nếu sao chép đã hoàn tất và chỉ cần kiểm tra lại CDN, không chạy lại `--apply`:

```powershell
./.local-state/r2-tools/Scripts/python.exe infra/cloudflare/migrate-media.py --manifest .local-state/r2-migration/media-versions.json --environment-file .env.r2 --receipt .local-state/r2-migration/receipts.jsonl --verify-cdn-only --cdn-sample-size 20
```

`--verify-cdn-only` yêu cầu biên nhận đúng manifest và đích lưu trữ, có kết quả hoàn tất cho **mọi key** trong manifest trước khi kiểm tra CDN. Chế độ này không tạo S3 client, không đọc lại toàn bộ kho nguồn/đích, không ghi object hoặc biên nhận. Nó chỉ kiểm chứng các ảnh được chọn qua HTTPS; không dùng để khẳng định toàn bộ kho chưa từng thay đổi sau lần sao chép. Có thể thêm `--cdn-verify all` để kiểm tra mọi ảnh qua CDN. `--plan`, `--apply` và `--verify-cdn-only` loại trừ nhau; chế độ kiểm chứng riêng không cho phép `--cdn-verify none`.

File `.env.r2` trên máy được Git bỏ qua, chứa khóa R2 và cấu hình runtime riêng. Không đưa file này, biên nhận riêng hoặc bản dump database vào commit. Các file mẫu chỉ chứa placeholder.

### Import ảnh mới bằng công cụ resources

Ba công cụ `research/character-images/import-images.py`, `import-skill-images.py` và `research/warehouse/import-warehouse.py` mặc định chỉ gửi bytes tới localhost. Khi backend cấp URL upload R2, thêm:

```text
--upload-host a43cbaa6fb08a428abb4e76e06af0b97.r2.cloudflarestorage.com
```

Chỉ đúng hostname HTTPS được cho phép; không chấp nhận cổng tùy ý, userinfo, fragment, hostname giả hoặc redirect. URL API backend và Keycloak của các công cụ này vẫn là localhost. Việc này không thay đổi cách upload trực tiếp của giao diện admin.
