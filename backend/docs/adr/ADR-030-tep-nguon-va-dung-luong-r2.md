# ADR-030 — Tệp nguồn riêng tư trên R2 và theo dõi dung lượng

**Trạng thái:** Chấp nhận (người dùng duyệt ngày 14/11/2026, kèm mục 14)  
**Ngày:** 2026-11-14

## Bối cảnh

- Media đã nằm trên R2 từ 23/10/2026 (ADR-014). Ngày 14/11/2026, database dev có 6.886 phiên bản Media còn bytes,
  tổng 1,08 GB, trong bucket công khai `aov-media-assets`.
- `resources/` còn 7.387 tệp trong git (1,29 GB qua Git LFS). Ngoài git còn khoảng 4,3 GB chỉ có ở checkout chính trên
  máy phát triển (`resources/raw`, `resources/extracted`), và git không bỏ qua hai thư mục này. Kho GitHub công khai nên
  ai cũng tải được ảnh gốc của game. Trên VPS, mã lấy không kèm LFS nên mọi chỗ đọc thẳng `resources/` đều hỏng.
- Đối chiếu SHA-256 (chính là OID của Git LFS) với database: 6.225 trên 6.241 ảnh trong `resources/Lien-Quan-v3/assets`
  đã là Media, gồm đủ 603 ảnh chiêu của thư viện icon kỹ năng (V033). Wiki vẫn lấy ảnh chiêu thẳng từ `resources/`.
- Ảnh đối chứng chỉ có trên máy phát triển và chỉ xem được qua middleware của Vite dev; bản Admin đã build trả 404.
  Build đề cử và thống kê đấu hạng lưu `image_id` là SHA-256 của ảnh chụp, và mọi màn hình đối chứng gọi ảnh theo
  SHA-256.
- Không có chỗ nào cho biết đã dùng bao nhiêu trong gói miễn phí của R2: 10 GB-tháng lưu trữ, 1 triệu thao tác lớp A
  và 10 triệu thao tác lớp B mỗi tháng (trang giá Cloudflare, đọc ngày 14/11/2026).

## Quyết định

### 1. Ba loại tệp, ba nơi lưu

| Loại | Ví dụ | Nơi lưu | Ai xem |
|---|---|---|---|
| Ảnh công khai | Ảnh tướng, trang phục, chiêu, trang bị, icon chế độ chơi | Media trong `aov-media-assets`, qua `img.athahub.com/assets` | Mọi người |
| Ảnh đối chứng | Ảnh chụp bảng giá, ảnh tướng theo patch, build, xếp hạng, trang bách khoa, sảnh đã che UID | Tệp nguồn trong bucket mới `aov-source-private` | Tài khoản Admin |
| Dữ liệu nhập | JSON, CSV, Markdown, script của công cụ nhập | Tệp nguồn trong `aov-source-private` | Tài khoản Admin và công cụ |

- Ảnh đối chứng không bao giờ thành Media, nên không thể vô tình gắn vào trang công khai.
- `aov-source-private` là bucket Standard, không gắn custom domain, không bật `r2.dev`. Người dùng tự tạo bucket.
- CORS của bucket mới chỉ cho `GET` và `HEAD` từ origin Admin, để Admin `fetch` được manifest JSON qua URL ký sẵn.
  Upload vẫn đi vào `incoming/` của `aov-media-private`, nơi đã có CORS cho `PUT`.

### 2. Định tuyến theo key, không thêm thao tác S3

- Cấu hình mới `wiki.storage.sources-bucket` (`STORAGE_SOURCES_BUCKET`). Để trống thì dùng bucket riêng tư, nên local
  SeaweedFS vẫn chạy một bucket.
- `S3ObjectStorage` đưa key bắt đầu bằng `sources/` vào bucket này, giống cách ADR-014 đưa `assets/` vào bucket công
  khai. CopyObject từ `incoming/` sang `sources/` là copy giữa hai bucket, như Media đang làm.
- Vẫn chỉ dùng Put, Head, Get, Copy, Delete và presigned PUT/GET (ADR-006). Không dùng ListObjects.
- URL GET ký sẵn được thêm tùy chọn tên tải về (`response-content-disposition`), để tải tệp với đúng tên gốc.

### 3. Lưu theo nội dung

- Bytes nằm ở `sources/<sha256>`, SHA-256 hex chữ thường. Object không bao giờ bị ghi đè.
- Cùng bytes chỉ lưu một lần dù nằm trong nhiều bộ, ví dụ ảnh chụp lại trùng giữa `tuong-v4.zip` và bộ chính.
- Màn hình đối chứng, build và xếp hạng đang dùng SHA-256 làm mã ảnh, nên tra thẳng được, không cần bảng ánh xạ thêm.

### 4. Danh mục trong database

Bốn bảng mới trong schema `media`, thuộc capability `source` của module media (02, phần ADR-030):

- `source_object`: mỗi bytes một dòng: SHA-256, kích thước, Content-Type, object key, thời điểm và người tải.
- `source_collection`: một bộ tệp của một chức năng: mã, loại chức năng, tên hiển thị, ghi chú, ngày chụp nếu biết.
- `source_file`: tệp trong bộ: đường dẫn tương đối giữ nguyên thư mục và tên gốc, trỏ tới SHA-256.
- `source_upload_session`: phiên upload, cùng vòng đời với upload Media.

Loại chức năng cố định:

| Mã | Tên hiển thị | Gồm |
|---|---|---|
| `HERO_CAPTURE` | Ảnh tướng theo patch | Bộ chụp trang tướng, chụp lại, ảnh trong trận |
| `SHOP_CAPTURE` | Ảnh cửa hàng | Giá tướng, cách nhận trang phục |
| `BUILD_CAPTURE` | Ảnh build đề cử | Màn hình Đề cử Pro |
| `RANKING_CAPTURE` | Ảnh xếp hạng | Bảng Phân Bậc Tướng |
| `GAME_MODE_SOURCE` | Ảnh nguồn chế độ chơi | Trang bách khoa Cờ Liên quân, sảnh đã che UID |
| `ESPORTS_SOURCE` | Ảnh nguồn thi đấu | Ảnh và dữ liệu mẫu giải đấu |
| `IMPORT_DATA` | Dữ liệu nhập | JSON, CSV, Markdown, script của công cụ nhập |
| `ARCHIVE` | Lưu trữ | Tệp gốc chỉ giữ để dựng lại, ví dụ ZIP nhận từ người chụp |

### 5. Tải lên

- Backend cấp presigned PUT vào `incoming/<uploadId>`. Complete đọc stream để tính SHA-256, so với giá trị khai báo,
  kiểm tra kích thước và với ảnh thì nhận diện định dạng từ chữ ký tệp. Đúng thì copy sang `sources/<sha256>` và xóa
  key tạm.
- Bytes đã có thì không upload lại: backend chỉ thêm tệp vào bộ.
- Đường dẫn đã có trong bộ mà bytes khác thì từ chối, trừ khi người dùng chọn thay tường minh kèm phiên bản dòng.
  Thay chỉ trỏ đường dẫn sang bytes mới; bytes cũ vẫn còn.
- Loại tệp cho phép: PNG, JPEG, WebP, GIF, JSON, CSV, văn bản thuần, Markdown, ZIP. Script lưu dạng văn bản thuần.
  Không nhận HTML, SVG hay tệp trình duyệt chạy được.
- Giới hạn mặc định 2 GB mỗi tệp (`wiki.sources.max-upload-size`), dưới giới hạn 5 GB của một lần PUT và CopyObject.
- Không giữ transaction khi gọi storage.

### 6. Xem và tải về

- Admin xin URL GET ký sẵn theo lô, tối đa 200 SHA-256 mỗi lần. URL sống 10 phút (`wiki.sources.link-validity`).
- Cần `catalog:read`. Không API công khai nào trả URL này; Wiki và Stream không gọi các endpoint tệp nguồn.
- Bytes đi thẳng từ R2 tới trình duyệt, không qua backend. Không ghi URL ký sẵn vào log.
- Admin giữ URL trong bộ nhớ và xin lại trước khi hết hạn.

### 7. Nơi dùng và xóa

- Module build và hero (xếp hạng) báo các SHA-256 đang tham chiếu qua contract mới `SourceFileUsageProvider` ở gốc
  module media, giống `MediaUsageProvider`. Media không đọc bảng của module khác.
- Bỏ một tệp hay cả bộ chỉ xóa dòng danh mục; bytes vẫn còn và được tính dung lượng.
- Bytes không còn trong bộ nào và không còn nơi dùng là bytes mồ côi. Xóa vĩnh viễn bytes mồ côi là thao tác riêng,
  có xác nhận, cần `media:write`. DeleteObject không tính phí.

### 8. Đồng bộ bằng dòng lệnh

Công cụ Node chạy trong `frontend/apps/admin-aov/server/`, dùng chung code dựng manifest với các middleware hiện có:

- `plan`: liệt kê tệp, tính SHA-256, gọi API ước lượng rồi in số tệp mới, GB mới, thao tác lớp A/B và dung lượng sau khi
  tải so với mức miễn phí. Không ghi gì.
- `push --apply`: upload tối đa 3 tệp song song, đọc lại bytes qua URL ký sẵn để đối chiếu SHA-256, ghi biên nhận JSONL
  có fsync vào `.local-state/source-sync/`. Chạy lại thì kiểm tra lại, không tin biên nhận cũ.
- `pull`: tải một bộ về thư mục cục bộ, kiểm tra SHA-256, bỏ qua tệp đã đúng, từ chối đường dẫn thoát khỏi thư mục đích.
- `publish-captures`: dựng manifest dẫn xuất của bộ ảnh tướng, cửa hàng, build, xếp hạng rồi push cùng ảnh.

Công cụ gọi Admin API bằng tài khoản dịch vụ `wiki-importer` (đã có `media:write`), không cần khóa R2.

### 9. Theo dõi dung lượng

Nguồn chính là database:

- Media (phiên bản chưa bị xóa bytes) và `source_object` đã có kích thước, loại, chức năng và thời điểm tải.
- Từ đó biết ngay dung lượng theo bucket, theo loại ảnh hay chức năng, số tệp và lượng tải lên theo tháng.
- Không tốn thao tác R2 và không cần thêm khóa.
- Thao tác tháng này được ước lượng từ các lần tải: mỗi tệp mới 2 thao tác lớp A (PUT, CopyObject) và 2 lớp B
  (HeadObject, GetObject lúc complete).

Đối chiếu tùy chọn là Cloudflare GraphQL Analytics (`r2StorageAdaptiveGroups`, `r2OperationsAdaptiveGroups`):

- Bật khi có `CLOUDFLARE_ACCOUNT_ID` và token chỉ có quyền Account Analytics: Read (`CLOUDFLARE_ANALYTICS_TOKEN`).
  Người dùng tự tạo token và đặt trong `.env.r2`.
- Đây là nguồn duy nhất biết số thao tác thật, kể cả lần CDN đọc R2 khi cache miss và lượt xem ảnh đối chứng. Nó cũng
  biết dung lượng thật của từng bucket, kể cả object mồ côi như upload bỏ dở.
- Kết quả được cache 15 phút. Chưa cấu hình hoặc lỗi thì trang vẫn hiện số liệu database.
- Cloudflare chỉ cập nhật dung lượng theo chu kỳ (lần chuyển ngày 15/11/2026 chưa hiện sau nửa giờ), nên dung lượng
  đầu trang lấy số lớn hơn giữa database và Cloudflare. Thao tác vẫn lấy số Cloudflare.

Không liệt kê object (ListObjects): đó là thao tác lớp A, phải mở rộng ADR-006, và chỉ biết bytes chứ không biết loại
hay số thao tác.

Mức cảnh báo mặc định là 80% và 95% mức miễn phí (`wiki.storage.capacity.*`). Một GB được tính là 10⁹ byte, vì trang giá
không định nghĩa và cách này cảnh báo sớm hơn. Tháng tính theo lịch UTC, có thể lệch chu kỳ hóa đơn thật.

### 10. Ước lượng trước mỗi đợt tải

- API ước lượng nhận danh sách tệp (SHA-256 nếu biết, kích thước) và đích (Media hoặc tệp nguồn).
- Trả số tệp mới, GB mới, thao tác lớp A/B, dung lượng sau khi tải và mức cảnh báo.
- Với tệp nguồn, bytes đã có được bỏ khỏi phần mới. Với Media, bytes đã có chỉ được báo trùng, vì asset mới vẫn lưu
  bản riêng.
- Admin hiện ước lượng trong khung tải tệp nguồn, trước khi người dùng bấm tải. Công cụ đồng bộ in ước lượng ở bước
  `plan`. Ảnh Media trong Admin được tải từng ảnh một, vài MB mỗi ảnh, nên không thêm bước ước lượng vào khung chọn ảnh
  dùng chung; tab Dung lượng R2 cho biết đang dùng bao nhiêu.

### 11. Ảnh công khai đi qua Media

- Mọi ảnh Wiki hiển thị là URL Media.
- Ngày 14/11/2026, bản xuất bản mới nhất của 131 tướng có 560 kỹ năng, nhưng chỉ 11 kỹ năng gắn icon.
- Từ 10/11/2026, chi tiết tướng công khai đã trả ảnh thư viện icon kỹ năng (V033) trong `skillMedia` cho kỹ năng chưa
  gắn icon, theo cùng quy tắc với Admin. Đối chiếu database: cả 549 kỹ năng còn lại đều ghép được đúng một ảnh thư viện.
  Ảnh Wiki đọc thẳng từ `resources/` qua plugin `skill-artwork` chỉ còn là lớp dự phòng thứ ba, sau ảnh gắn và ảnh
  thư viện.
- Vì vậy không cần API mới: Wiki bỏ plugin `skill-artwork` và lớp dự phòng theo tên tệp; image production và CI không
  còn chép thư mục ảnh chiêu. Quy tắc "public dùng ảnh gắn trong revision, thiếu thì dùng ảnh thư viện cùng slot và
  biến thể" được ghi vào 01 cho khớp với hành vi hiện có.
- Màn hình Admin đang đọc ảnh trong `resources/Lien-Quan-v3/assets` dùng URL Media, tra theo SHA-256.
- Ảnh công khai chưa là Media (6 icon vai trò, 2 GIF, 8 portrait lẻ) được xử lý theo bảng quyết định; không ép đổi GIF.

### 12. Một nơi quản lý tệp trong Admin

- Mục "Quản lý ảnh" hiện có đổi thành "Quản lý tệp", vẫn là lối vào duy nhất, gồm ba tab:
  - **Ảnh công khai**: màn hình Media hiện có, giữ bộ lọc, nơi dùng, nguồn, xóa ảnh không còn dùng.
  - **Tệp nguồn**: duyệt theo loại chức năng → bộ → tệp; xem trước ảnh, kích thước, nơi dùng, chỗ khác chứa cùng bytes;
    tải lên, thay và bỏ tệp có xác nhận; dọn bytes mồ côi.
  - **Dung lượng R2**: số liệu mục 9, so với gói miễn phí, kèm cảnh báo.
- Khung tải tệp nguồn hiện ước lượng (mục 10) trước khi người dùng bấm tải.
- Ảnh đối chứng vẫn hiện tại chỗ đang dùng (bảng "Ảnh gốc" của trang tướng, Sẵn sàng xuất bản, Build đề cử, Thống kê
  đấu hạng), nhưng lấy qua API thay vì middleware dev. Các middleware `/__patch-captures`, `/__shop-captures`,
  `/__build-captures`, `/__ranking-captures` và `/__resources` bị bỏ khi màn hình tương ứng đã chuyển xong.

### 13. Bỏ `resources/` khỏi git

- Mỗi giai đoạn đã kiểm chứng thì bỏ phần tương ứng bằng commit mới. Không viết lại lịch sử.
- Không xóa tệp cục bộ, nhất là `resources/raw`, khi người dùng chưa xác nhận sau khi bản trên R2 được kiểm chứng.
- `resources/raw/` và `resources/extracted/` được thêm vào `.gitignore` ngay, để `git add -A` không đưa 4,3 GB vào git.

### 14. Môi trường dev dùng thẳng R2

Người dùng không muốn tốn bộ nhớ cho SeaweedFS nữa, nhất là trên VPS 8 GB.

- Backend chạy local đọc cấu hình R2 từ tệp môi trường bị git bỏ qua (`.env` hoặc `.env.r2`), như máy phát triển đã
  làm từ 23/10/2026. `.env.example` mẫu sẵn cho R2.
- Dịch vụ `seaweedfs` trong `compose.yaml` của `wiki-service` chuyển sang profile `local-storage`. Spring Boot và
  `docker compose up` không tự bật nó nữa. Ai cần chạy không có mạng thì bật profile này và đặt lại biến `STORAGE_*`.
- Test tự động vẫn dùng SeaweedFS trong Testcontainers: container chỉ sống trong lúc test, và test không được ghi vào
  bucket thật đang phục vụ `img.athahub.com`.
- Stack chạy một máy trong `infra/` (ADR-021) chưa đổi trong đợt này: SeaweedFS ở đó còn gắn với reverse proxy, tạo
  bucket và sao lưu. Chuyển stack đó sang R2 là việc riêng.

### 15. Admin không còn đọc `resources/` (bổ sung 16/11/2026)

Giai đoạn 4 đổi từng chỗ còn đọc `/__resources` theo cách sau. Middleware `/__resources` bị bỏ.

- **Hộp tìm Ctrl-K** lấy trang bị và phù hiệu từ kho của backend, mở đúng mục ở trang Trang bị và Phù hiệu. API giả lập
  đọc `data/*.json` bị bỏ cùng các hook của nó.
- **Màn so sánh kỹ năng** lấy ảnh tham chiếu từ thư viện ảnh kỹ năng (Media, cùng quy tắc với màn Kỹ năng) thay cho
  `data/heroes.json` và `assets/skill`.
- **Nhập tướng** bỏ nút ghép ảnh từ tài nguyên. 131 tướng đã nhập và ảnh đã là Media. CDN công khai không trả CORS, nên
  trình duyệt không thể tải lại bytes để upload, còn chép 0,9 GB ảnh tướng sang tệp nguồn thì tốn mà không có ích. Nhập từ
  bộ ảnh chụp, thư mục và ZIP vẫn giữ.
- **Nhập chế độ chơi và cẩm nang Cờ Liên quân** đọc JSON và ảnh qua link ký sẵn từ bộ `sanh-che-do` và
  `co-lien-quan-2026-11-08-1503`, nên chạy được cả trên bản build. Bộ tệp nguồn giữ nguyên bố cục thư mục
  `che-do-choi` cũ. Ảnh sảnh đã xử lý và icon Bách khoa vì vậy có thêm bản sao trong bộ của lượt chụp (456 tệp, 240
  nội dung, 37 MB), dù đã là Media.
- **Script và test dữ liệu** (nhập giải đấu, chế độ chơi, script trong `research/`) đọc bản kéo về đúng chỗ cũ trong
  `resources/` bằng `pnpm sources:sync pull`. Git bỏ qua bản kéo về. Test tự bỏ qua khi chưa kéo dữ liệu.
- 10 ảnh công khai chưa là Media (2 GIF, 8 portrait chưa khớp trang phục) vào bộ `lien-quan-v3-data`. 6 icon vai trò bỏ,
  vì bản giống hệt đã nằm trong `admin-aov/public/images/hero/vai-tro/`.

## Hệ quả

- Ước tính sau khi chuyển: Media 1,08 GB, ảnh đối chứng khoảng 3,2 GB (2.354 ảnh), dữ liệu nhập khoảng 0,08 GB.
  Tổng khoảng 4,4 GB, bằng 44% mức miễn phí. Nếu giữ thêm năm tệp ZIP gốc thì cộng 2,29 GB, lên khoảng 67%.
- Chuyển khoảng 3.000 tệp tốn chừng 6.000 thao tác lớp A và 9.000 lớp B, tức 0,6% và 0,09% mức miễn phí của một tháng.
- Bản Admin đã build xem được ảnh đối chứng; Wiki build không còn cần `resources/`.
- Bỏ khỏi HEAD không xóa ảnh khỏi lịch sử git. Kho công khai vẫn cho tải ảnh ở commit cũ, cho tới khi kho chuyển sang
  riêng tư hoặc lịch sử được viết lại. Cả hai là quyết định của chủ dự án, ngoài phạm vi ADR này.
- Thêm một bucket, một token tùy chọn và bốn bảng. Media vẫn là module duy nhất chạm object storage.

## Kiểm chứng

- Test tích hợp với SeaweedFS: upload, complete đúng và sai SHA-256, bytes trùng, thay đường dẫn, xóa bytes mồ côi,
  định tuyến `sources/` sang bucket riêng, URL ký sẵn có tên tải về, quyền `catalog:read` và `media:write`.
- Test đơn vị cho báo cáo dung lượng, ước lượng, ánh xạ thao tác Cloudflare sang lớp A/B và mức cảnh báo.
- Smoke test trên R2 thật trước khi chuyển dữ liệu: copy giữa bucket, CORS GET từ origin Admin, URL hết hạn bị từ chối.
- Wiki build sạch trong một bản checkout không có `resources/`.

## Phụ lục A — Bảng quyết định cho `resources/`

Số liệu đo ngày 14/11/2026. "Đã trên R2" nghĩa là SHA-256 của tệp trùng một phiên bản Media còn bytes. Đường dẫn
trong bộ giữ nguyên đường dẫn dưới `resources/`; tệp trong ZIP thành thư mục mang tên ZIP. "Dev" là chỉ chạy trong
Vite dev; bản build trả 404.

### Đang nằm trong git

| Thư mục | Tệp · dung lượng | Đã trên R2 | Ai đang dùng | Loại | Chuyển tới | Việc trước khi bỏ khỏi git | Giai đoạn |
|---|---|---|---|---|---|---|---|
| `Lien-Quan-v3/assets/skill` | 603 · 18 MB | 603 | Wiki (plugin `skill-artwork`, cả dev lẫn bản build): lớp dự phòng thứ ba, sau ảnh gắn và ảnh thư viện trong `skillMedia`. Image production và CI chép thư mục vào `dist`. Admin so sánh icon (dev). `import-skill-images.py` | Công khai | Giữ Media hiện có (thư viện icon kỹ năng) | Wiki chỉ dùng `skillMedia` (đã có ảnh thư viện); bỏ plugin và build context | 2 |
| `Lien-Quan-v3/assets/hero` | 657 · 102 MB | 656 | Admin nhập tướng (dev), `import-images.py` | Công khai | Giữ Media hiện có | 1 GIF chưa là Media → bộ `lien-quan-v3-data` | 4 |
| `Lien-Quan-v3/assets/skin` | 4.720 · 818 MB | 4.711 | Admin nhập tướng (dev), `import-images.py` | Công khai | Giữ Media hiện có | 1 GIF và 8 portrait chưa khớp trang phục → bộ `lien-quan-v3-data` | 4 |
| `Lien-Quan-v3/assets/trang-bi`, `phu-hieu`, `ngoc`, `phu-tro` | 255 · 11 MB | 255 | Hộp tìm Ctrl-K của Admin (dev, đọc JSON giả lập), `import-warehouse.py` | Công khai | Giữ Media hiện có | Ctrl-K đọc API kho trang bị | 4 |
| `Lien-Quan-v3/assets/vai-tro` | 6 · < 0,1 MB | 0 | Không ai. Bản giống hệt đã có ở `admin-aov/public/images/hero/vai-tro/` | Bỏ | — | — | 4 |
| `Lien-Quan-v3/che-do-choi`: icon Cờ Liên quân (`anh-goc/`) và ảnh sảnh đã xử lý (`da-xu-ly/`) | 456 · 41 MB | 456 | Admin nhập chế độ chơi và Cờ Liên quân (dev) | Công khai | Giữ Media hiện có, thêm bản sao trong bộ của lượt chụp (mục 15) | Trình nhập đọc JSON và ảnh từ bộ tệp nguồn | 4 |
| `Lien-Quan-v3/che-do-choi/co-lien-quan`: ảnh chụp trang bách khoa (bốn lượt chụp) | 407 · 263 MB | 0 | Không mã nào đọc | Đối chứng | `GAME_MODE_SOURCE`, mỗi lượt một bộ, ví dụ `co-lien-quan-2026-11-08-1503` | — | 3 |
| `Lien-Quan-v3/che-do-choi/sanh-che-do/goc-da-che-uid` | 20 · 5 MB | 0 | Không mã nào đọc | Đối chứng | `GAME_MODE_SOURCE` `sanh-che-do` | — | 3 |
| `Lien-Quan-v3/che-do-choi`: JSON, Markdown, văn bản | 16 · 0,8 MB | — | Admin chế độ chơi và Cờ Liên quân (dev), test `game-modes` | Dữ liệu nhập | Tệp của lượt chụp nào vào bộ của lượt đó (kể cả `du-lieu/<lượt>.json`); `che-do.json` và `README.md` vào bộ `sanh-che-do` | Trình nhập và test đọc bộ đã kéo về | 4 |
| `Lien-Quan-v3/data` | 27 · 10 MB | — | Admin nhập tướng, so sánh icon, Ctrl-K (dev). `import-images.py`, `import-skill-images.py`, `import-warehouse.py`, `sync-media-sources.py` | Dữ liệu nhập | `IMPORT_DATA` `lien-quan-v3-data` | Admin không còn đọc (mục 15); script đọc bản kéo về | 4 |
| `Lien-Quan-v3/note` | 9 · < 0,1 MB | — | Người đọc: hướng dẫn thu thập và nguồn | Dữ liệu nhập | Bộ `lien-quan-v3-data` | — | 4 |
| `Lien-Quan-v3/program` | 26 · 1,3 MB | — | Công cụ cũ tự ghi vào `data/` (sửa trang bị, quản lý portrait), đã có màn hình Admin thay | Bỏ | — | — | 4 |
| `Lien-Quan-v3/preview` | 10 · 0,3 MB | — | Trang HTML xem `data/` | Bỏ | — | — | 4 |
| `Lien-Quan-v3/temp` | 9 · 1,6 MB | 0 | Chỉ có tên trong `data/danh-sach-tai-nguyen.json` | Bỏ | — | — | 4 |
| `esports/2026-post-apl`: JSON, Markdown, văn bản | 83 · 1,6 MB | — | `community-service/scripts/import-collected-metadata.py`, test `registry-import` | Dữ liệu nhập | `ESPORTS_SOURCE` `esports-2026-post-apl` | Script và test đọc bộ đã kéo về | 4 |
| `esports/2026-post-apl`: ảnh | 83 · 15 MB | 10 | Không mã nào đọc | Đối chứng | Cùng bộ `esports-2026-post-apl` | — | 4 |

### Ngoài git, chỉ có ở checkout chính

| Thư mục | Tệp · dung lượng | Ai đang dùng | Loại | Chuyển tới | Giai đoạn |
|---|---|---|---|---|---|
| `raw/*.zip` (năm ZIP) cùng `extracted/2026-s4/2026-10-30` | 1.305 ảnh và 190 JSON trong ZIP · 2,29 GB; 275 tệp review · 66 MB | Admin "Ảnh gốc" theo patch, trang Sẵn sàng xuất bản (dev); công cụ review | Đối chứng và dữ liệu nhập | `HERO_CAPTURE` `hero-capture-2026-10-30`: ảnh tách khỏi ZIP, review JSON và manifest dẫn xuất | 3 |
| Chính các tệp ZIP | 5 · 2,29 GB | Middleware dev đọc ảnh bên trong | Lưu trữ | Đề xuất **không** lưu thêm, vì từng ảnh đã nằm trong bộ trên; lưu thì thêm 2,29 GB | 3 |
| `raw/shop/2026-09-16` và `extracted/shop/2026-09-16` | 269 · 261 MB | Admin "Ảnh gốc · cửa hàng" (dev), CLI `shop-captures:import` | Đối chứng | `SHOP_CAPTURE` `shop-2026-09-16` | 3 |
| `raw/builds/2026-11-11` và `extracted/builds/2026-11-11` | 212 · 289 MB | Admin `/builds` (dev) | Đối chứng | `BUILD_CAPTURE` `builds-2026-11-11` | 3 |
| `raw/ranking/2026-11-11` và `extracted/ranking/2026-11-11` | 90 · 83 MB | Admin `/ranking` (dev) | Đối chứng | `RANKING_CAPTURE` `ranking-2026-11-11` | 3 |
| `extracted/2026-s4/2026-10-30/tools/.local-state` | 1.117 · 1,34 GB | Ảnh xem trước do công cụ review sinh ra | Bỏ | Không tải lên; đã bị git bỏ qua | — |
| `Lien-Quan-v3/*.log`, `*.pyc`, `*.pid` | 4 · < 0,1 MB | Tệp chạy tạm | Bỏ | — | — |

Tệp ngoài git không bị xóa khỏi máy. Sau khi bản trên R2 được kiểm chứng, người dùng quyết định có xóa bản cục bộ hay
không.

### Tổng sau khi chuyển

| Phần | Tệp | Dung lượng |
|---|---|---|
| Media công khai, không đổi | 6.886 phiên bản | 1,08 GB |
| Ảnh đối chứng mới | khoảng 2.350 | khoảng 3,2 GB |
| Dữ liệu nhập mới | khoảng 600 | khoảng 0,08 GB |
| **Tổng** | | **khoảng 4,4 GB, 44% mức miễn phí** |

## Tham khảo

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/platform/metrics-analytics/
- https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/
