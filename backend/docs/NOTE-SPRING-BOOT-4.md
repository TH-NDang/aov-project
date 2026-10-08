# Ghi chú backend Spring Boot 4 — Dự án Liên Quân

Ngày cập nhật: 07/10/2026.

Phạm vi: backend Java 21 với Spring Boot 4.1.1, Lombok, MapStruct và Flyway. Tài liệu này dành riêng cho dự án Spring Boot 4 trong thư mục `backend/`; không phải quy ước chung cho tất cả dự án backend. Các dự án Python hoặc công nghệ khác cần có tài liệu và cấu hình riêng.

Tài liệu định hướng triển khai; backend Spring Boot hiện chưa có mã nguồn hoặc cấu hình build. Các module nghiệp vụ và lựa chọn bổ sung bên dưới là đề xuất, cần điều chỉnh theo phạm vi sản phẩm.

## 1. Công nghệ

| Công nghệ | Phiên bản / vai trò |
| --- | --- |
| Java | 21; thống nhất JDK cho máy phát triển, CI và môi trường chạy |
| Spring Boot | 4.1.1; REST API và cấu hình ứng dụng |
| Lombok | Giảm mã lặp; lấy phiên bản được Spring Boot quản lý |
| MapStruct | Đề xuất 1.6.3; chuyển đổi entity và DTO tại thời điểm biên dịch |
| Flyway | Quản lý phiên bản schema bằng migration SQL; lấy phiên bản được Spring Boot quản lý |

Spring Boot 4.1.1 hỗ trợ Java 21. Dùng namespace `jakarta.*` cho persistence và validation.

Lựa chọn đề xuất: Maven với Maven Wrapper, PostgreSQL và Spring Data JPA. Database chưa được người dùng chốt; ví dụ cấu hình dưới đây giả định PostgreSQL.

## 2. Phụ thuộc cần chuẩn bị

- Parent: `org.springframework.boot:spring-boot-starter-parent:4.1.1`.
- Đặt `java.version=21` và `mapstruct.version=1.6.3` trong Maven properties.
- REST: `org.springframework.boot:spring-boot-starter-webmvc`.
- Validation: `org.springframework.boot:spring-boot-starter-validation`.
- JPA, nếu chọn ORM: `org.springframework.boot:spring-boot-starter-data-jpa`.
- Lombok: `org.projectlombok:lombok`, khai báo optional.
- Mapper: `org.mapstruct:mapstruct:${mapstruct.version}`.
- Migration: chọn hỗ trợ Flyway của Spring Boot 4 và thêm module database tương ứng; với PostgreSQL dùng `org.flywaydb:flyway-database-postgresql` cùng JDBC driver `org.postgresql:postgresql`.
- Test: chọn starter test tương ứng với module Spring Boot 4; bổ sung Testcontainers cho kiểm thử database thật khi triển khai persistence.

Ưu tiên dependency management của Spring Boot; chỉ pin riêng phiên bản thư viện không được quản lý. Khi tạo project, đối chiếu dependency và starter với Spring Initializr cho đúng phiên bản 4.1.1.

### Annotation processing

Cấu hình `maven-compiler-plugin` với `release=21` và annotation processor paths:

1. `org.projectlombok:lombok` — cùng phiên bản với dependency Lombok.
2. `org.projectlombok:lombok-mapstruct-binding:0.2.0`.
3. `org.mapstruct:mapstruct-processor:${mapstruct.version}`.

Binding giúp MapStruct làm việc với getter/setter do Lombok sinh ra. Bật annotation processing trong IDE nếu IDE không tự nhận cấu hình Maven. Không chỉnh sửa mã mapper sinh trong `target/generated-sources/annotations`.

## 3. Cấu trúc đề xuất

Tổ chức theo tính năng, mỗi tính năng tách controller, service, repository, entity, DTO và mapper khi cần:

```text
backend/
  pom.xml
  src/main/java/com/aov/
    AovApplication.java
    config/
    common/exception/
    hero/
      HeroController.java
      HeroService.java
      HeroRepository.java
      Hero.java
      dto/
      HeroMapper.java
    item/
    build/
    patch/
  src/main/resources/
    application.yml
    application-local.yml
    db/migration/
  src/test/java/com/aov/
```

Luồng xử lý: Controller → Service → Repository → Database. Controller nhận/trả DTO; service xử lý nghiệp vụ và transaction; repository truy vấn dữ liệu. Mapper chỉ chuyển đổi dữ liệu.

## 4. Phạm vi nghiệp vụ gợi ý

Giả định sản phẩm là website tra cứu tướng và hướng dẫn lên đồ Liên Quân:

| Module | Nội dung |
| --- | --- |
| Hero | Tướng, vai trò, kỹ năng, chỉ số, ảnh đại diện |
| Item | Trang bị, giá vàng, chỉ số và nội tại |
| Build | Bộ trang bị theo tướng, thứ tự mua và mô tả |
| Patch | Phiên bản game, ngày phát hành và thay đổi cân bằng |

Chỉ thêm tài khoản, bình luận, yêu thích hoặc quản trị khi có yêu cầu. Dữ liệu game cần ghi nguồn và phiên bản để tránh nhầm giữa các bản cập nhật.

Quy ước dữ liệu đề xuất:

- ID dùng nhất quán một kiểu; ví dụ `Long` cho MVP.
- Tên tiếng Việt lưu Unicode; slug có unique constraint nếu dùng để định danh URL.
- Quan hệ build–item lưu thêm vị trí để giữ thứ tự trang bị.
- Dùng `Instant` cho thời điểm tạo/cập nhật; lưu UTC.
- Enum JPA lưu bằng `EnumType.STRING`.
- Ràng buộc quan trọng phải có ở database, bên cạnh validation API.

## 5. Lombok và MapStruct

Lombok: dùng `@RequiredArgsConstructor` cho constructor injection, `@Slf4j` khi cần log. Với entity JPA, ưu tiên `@Getter`, setter có kiểm soát và constructor không tham số phù hợp; tránh `@Data` vì equals/hashCode/toString tự sinh có thể gây vấn đề với quan hệ entity.

DTO có thể dùng Java record để biểu diễn dữ liệu bất biến.

```java
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface HeroMapper {
    HeroResponse toResponse(Hero hero);
}
```

Định nghĩa rõ các trường được phép cập nhật; không cho request tự ghi ID, quyền hoặc timestamp hệ thống. Với cập nhật từng phần, thống nhất cách phân biệt trường không gửi và trường gửi `null` trước khi dùng chiến lược bỏ qua null.

## 6. Flyway và database

Migration đặt tại `src/main/resources/db/migration`:

```text
V1__create_heroes.sql
V2__create_items.sql
V3__create_builds_and_build_items.sql
```

- Mỗi thay đổi schema tạo một migration mới, version duy nhất.
- Không sửa migration đã áp dụng trên môi trường dùng chung.
- Flyway là nơi quản lý schema; JPA dùng `ddl-auto: validate`.
- Tách dữ liệu mẫu cho phát triển khỏi migration production khi thích hợp.
- Không bật `baseline-on-migrate` theo mặc định; chỉ dùng khi có kế hoạch đưa database hiện hữu vào Flyway.
- Khi triển khai, sao lưu và kiểm tra migration với dữ liệu đại diện trước các thay đổi có thể mất dữ liệu.

Ví dụ `application.yml` khi chọn PostgreSQL + JPA:

```yaml
spring:
  application:
    name: aov-backend
  datasource:
    url: ${DB_URL}
    username: ${DB_USERNAME}
    password: ${DB_PASSWORD}
  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: ${PORT:8080}
```

Không commit mật khẩu thật. Khi tắt open-in-view, service phải lấy đủ dữ liệu cần cho DTO trong transaction; tránh truy vấn N+1.

## 7. Quy ước API

Prefix đề xuất: `/api/v1`.

```text
GET /api/v1/heroes
GET /api/v1/heroes/{id}
GET /api/v1/items
GET /api/v1/heroes/{id}/builds
```

- Danh sách có phân trang, giới hạn kích thước trang và trường sort được phép.
- Dùng `@Valid` với request DTO; kiểm tra quy tắc nghiệp vụ trong service.
- Xử lý lỗi tập trung bằng `@RestControllerAdvice`; đề xuất `ProblemDetail` và mã lỗi ổn định cho frontend.
- HTTP status: 200 đọc/cập nhật, 201 tạo, 204 xóa, 400 request sai, 404 không tồn tại, 409 xung đột dữ liệu.
- CORS khai báo origin frontend theo môi trường.
- Khi triển khai API ghi dữ liệu, thêm xác thực và phân quyền trước khi công khai.
- Dùng `@Transactional` cho thao tác ghi; `readOnly = true` cho luồng đọc phù hợp.

## 8. Tài liệu tham khảo

- [Spring Boot 4.1.1 release](https://spring.io/blog/2026/08/20/spring-boot-4-1-1-available-now/).
- [Spring Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html).
- [Spring Boot reference](https://docs.spring.io/spring-boot/reference/).
- [MapStruct reference, gồm tích hợp Lombok](https://mapstruct.org/documentation/stable/reference/html/).

