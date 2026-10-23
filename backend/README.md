# Backend AOV Wiki

Backend hiện là một ứng dụng Java 21 / Spring Boot, tổ chức theo tính năng bằng Spring Modulith.
PostgreSQL là nguồn dữ liệu chính; Keycloak quản lý danh tính; Media dùng object storage tương thích
S3. Redis chỉ là cache tùy chọn cho read model.

## Bắt đầu từ đâu

| Nhu cầu | Tài liệu |
|---|---|
| Chạy backend, thiết lập môi trường, kiểm thử | [Hướng dẫn wiki-service](wiki-service/README.md) |
| Tìm đặc tả nghiệp vụ, database và API | [Chỉ mục tài liệu](docs/README.md) |
| Hiểu cấu trúc và ranh giới phụ thuộc | [ADR-013: Tổ chức backend](docs/adr/ADR-013-backend-organization.md) |
| Theo luồng catalog, Hero import hoặc lịch patch | [Hướng dẫn đọc application services](docs/TAI-CAU-TRUC-APPLICATION-SERVICES.md) |
| Xem hợp đồng HTTP đang chạy | [OpenAPI của ứng dụng](wiki-service/README.md#api-và-openapi) |

## Sơ đồ thư mục

```text
backend/
├── README.md
├── docs/                         đặc tả, ADR và hướng dẫn thiết kế
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
