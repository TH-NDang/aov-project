# WikiAOV — wiki-service

Khung backend được tạo bằng Spring CLI / Spring Initializr: Java 21, Spring Boot 4.1.1, Maven Wrapper.
Đặc tả hiện hành nằm ở [backend/docs](../docs/01-BAN-DAC-TA-DU-AN.md); bộ 01/02/03 ưu tiên hơn NOTE.

## Cấu trúc

Một deployable JAR, package gốc `com.wikiaov`. Mỗi domain có public contract tại package gốc và phần triển khai trong `internal/{web,application,domain,persistence,infrastructure}`.
Module: hero, media, patch, item, arcana, spell, enchantment, gamemode, query, access, platform.
Chỉ gọi public contract giữa các module. Không dùng entity/repository nội bộ của module khác.
`community-service` chỉ tạo khi bắt đầu phần sản phẩm tương ứng.

## Chạy local

Cần JDK 21 và Docker đang chạy. Từ thư mục service:

```powershell
Copy-Item .env.example .env
./mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"
```

Spring Boot tự khởi động PostgreSQL và MinIO qua Compose. Keycloak nằm trong profile `identity`, khởi động khi cần:

```powershell
docker compose --profile identity up -d
```

PostgreSQL: localhost:5432, database wiki. MinIO API: localhost:9000, console: localhost:9001.
Keycloak local: localhost:8081; realm/client/audience chưa được provision.
Compose đọc `.env`; ứng dụng Spring đọc biến môi trường hoặc giá trị mặc định của profile local.
Không bật profile local ở production; truyền DB_URL, DB_USERNAME, DB_PASSWORD từ môi trường.

## Kiểm tra

```powershell
./mvnw.cmd clean verify
```

Architecture test kiểm tra ranh giới Spring Modulith; context test dùng PostgreSQL Testcontainers và profile test.
Có thể kiểm tra riêng kiến trúc khi Docker chưa sẵn sàng:

```powershell
./mvnw.cmd "-Dtest=ModuleArchitectureTests" verify
```

## Phạm vi hiện tại

Đã chuẩn bị build, module, cấu hình môi trường, schema Flyway và dependency local.
Chưa triển khai entity, API nghiệp vụ, import dữ liệu, S3 adapter hoặc luồng publish/revision.
API dự kiến dùng `/api/wiki/v1/**`, ID UUID; không đọc trực tiếp thư mục resources khi chạy.
Skeleton security hiện chặn mọi request ngoài GET /actuator/health. Khi triển khai API sẽ thêm JWT issuer/audience, public GET và quyền admin theo docs.
MinIO chưa tạo bucket/policy; phần này thuộc media foundation.

