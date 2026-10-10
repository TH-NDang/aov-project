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
| `media` | Port `ObjectStorage` + `S3ObjectStorage` (AWS SDK v2, ADR-006) |

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

Realm được import từ `keycloak/wikiaov-realm.json` ở lần chạy đầu. Nếu sửa file realm, xoá volume `keycloak-data` để import lại.

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

Đã xong nền tảng (Phase 1): build, ranh giới module, Flyway, xử lý lỗi, request id, JWT + quyền theo capability, audit, object storage S3.
Chưa có: entity và API nghiệp vụ (hero, patch, item…), luồng upload media (`MediaAsset`, `MediaAssetVersion`), import dữ liệu.
