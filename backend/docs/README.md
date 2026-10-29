# Tài liệu backend

Đọc [hướng dẫn chạy service](../wiki-service/README.md) nếu cần khởi động ứng dụng. Các tài liệu ở đây
giải thích sản phẩm, hợp đồng dữ liệu và những quyết định thiết kế; không thay thế code hoặc báo cáo
kiểm thử thực tế.

## Đặc tả và hướng dẫn

| Tài liệu | Nội dung và cách dùng |
|---|---|
| [01 — Đặc tả dự án](01-BAN-DAC-TA-DU-AN.md) | Nghiệp vụ, quyền, vòng đời dữ liệu, mùa/patch và quy tắc xuất bản |
| [02 — Database](02-DATABASE-DU-AN.md) | Ownership schema, bảng, ràng buộc, migration và tính nhất quán |
| [03 — API](03-API-DU-AN.md) | Hợp đồng API, versioning, lỗi và quy tắc endpoint |
| [Tái cấu trúc application services](TAI-CAU-TRUC-APPLICATION-SERVICES.md) | Theo luồng catalog, Hero import và lịch release; các bất biến khi sửa tiếp |
| [Ghi chú Spring Boot 4](NOTE-SPRING-BOOT-4.md) | Ghi chú khởi đầu và ví dụ tham khảo; có những đề xuất lịch sử chưa phản ánh trạng thái hiện tại |

Bộ 01/02/03 là đặc tả nghiệp vụ hiện hành. Cấu trúc thư mục và các quyết định tổ chức mới theo
[ADR-013](adr/ADR-013-backend-organization.md). Khi sửa hợp đồng, cập nhật đặc tả và kiểm thử cùng
thay đổi; không tự chọn hành vi khác chỉ vì tài liệu cũ và code chưa khớp.

OpenAPI được sinh từ interface HTTP `*Api` và mapping của controller. Xem cách lấy JSON/YAML có
phân quyền trong [README service](../wiki-service/README.md#api-và-openapi). Bản sinh khi kiểm thử nằm
trong `target/openapi/`, không được xem là một đặc tả thủ công cần sao chép ngược vào tài liệu này.

## Quyết định kiến trúc

| ADR | Quyết định |
|---|---|
| [006](adr/ADR-006-object-storage-s3.md) | Object storage tương thích S3, presigned upload và quyền sở hữu Media |
| [007](adr/ADR-007-admin-auth-gateway.md) | Form đăng nhập admin qua backend và Keycloak |
| [008](adr/ADR-008-shared-user-profiles.md) | Hồ sơ người dùng dùng chung |
| [009](adr/ADR-009-DURABLE-HERO-IMPORT.md) | Import Hero chạy bền ở backend |
| [010](adr/ADR-010-canonical-character-identifiers.md) | Mã định danh nhân vật và ảnh |
| [011](adr/ADR-011-shared-terminology.md) | Thuật ngữ và tham chiếu dùng chung |
| [012](adr/ADR-012-reference-read-model-cache.md) | Projection danh mục và Redis cache có thể bỏ qua |
| [013](adr/ADR-013-backend-organization.md) | Tổ chức backend, cấu hình local và cổng kiểm tra kiến trúc |
| [014](adr/ADR-014-public-assets-private-staging.md) | Bucket assets công khai và vùng upload/import riêng tư trên R2 |
| [015](adr/ADR-015-manual-tournament-recording.md) | Backend giải đấu độc lập, dữ liệu quan sát và snapshot theo mùa/patch của từng ván |

ADR mới cần nêu bối cảnh, quyết định, đánh đổi và cách kiểm chứng. Không dùng ADR để tuyên bố
đã hoàn thành một tính năng hoặc một lượt kiểm thử chưa thực hiện.
