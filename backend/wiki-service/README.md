# WikiAOV — wiki-service

Backend Java 21, Spring Boot 4.1.1, Maven Wrapper. Một ứng dụng Spring Modulith phục vụ admin và
wiki, dùng PostgreSQL, Keycloak, object storage tương thích S3 và Redis cache tùy chọn.

Đọc [chỉ mục backend](../README.md), [đặc tả và ADR](../docs/README.md), hoặc
[hướng dẫn application services](../docs/TAI-CAU-TRUC-APPLICATION-SERVICES.md) để hiểu thiết kế.
Quy tắc tổ chức hiện hành nằm trong [ADR-013](../docs/adr/ADR-013-backend-organization.md).

## Chạy local

Cần JDK 21 đầy đủ và Docker đang chạy. Từ `backend/wiki-service`:

```powershell
Copy-Item .env.example .env
docker compose --profile identity up -d
./scripts/dev/start-local.ps1
```

Chỉ tạo `.env` khi chưa có file riêng; không ghi đè secret hoặc cấu hình đang sử dụng. Keycloak
thuộc profile Compose `identity`; Spring Boot profile `local` khởi động các dependency mặc định và
giữ chúng chạy khi ứng dụng dừng. Bucket Media được tạo nếu chưa có ở local.

Launcher đọc `.env` thành giá trị literal, giữ biến đã export trong process làm ưu tiên. Có thể
chọn file khác bằng `-EnvironmentFile <path>` hoặc dùng `-DryRun` để xem lệnh và **tên** biến mà
không in giá trị. Không chạy biểu thức PowerShell trong `.env`; môi trường process được khôi phục
sau khi ứng dụng kết thúc. Các biến `DB_*` tường minh được giữ nguyên; nếu thiếu, launcher lấy
fallback từ `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` cho kết nối local.

Lệnh Maven/IDE cũ vẫn dùng được, nhưng không tự đọc `.env`:

```powershell
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Nếu thay credentials PostgreSQL trong Compose, cần cấp cùng `DB_*` cho process chạy trực tiếp.
Không reset volume để đổi cấu hình hoặc nạp lại realm.

| Thành phần | Địa chỉ local mặc định |
|---|---|
| API | `http://localhost:8080/api/wiki/v1` |
| PostgreSQL | `localhost:5432`, database `wiki` |
| SeaweedFS S3 / filer | `http://localhost:8333` / `http://localhost:8888` |
| Keycloak | `http://localhost:8081` |
| Redis | `localhost:6379` |

Compose mặc định bind loopback. Tài nguyên local nằm trong
[`infra/local/`](infra/local/); không sử dụng các credentials mẫu cho production. Tên dịch vụ và
volume giữ nguyên sau khi sắp xếp thư mục.

## Cấu hình và profile

| Vị trí | Vai trò |
|---|---|
| [`config/application.yml`](src/main/resources/config/application.yml) | Cấu hình Spring chung và biến môi trường |
| [`config/application-local.yml`](src/main/resources/config/application-local.yml) | Default local, Compose và tạo bucket |
| [`config/application-prod.yml`](src/main/resources/config/application-prod.yml) | Log JSON, hạn chế chi tiết health |
| [`config/application-test.yml`](src/main/resources/config/application-test.yml) | Cấu hình kiểm thử, không dùng dependency dev |
| [`.env.example`](.env.example) | Mẫu local cho Compose và launcher; `.env` không được commit |
| [`config/format/eclipse-formatter.xml`](config/format/eclipse-formatter.xml) | Format Java được Maven/hook dùng chung |

Các file `application*.yml` nằm trong `src/main/resources/config/`, được Spring Boot tự tìm trên
classpath. Production dùng profile `prod` và cấp cấu hình từ môi trường triển khai:

| Nhóm biến | Ý nghĩa |
|---|---|
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL của môi trường tương ứng |
| `JWT_ISSUER_URI`, `JWT_AUDIENCE`, `JWT_RESOURCE_CLIENT_ID` | Issuer, audience và client mang capability |
| `ADMIN_ORIGIN`, `ADMIN_BASE_PATH` | Nguồn và đường dẫn frontend admin được phép dùng auth |
| `ADMIN_AUTH_CLIENT_ID`, `ADMIN_AUTH_CLIENT_SECRET`, `GOOGLE_LOGIN_ENABLED` | Confidential client của backend và tùy chọn Google |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET` | Object storage S3-compatible |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PATH_STYLE` | Credentials và cách đánh địa chỉ S3 |
| `MEDIA_PUBLIC_BASE_URL` | Prefix phân phối `assets/` qua proxy/CDN |
| `USER_DEFAULT_LOCALE`, `USER_DEFAULT_TIME_ZONE` | Default hồ sơ trước khi người dùng tự chỉnh |

`ddl-auto` giữ `validate`; Flyway migrations ở `src/main/resources/db/migration` là nguồn thay đổi
schema. Chỉ profile local tự tạo bucket; production cần chuẩn bị storage và quyền phù hợp.

## Cấu trúc mã theo chức năng

Module lớn đặt chức năng trước tầng: `com.wikiaov.<module>.internal.<capability>`, bên trong mới có
`application`, `domain`, `persistence/entity` hoặc `infrastructure` khi cần. Ví dụ:

```text
patch/internal/
├── web/                         contract/controller HTTP giữ ổn định
├── application/                 HTTP command/response DTO và lỗi cấp module giữ FQN
├── season/
│   ├── application/              quản lý mùa và lịch mùa
│   ├── domain/                   quy tắc ngày/giờ và khoảng thời gian
│   └── persistence/             repository thuộc mùa
│       └── entity/              entity thuộc mùa
├── ruleset/                     thị trường, bộ quy tắc và assignment
├── authoring/                   patch, variant và bản dịch
├── release/                     lịch phát hành và xác nhận
├── context/                     context và read model tổng quan
└── review/                      trạng thái rà soát nhập liệu
```

| Module | Những nhóm chính để tìm mã |
|---|---|
| Hero | `authoring`, `catalog`, `importing`, `comparison`, `reference`, `change`; snapshot ở `profile`, `ratings`, `stats`, `skills`, `skins`, `media`, dùng lifecycle/source của `sections`; nhãn ở `badges` |
| Item, Arcana, Enchantment, Spell | `catalog`, `change`, `reference`; `metadata` cho nhóm trang bị/hệ phù hiệu khi cần |
| Media | `asset`, `upload`, `ingestion`, `query`, `provenance`, `storage`; guard ghi dùng chung có giới hạn ở `shared/application` |
| Terminology, User | `reference`/`settings` và `profile` tương ứng |
| Platform | Cache/read model ở `cache`; wiring/web và chính sách dùng chung theo phạm vi riêng |

Các public contract vẫn ở gốc module. Controller và `*Api` giữ tại `internal/web`; HTTP command/
response DTO và content record đã serialize có thể giữ tại `internal/application`/`internal/domain`
để bảo toàn tên schema OpenAPI và JSON. Module nhỏ gắn kết như Access có thể giữ cấu trúc tầng hiện
tại; không tạo đủ mọi tầng hoặc gom mọi dữ liệu vào `shared` chỉ để có cây thư mục cân đối.

Facade giữ quyền/transaction và gọi cộng tác viên theo chức năng. CRUD và query thông thường dùng
Spring Data JPA, projection, `@Query`, `@Lock` và Specifications. Custom Criteria fragment phục vụ
truy vấn động thực sự phức tạp; native adapter được giới hạn như khóa bảng mùa còn rỗng. Không cung
cấp `rows(sql)`, `write(sql)` hoặc `lock(Class,id)` cho application dưới tên một store khác.
Chi tiết ownership và luồng đọc mã theo [hướng dẫn application services](../docs/TAI-CAU-TRUC-APPLICATION-SERVICES.md).

## Đăng nhập và quyền

Keycloak import realm từ [`infra/local/keycloak/wikiaov-realm.json`](infra/local/keycloak/wikiaov-realm.json)
ở lần khởi tạo đầu. Import không tự sửa realm trong volume đã tồn tại. Dùng Admin API/Console để
cập nhật có chủ đích; không xóa volume để áp dụng file mới.

Backend kiểm tra capability từ `resource_access.<JWT_RESOURCE_CLIENT_ID>.roles`, mặc định client
`wiki-service`. Realm local có các vai trò tổng hợp `wiki-admin`, `wiki-publisher`, `wiki-editor`
và service account `wiki-importer`. Tài khoản và credentials mẫu chỉ dành cho local, được khai báo
trong file realm; không dùng chúng ở môi trường công khai.

Form tài khoản của admin gọi `/api/wiki/v1/auth/login`; Google mở cửa sổ xác thực riêng qua backend.
Access token ở bộ nhớ frontend; refresh token ở cookie HttpOnly. Các POST auth yêu cầu Origin đúng
và `X-AOV-Auth: 1`. Client secret nằm ở backend, không đưa vào frontend/Git. Xem
[ADR-007](../docs/adr/ADR-007-admin-auth-gateway.md) và [hướng dẫn admin](../../frontend/apps/admin-aov/README.md)
cho cấu hình confidential client, Google và audience. Thay đổi quyền cần đăng nhập lại để lấy token mới.

Đồng bộ quyền quản lý hồ sơ cho realm hiện có:

```powershell
./scripts/sync-user-roles.ps1
```

Script hỏi `PSCredential` của quản trị realm `master`, bổ sung `user:read`/`user:write` còn thiếu vào
client, role tổng hợp và tài khoản đích. Chạy lại không tạo trùng, không đổi mật khẩu hoặc xóa quyền
hiện có. Có thể truyền `-ServerUrl`, `-Realm`, `-TargetUsername`, `-Credential`; máy chủ ngoài local
phải dùng HTTPS. Đây không phải công cụ đồng bộ toàn bộ realm.

## API và OpenAPI

URL API dùng `/api/wiki/v1/...`; controller khai báo `ApiPaths.ROOT`/`ApiPaths.ADMIN` và
`version = "1"`, không chép cứng `v1` vào mapping. Phiên bản không hỗ trợ trả
`400 INVALID_API_VERSION`. Lỗi trả `application/problem+json`, `code`, `requestId` và
`context`/`errors[]` khi có; header `X-Request-Id` nối với log. Mã lỗi thuộc module và phải duy nhất.

OpenAPI được sinh từ interface `*Api` cạnh controller:

- JSON: `GET /api/wiki/v1/admin/openapi`.
- YAML: `GET /api/wiki/v1/admin/openapi.yaml`.
- Cần Bearer token có `catalog:read`; không mở Swagger UI hay đường docs công khai.
- Interface sở hữu mô tả và constraint tham số; controller giữ mapping/binding, use case giữ quyền.
  Response dạng map vẫn là cấu trúc mở, không bị ép thành DTO suy đoán để phục vụ tài liệu.
- Kiểm thử tích hợp ghi bản đã đối chiếu vào `target/openapi/wiki-v1.json`; CI kiểm tra đặc tả và
  lưu artifact. `hero-authoring.openapi.json` là hợp đồng authoring riêng, không thay thế toàn bộ OpenAPI.

Admin hiện dùng các trang `/hero`, `/hero/media`, `/items`, `/enchantments`, `/arcana`, `/spells`,
`/game-configuration`, `/image-management`, `/terminology`, `/profile`, `/users`. Đây là route
frontend, tách khỏi path HTTP API.

Các catalog quản lý identity, bản nháp/revision và bản dịch; gameplay và văn bản dịch tách biệt.
Ruleset giữ bộ quy tắc dùng chung, mùa nhóm nhiều patch, release xác định lịch áp dụng theo thị
trường. Dữ liệu nền là mốc quan sát, không tự khẳng định đối tượng vừa được thêm hoặc đổi ở patch
đó. Import Hero chuẩn bị nháp và giữ lịch sử tác vụ; xuất bản và ghi changelog là thao tác riêng.
Chi tiết luồng và trường bắt buộc theo [01](../docs/01-BAN-DAC-TA-DU-AN.md),
[02](../docs/02-DATABASE-DU-AN.md), [03](../docs/03-API-DU-AN.md).

Media upload đi trực tiếp bằng presigned URL vào `incoming/`, rồi `complete` kiểm tra và chuyển sang
key `assets/` bất biến. Các module giữ asset ID và báo usage qua public contract; nâng phiên bản
bytes ảnh không tự tạo revision gameplay mới. Thư viện icon kỹ năng có thể giữ ảnh chưa có mô tả
hoặc chưa ghép identity kỹ năng.

## Kiểm thử và cổng chất lượng

```powershell
./mvnw.cmd spotless:apply
./mvnw.cmd clean verify
./scripts/dev/test-start-local.ps1
./scripts/dev/start-local.ps1 -DryRun
```

Dùng JDK đầy đủ cho kiểm thử hợp đồng có compiler API. `verify` chạy compile, test, đóng gói JAR
và kiểm tra Spotless. Docker cần cho PostgreSQL/SeaweedFS integration; một số bài cũ tự skip khi
thiếu Docker, còn OpenAPI integration yêu cầu Docker. Luôn xem số chạy/skip/failure trong
`<build directory>/surefire-reports/` của lần chạy hiện tại; không coi skip là đã kiểm chứng hoặc dùng
kết quả của cây mã nguồn cũ để kết luận cho bản mới.

Output mặc định là `target/`, do property `wiki.build.directory` quản lý. Khi JDT/IDE biên dịch nền
cũng ghi vào đó, có thể tách output kiểm chứng của Maven bằng đường dẫn tuyệt đối:

```powershell
$verificationDirectory = Join-Path $PWD.Path ".local-state/verification/target"
./mvnw.cmd "-Dwiki.build.directory=$verificationDirectory" clean verify
```

Lượt này ghi class và JAR dưới `.local-state/verification/target/`, báo cáo ở
`.local-state/verification/target/surefire-reports/`; mặc định vẫn là `target/surefire-reports/`.
Giữ tên thư mục cuối là `target`: ArchUnit 1.4.2 nhận diện test class từ mẫu `target/test-classes/`
để `DoNotIncludeTests` hoạt động đúng. Không sửa hoặc nới lỏng kiểm tra kiến trúc để dùng output khác.
Các test OpenAPI hiện ghi riêng vào `target/openapi/wiki-v1.json` và
`target/openapi-mvc/`, kể cả khi chọn build directory khác. CI dùng output mặc định nên đường dẫn
artifact của CI giữ nguyên. Giữ source/configuration ổn định trong lúc verify, không chạy nhiều build
cùng ghi vào một output.

Formatter Java giữ bốn space, 120 cột, comment nguyên nội dung, một dòng trống giữa các phương
thức/constructor và giữa khối field với constructor, kể cả phương thức abstract của repository.
Trong hàm, người viết nhóm các pha
validation, đọc/khóa, quyết định, ghi/audit và kết quả bằng một dòng trống; không xuống dòng trống sau
từng lệnh. Mã AI tạo cũng tuân theo quy tắc này; formatter không tự phân tích ý nghĩa nghiệp vụ.

| Cổng | Bảo vệ |
|---|---|
| `ModuleArchitectureTests`, `LayerArchitectureTests` | Ranh giới module, dependency cycle và chiều phụ thuộc nội bộ |
| `ErrorCodeUniquenessTests`, kiểm thử lỗi/security | Mã lỗi, versioning, validation và phân quyền |
| Catalog/Hero/Patch workflow tests | Thứ tự validation/khóa, no-op, version, audit và tính nguyên tử |
| `ApiInterfaceContractTest`, `OpenApiMvcTest`, `OpenApiIntegrationTest` | Hợp đồng interface, binding, validation, security và đặc tả sinh thực tế |
| Testcontainers integration | Migration, JPA, PostgreSQL và object storage thực |
| `test-start-local.ps1` | Đọc môi trường literal, ưu tiên biến và không lộ secret qua dry run |

Database test ngoài chỉ dùng khi bộ test hỗ trợ `WIKI_TEST_DB_URL`; đó phải là database tách biệt,
không trỏ vào database dev/production. Một số test truncate dữ liệu.

## Cache và vận hành

Redis cache JSON read model cho danh mục/thuật ngữ/tham chiếu; không giữ bytes ảnh, token, phiên
đăng nhập hoặc hồ sơ cá nhân. Local bật mặc định, môi trường khác mặc định tắt. PostgreSQL epoch
được cập nhật cùng transaction thay đổi catalog; patch hiện hành được giải quyết trước lookup.
Redis lỗi thì đọc DB và backoff, không biến cache tùy chọn thành điều kiện readiness. Xem
[ADR-012](../docs/adr/ADR-012-reference-read-model-cache.md).

| Biến | Mặc định |
|---|---|
| `READ_MODEL_CACHE_ENABLED` | `true` ở local, `false` ở profile khác |
| `READ_MODEL_CACHE_PREFIX` | `wiki:read-model:v1` |
| `READ_MODEL_CACHE_PUBLIC_TTL`, `READ_MODEL_CACHE_ADMIN_TTL` | `2m`, `30s` |
| `READ_MODEL_CACHE_RETRY_DELAY`, `READ_MODEL_CACHE_MAX_VALUE_BYTES` | `5s`, `8388608` |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_SSL` | `localhost`, `6379`, `false` |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | Rỗng; production cấp riêng qua môi trường |
| `REDIS_TIMEOUT`, `REDIS_CONNECT_TIMEOUT` | `200ms`, `200ms` |

Compose giới hạn Redis local, không lưu bền; có thể chạy riêng bằng `docker compose up -d redis`.
Counter `wiki.read.model.cache` có tag `result=hit|miss|bypass|error`. Health/info thuộc Actuator;
production không công khai thông tin chi tiết. Log chứa request ID, không ghi token/secret.

## Công cụ bảo trì và dữ liệu nguồn

`scripts/publish-arcana-baseline.ps1 -PatchCode <code>` dùng `WIKI_API_TOKEN` đã có quyền
`arcana:write`/`arcana:publish`, mặc định chỉ kiểm tra. Thêm `-Apply` mới gán mốc quan sát và xuất
bản nháp `DATA_BASELINE` đủ nội dung. Script không đoán số liệu, không đổi mốc khác đã gán và không
sửa bản published; báo cáo ở `.local-state/arcana-publication-result.json`. Sao lưu DB trước khi apply.

Công cụ thu thập/import tái lập nằm ở [`research/`](../../research/), gồm thư viện ảnh nhân vật/kỹ
năng và kho trang bị. Chỉ upload ảnh đã ánh xạ, giữ checkpoint cục bộ được Git bỏ qua. Migrations
không chứa gameplay giả để làm đẹp giao diện. Không commit log, checkpoint, PID hoặc `.env`.

## Lưu ảnh trên Cloudflare R2

Cấu hình hai kho ảnh công khai/vùng tạm riêng tư, CORS và quy trình chuyển dữ liệu có trong [hướng dẫn R2](infra/cloudflare/README.md). Quyết định kiến trúc: [ADR-014](../docs/adr/ADR-014-public-assets-private-staging.md).
