# Backend AOV Wiki

Backend có hai ứng dụng Java 21 / Spring Boot: `wiki-service` cho dữ liệu game và
`community-service` cho nhập liệu giải đấu, tổ chức theo tính năng.
PostgreSQL là nguồn dữ liệu chính; Keycloak quản lý danh tính; Media dùng object storage tương thích
S3. Redis chỉ là cache tùy chọn cho read model.

## Bắt đầu từ đâu

| Nhu cầu | Tài liệu |
|---|---|
| Chạy backend, thiết lập môi trường, kiểm thử | [Hướng dẫn wiki-service](wiki-service/README.md) |
| Nhập liệu giải đấu, cấm/chọn và diễn biến trang bị | [Hướng dẫn community-service](community-service/README.md) |
| Tìm đặc tả nghiệp vụ, database và API | [Chỉ mục tài liệu](docs/README.md) |
| Hiểu cấu trúc và ranh giới phụ thuộc | [ADR-013: Tổ chức backend](docs/adr/ADR-013-backend-organization.md) |
| Hiểu ranh giới dữ liệu giải đấu và phiên bản từng ván | [ADR-015: Nhập liệu giải đấu](docs/adr/ADR-015-manual-tournament-recording.md) |
| Theo luồng catalog, Hero import hoặc lịch patch | [Hướng dẫn đọc application services](docs/TAI-CAU-TRUC-APPLICATION-SERVICES.md) |
| Xem hợp đồng HTTP đang chạy | [OpenAPI của ứng dụng](wiki-service/README.md#api-và-openapi) |

## Sơ đồ thư mục

```text
backend/
├── README.md
├── docs/                         đặc tả, ADR và hướng dẫn thiết kế
├── community-service/            giải đấu, database và API riêng
└── wiki-service/
    ├── pom.xml                   build và các cổng kiểm tra
    ├── compose.yaml              điểm vào dependency local
    ├── .env.example              giá trị mẫu local, không chứa secret thật
    ├── config/format/            cấu hình formatter
    ├── infra/local/              realm Keycloak, cấu hình SeaweedFS
    ├── scripts/dev/              khởi động local và kiểm tra launcher
    ├── scripts/                  công cụ bảo trì có phạm vi riêng
    └── src/
        ├── main/java/com/wikiaov/ các module nghiệp vụ và platform
        ├── main/resources/
        │   ├── config/           cấu hình Spring theo profile
        │   └── db/migration/     Flyway migrations
        └── test/                 kiểm thử nghiệp vụ, API, kiến trúc và tích hợp
```

`compose.yaml` vẫn ở thư mục service để lệnh Docker Compose và Spring Boot hiện có tiếp tục tìm
được cấu hình. Việc sắp xếp thư mục không đổi tên volume, schema, URL API hoặc ý nghĩa profile.

## Chuẩn bị backend giải đấu ở local

Dependencies hiện được dùng chung từ Compose của wiki. Không xóa volume hoặc chạy lại migration
wiki để tạo phần giải đấu. Trong `backend/wiki-service`:

```powershell
docker compose up -d postgres
./scripts/dev/initialize-community-database.ps1
docker compose --profile identity up -d keycloak
./scripts/sync-community-roles.ps1
./scripts/dev/test-community-setup.ps1
```

Script đồng bộ quyền hỏi credential quản trị realm `master`, không thay mật khẩu hoặc tạo lại
tài khoản người dùng. Realm đã tồn tại không tự nhận thay đổi từ JSON import; chạy script để bổ
sung client/audience và các quyền giải đấu, sau đó đăng nhập admin lại. Người chỉ biên tập giải
dùng role `community-editor`; người xuất bản dùng `community-publisher`.

Script database mặc định tạo `community` với owner `community`; các giá trị mẫu chỉ dành cho máy
phát triển. Cho phép truyền `CommunityDatabase`, `CommunityUser`, `CommunityPassword` để dùng
giá trị riêng, rồi cấu hình cùng thông tin trong môi trường của service mới. Khi database/user đã
có, script giữ nguyên dữ liệu/password và từ chối owner khác hoặc tài khoản có quyền quản trị.

Theo [README community-service](community-service/README.md) để chạy ứng dụng ở cổng 8082.
Wiki tiếp tục dùng 8080, Keycloak 8081; frontend Stream 5174 và admin 5175. CI của service mới
được tách ở `.github/workflows/community-backend.yml`.

## Nguyên tắc thay đổi

- Gọi public contract khi đi qua module; không dùng `internal` của module khác.
- Giữ nghiệp vụ thuần trong domain; facade application điều phối quyền, transaction, audit và các
  cộng tác viên. Repository, web và SDK nằm đúng ranh giới của chúng.
- Thay đổi schema bằng migration mới; giữ `ddl-auto: validate`. Không sửa migration đã áp dụng.
- Cấu hình local dùng được cho phát triển; production cấp secret qua môi trường hoặc cơ chế quản lý
  secret của nơi triển khai. Không commit `.env`, token hay dữ liệu chạy tạm.
- Refactor cần bảo toàn thứ tự validation, lỗi, khóa, no-op và hợp đồng HTTP; kiểm thử tương ứng
  phải chứng minh các hành vi này.

Không cần tách thêm dịch vụ hoặc tạo interface cho mọi lớp để áp dụng các nguyên tắc trên.
