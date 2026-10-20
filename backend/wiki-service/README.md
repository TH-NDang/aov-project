# WikiAOV — wiki-service

Backend AOV Wiki: Java 21, Spring Boot 4.1.1, Maven Wrapper.
Đặc tả hiện hành nằm ở [backend/docs](../docs/01-BAN-DAC-TA-DU-AN.md); bộ 01/02/03 ưu tiên hơn NOTE.

## Cấu trúc

Một deployable JAR, package gốc `com.wikiaov`. Mỗi domain có public contract tại package gốc và phần triển khai trong `internal/{web,application,domain,persistence,infrastructure}`.
Module: hero, media, patch, item, arcana, spell, enchantment, gamemode, query, access, platform.
Chỉ gọi public contract giữa các module. Không dùng entity/repository nội bộ của module khác.

| Module | Đã có |
|---|---|
| `platform` | Mô hình lỗi (`ApiErrorCode`, `ApiException`, `ProblemDetails`), API versioning, `ApiPaths`, `PageSlice`, `QueryParameters`, `X-Request-Id`, admin `no-store`, bean `Clock` |
| `access` | Security (JWT Keycloak), `Actor` / `CurrentActor`, `Capabilities`, `AuditLog` (bảng `access.audit_event`) |
| `media` | ObjectStorage/S3, upload/version/activate, validation, provenance và reverse usage |
| `patch` | Region, ruleset timeline, patch/variant/release và gameplay context resolver |
| `hero` | Identity, sáu section revisions, draft/fork/publish/discard, public reads và change sets |
| `query` | Patch page và tổng hợp thay đổi Hero qua public contracts |
| `user` | Hồ sơ dùng chung, preferences và avatar |

## Chạy local

Cần JDK 21 và Docker đang chạy. Từ thư mục service:

```powershell
Copy-Item .env.example .env
docker compose --profile identity up -d          # Keycloak (realm wikiaov được import tự động)
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Spring Boot tự khởi động PostgreSQL và SeaweedFS (object storage S3-compatible) qua Compose; bucket `wiki-media` được tạo khi khởi động ở profile local.

| Dịch vụ | Địa chỉ |
|---|---|
| API | http://localhost:8080/api/wiki/v1 |
| PostgreSQL | localhost:5432, database `wiki` |
| SeaweedFS | S3 API http://localhost:8333 (key trong `seaweedfs/s3.json`), filer UI xem file http://localhost:8888 |
| Keycloak | http://localhost:8081 (admin console: `admin` / `admin-local`) |

Realm được import từ `keycloak/wikiaov-realm.json` ở lần chạy đầu. File import không tự cập nhật realm đang tồn tại; giữ volume và cập nhật qua Admin API.

### Cập nhật quyền quản lý hồ sơ

Với Keycloak đang chạy, thực hiện từ `backend/wiki-service`:

```powershell
./scripts/sync-user-roles.ps1
```

Script hỏi thông tin quản trị của realm `master`, tạo `user:read` và `user:write` còn thiếu trong client
`wiki-service`, bổ sung vào `wiki-admin`, rồi bảo đảm tài khoản `admin` có hai quyền này.
Chạy lại không tạo trùng hoặc xóa quyền hiện có; không đổi mật khẩu hay tạo lại tài khoản.
Sau khi thành công, đăng xuất và đăng nhập lại admin để lấy quyền mới.

Có thể truyền `-ServerUrl`, `-Realm`, `-TargetUsername` và `-Credential` (PowerShell `PSCredential`).
Máy chủ ngoài local phải dùng HTTPS. Không ghi mật khẩu hoặc token vào script.
Script chỉ đồng bộ quyền hồ sơ, không đồng bộ toàn bộ cấu hình realm. Kiểm tra cuối dùng quyền hiệu lực
qua [Keycloak Admin REST API](https://www.keycloak.org/docs-api/26.2.5/rest-api/).

## Đăng nhập và quyền (local)

Backend chỉ kiểm tra **capability** (`hero:write`, `hero:publish`…), đọc từ `resource_access.wiki-service.roles` trong token. Vai trò là role tổng hợp trên Keycloak:

| Tài khoản local | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `admin-local` | `wiki-admin` — mọi quyền |
| `publisher` | `publisher-local` | `wiki-publisher` — sửa + publish |
| `editor` | `editor-local` | `wiki-editor` — sửa draft, upload media |
| client `wiki-importer` | secret `wiki-importer-local-secret` | service account cho script import |

Lấy token để thử admin API bằng PowerShell:

```powershell
$token = (Invoke-RestMethod -Method Post `
  -Uri http://localhost:8081/realms/wikiaov/protocol/openid-connect/token `
  -Body @{ client_id = 'wiki-local-cli'; grant_type = 'password'; username = 'admin'; password = 'admin-local' }).access_token
Invoke-RestMethod -Uri http://localhost:8080/api/wiki/v1/admin/... -Headers @{ Authorization = "Bearer $token" }
```

Client `wiki-local-cli` (password grant) và mọi mật khẩu trên chỉ dùng ở local.

## API versioning

URL có dạng `/api/wiki/v1/...`; phiên bản được Spring MVC 7 đọc từ segment thứ 3 của path.

```java
@RestController
@RequestMapping(path = ApiPaths.ROOT + "/heroes", version = "1")   // ROOT = /api/wiki/{apiVersion}
class HeroPublicController { ... }
```

Phiên bản chưa hỗ trợ (`/api/wiki/v2/...`) trả `400 INVALID_API_VERSION`. Chi tiết: `03-API-DU-AN.md` mục 1.1.

## Lỗi API

Mọi lỗi trả `application/problem+json` với `Cache-Control: no-store`:

```json
{ "status": 409, "title": "Revision version conflict", "detail": "The draft has changed.",
  "instance": "/api/wiki/v1/...", "code": "HERO_REVISION_VERSION_CONFLICT", "requestId": "…",
  "context": { "currentVersion": 9 } }
```

Cách dùng trong code:

```java
// Each module owns an enum of its codes (in internal/application).
public enum HeroErrorCode implements ApiErrorCode {
    HERO_NOT_FOUND(HttpStatus.NOT_FOUND, "Hero not found");
    // status + title fields
}

throw new ApiException(HeroErrorCode.HERO_NOT_FOUND, "Hero " + heroId + " was not found.");
```

- Mã chung (`INVALID_REQUEST`, `INVALID_QUERY_PARAMETER`, `INVALID_API_VERSION`, `UNAUTHENTICATED`…) nằm ở `PlatformErrorCode`.
- Lỗi validation, field JSON lạ, query parameter sai đều có `errors[]` gồm `path`, `code`, `message`.
- `requestId` do server sinh, trùng header `X-Request-Id` và có trong mọi dòng log của request.
- Mã phải duy nhất giữa các module; `ErrorCodeUniquenessTests` kiểm tra điều này.

## Kiểm tra

```powershell
./mvnw.cmd clean verify
```

| Test | Cần Docker |
|---|---|
| Kiến trúc module, mã lỗi duy nhất, bảng lỗi (`ProblemDetailsExceptionHandlerTest`), `/error`, request id, ma trận quyền + versioning, converter JWT, `CurrentActor`, `QueryParameters` | Không |
| `WikiAovApplicationTests`, `JdbcAuditLogIntegrationTest` (PostgreSQL), `S3ObjectStorageIntegrationTest` (SeaweedFS) | Có — tự bỏ qua khi không có Docker |

## Biến môi trường production

| Biến | Ví dụ |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` (log JSON) |
| `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | `jdbc:postgresql://db:5432/wiki` |
| `JWT_ISSUER_URI` | `https://auth.example.com/realms/wikiaov` |
| `JWT_AUDIENCE`, `JWT_RESOURCE_CLIENT_ID` | `wiki-service` (mặc định) |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET` | R2: `https://<account>.r2.cloudflarestorage.com`, `auto`, `wiki-media` |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PATH_STYLE` | key của nhà cung cấp; `true` cho SeaweedFS/MinIO, `false` cho AWS S3 |

## Phạm vi hiện tại

Đã có foundation, media lifecycle, Patch context và Hero domain core, cùng frontend admin/wiki kết nối API thật.
Dữ liệu `resources` có thể đưa vào biểu mẫu draft để biên tập và upload qua Media API; chưa có bulk import tự động.
Item/Spell/Arcana/Enchantment/GameMode vẫn là các catalog thuộc giai đoạn sau. Không có dữ liệu gameplay tổng hợp trong migrations.


## Domain core: Patch và Hero

Migrations V005–V008 bổ sung gameplay context, Hero section revisions và patch history.
Giữ PostgreSQL + Keycloak + SeaweedFS như cấu hình foundation. Redis cache tùy chọn được bổ sung
theo ADR-012; không thay đổi storage hoặc nguồn dữ liệu chính.

Luồng nhập dữ liệu thật:

1. Với `region:admin`, tạo ruleset bằng POST `/api/wiki/v1/admin/rulesets`
   (`code`, `description`), rồi gán cho region VN bằng POST
   `/api/wiki/v1/admin/regions/{regionId}/ruleset-assignments`
   (`rulesetId`, `validFrom`, `validTo` tùy chọn). Region ID lấy từ GET `/api/wiki/v1/regions`.
2. Tạo patch (`code`, `translations`), variant (`rulesetId`, `variantCode`, `rulesetOrdinal`),
   publish variant và schedule release (`regionId`, `effectiveAt`, `announcedAt?`, `sourceUrl?`).
   Ordinal tăng theo ruleset, không dùng ngày phát hành để suy ra cùng ruleset cho mọi vùng.
3. Tạo media assets, upload/complete để có usable HEAD/PORTRAIT/SPLASH và icon/art nếu cần.
4. Tạo Hero với `code`, `initialLocale`, `name`, `rulesetId`; response trả `heroId`, `id` draft, version 1.
5. PUT profile/overview-ratings/combat-stats/skills/skins/media-bindings của draft. Mỗi lần gửi
   expectedDraftVersion mới nhất; full replace section. Không PUT lại media binding để nâng quality bytes.
6. POST publish với expectedVersion. GET public Hero theo region/locale. Publish dữ liệu game patch sau
   bằng draft cause GAME_PATCH và effectiveFromPatchVariantId; content correction giữ context cũ.
7. Ghi hero-changes riêng khi đã đối chiếu snapshot, sau đó đọc Hero changes hoặc patch changes.

Không có game fixture ngẫu nhiên trong migrations. VN vẫn có thể chọn nhưng trả PATCH_CONTEXT_UNAVAILABLE
cho gameplay read cho tới khi hoàn thành bước ruleset/release. Region khác giữ khóa như foundation.
Các catalog Item/Spell/Arcana/Enchantment/GameMode chưa có implementation trong domain core này.

### Kiểm chứng

```bash
sh mvnw spotless:apply
sh mvnw clean verify
```

`DomainCoreIntegrationTest` chạy PostgreSQL container trên CI có Docker, hoặc nhận
WIKI_TEST_DB_URL khi kiểm tra với PostgreSQL ngoài (database dùng riêng cho test, user wiki_test,
password rỗng trong nhánh cấu hình test này). Test tự truncate dữ liệu domain; tuyệt đối không trỏ vào
DB phát triển/production. Bộ test kiểm tra timeline không overlap, rollout theo vùng, draft visibility,
publish validation, section reuse/immutability, ETag, locale fallback, quality upgrade, reverse usage,
patch changes hai chiều, duplicate draft, FK ownership và hai biên tập viên ghi đồng thời.
Các test S3/SeaweedFS foundation vẫn cần Docker để chạy đầy đủ.

### Tích hợp frontend Hero

Admin `/publishing` đã dùng API thật cho context, draft, sáu section, fork/publish/discard.
`/publishing-media` dùng upload/version/activate hiện có; nâng chất lượng ảnh không ghi HeroRevision.
Wiki dùng public API theo region/locale, có trạng thái thiếu context và chưa publish.
Xem [hướng dẫn admin](../../frontend/apps/admin-aov/README.md#biên-tập-hero-với-backend).
Integration test Media kiểm chứng presigned upload thật qua SeaweedFS rồi publish Hero, đọc public,
ETag, nâng version ảnh và reverse usage. Cần Docker; không seed dữ liệu tổng hợp vào môi trường thực.

### Xuất bản dữ liệu nền bảng ngọc

Script `scripts/publish-arcana-baseline.ps1` sử dụng access token sẵn có từ biến
`WIKI_API_TOKEN`, cần arcana:write và arcana:publish. Mặc định chỉ kiểm tra; thêm
`-Apply` để đặt mốc quan sát rồi xuất bản. Dùng `-PatchCode s3-2026-observed` cho bộ
nguồn thu thập ngày 23/09/2026. Mốc này không tuyên bố ngọc đã thay đổi tại patch đó.

Chỉ xử lý nháp DATA_BASELINE độc lập, giữ nguyên content/bản dịch/ảnh, kiểm tra version
và không thay mốc đã gán khác. Bản đã xuất bản được bỏ qua. Mục thiếu mô tả/chỉ số
được giữ nháp; không tự đoán số liệu và không bỏ qua validation. Kết quả lưu trong
`.local-state/arcana-publication-result.json`; sao lưu DB trước lần chạy có `-Apply`.

### Cache danh mục tham chiếu

Admin dùng `GET /admin/reference-catalog` để lấy tên/bản dịch/asset ID theo ruleset trong một request;
không gọi preview từng tướng. Public vẫn chỉ đọc dữ liệu xuất bản tại context hiện hành. Các module
lấy projection gọn và Media đọc theo lô. Popup `@` chỉ tải metadata icon khi cuộn tới.

Compose local có Redis 8.2, chỉ mở `127.0.0.1:6379`, giới hạn 128 MB và không lưu bền. Profile `local`
bật cache mặc định; các profile khác mặc định tắt. Có thể khởi động Redis riêng:

```powershell
docker compose up -d redis
```

| Biến môi trường | Mặc định |
|---|---|
| `READ_MODEL_CACHE_ENABLED` | `true` ở local, `false` ở profile khác |
| `READ_MODEL_CACHE_PREFIX` | `wiki:read-model:v1` |
| `READ_MODEL_CACHE_PUBLIC_TTL` / `READ_MODEL_CACHE_ADMIN_TTL` | `2m` / `30s` |
| `READ_MODEL_CACHE_RETRY_DELAY` / `READ_MODEL_CACHE_MAX_VALUE_BYTES` | `5s` / `8388608` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_SSL` | `localhost` / `6379` / `false` |
| `REDIS_USERNAME` / `REDIS_PASSWORD` | Rỗng; production cấp qua môi trường |
| `REDIS_TIMEOUT` / `REDIS_CONNECT_TIMEOUT` | `200ms` / `200ms` |

Cache JSON danh mục admin/public và thuật ngữ public. Không cache bytes ảnh, token, phiên đăng nhập
hoặc hồ sơ cá nhân. Thay đổi catalog tăng epoch PostgreSQL trong cùng transaction; cache cũ hết TTL
mà không cần xóa toàn bộ Redis. Patch theo lịch được xác định lại trước lookup. Redis ngắt thì API
đọc DB và tạm ngừng thử Redis 5 giây; không làm health check của ứng dụng thất bại chỉ vì cache ngắt.
Micrometer counter `wiki.read.model.cache` có tag `result=hit|miss|bypass|error`. Xem
[ADR-012](../docs/adr/ADR-012-reference-read-model-cache.md) cho giới hạn và thiết kế invalidation.

Kiểm tra tập trung (các integration test cần Docker, database test tách biệt):

```powershell
./mvnw.cmd "-Dtest=RedisReadModelCacheTest,CatalogCacheEpochTest,CatalogCacheEpochIntegrationTest,MediaAssetLookupTest,AdminReferenceCatalogTest,PublicReferenceCatalogTest,AdminReferenceCatalogIntegrationTest,HeroPublicReferencesTest,ReferenceSettingsIntegrationTest" test
```
