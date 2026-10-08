# ADR-006 — Object storage qua chuẩn S3 với AWS SDK for Java 2.x

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-10-08  
**Phạm vi:** `wiki-service` (và các service sau này cần lưu file)

## Bối cảnh

`wiki-service` lưu bytes media (ảnh tướng, skin, skill, trang bị…) ở object storage; PostgreSQL chỉ lưu metadata và object key (`01-BAN-DAC-TA-DU-AN.md` mục 13).

Ban đầu đặc tả dự kiến adapter `MinioObjectStorage`. Tuy nhiên:

- MinIO bản cộng đồng đã ngừng phát hành Docker image/binary chính thức từ 10/2025, chuyển sang chế độ bảo trì và repository bị archive trong 2026.
- MinIO đề xuất AIStor (Free: miễn phí, chỉ single-node, mã đóng, điều khoản có thể thay đổi).
- Production có thể dùng dịch vụ S3-compatible có quản lý (ví dụ Cloudflare R2) để giảm việc vận hành.

Lựa chọn storage cho production chưa cần chốt ngay, nhưng code không được khóa vào một nhà cung cấp.

## Quyết định

1. Port `ObjectStorage` ở tầng application; **một adapter duy nhất** `S3ObjectStorage` dùng **AWS SDK for Java 2.x** (`S3Client`, `S3Presigner`).
2. Mọi storage được truy cập qua API chuẩn S3; môi trường chỉ khác nhau ở cấu hình `wiki.storage.*` (endpoint, region, bucket, path-style, credential).
3. Local/test dùng MinIO (Docker Compose, Testcontainers) với image được pin version. Production dự kiến Cloudflare R2; chốt khi deploy.
4. Chỉ dùng thao tác S3 cơ bản: `PutObject`, `HeadObject`, `GetObject`, `CopyObject`, `DeleteObject`, presigned `PUT`/`GET`.
5. Không dựa vào bucket versioning, object lock, event notification. Version media do `MediaAssetVersion` và object key quản lý.

## Hệ quả

**Tích cực**

- Đổi MinIO ↔ AIStor ↔ R2 ↔ AWS S3 chỉ bằng cấu hình.
- AWS SDK v2 được duy trì tích cực, tài liệu và ví dụ đầy đủ; có `S3Presigner` cho luồng upload trực tiếp.
- Không phụ thuộc vào tương lai của MinIO.

**Tiêu cực / cần lưu ý**

- Phải tự cấu hình `endpointOverride` và `forcePathStyle(true)` cho MinIO.
- Không dùng được tính năng riêng của từng nhà cung cấp.
- Hành vi nhỏ có thể khác nhau giữa các storage (checksum, header, giới hạn multipart); integration test với MinIO không bảo đảm 100% giống production — cần smoke test trên storage thật trước khi go-live.

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| MinIO Java SDK | Gắn chặt vào MinIO trong khi bản cộng đồng đã ngừng phát triển |
| Spring Cloud AWS (`S3Template`) | Thêm một lớp phụ thuộc; cần kiểm tra tương thích Spring Boot 4.1 trước khi dùng. Có thể xem xét lại sau |
| Lưu ảnh trên filesystem của server | Không scale, khó backup, không có presigned URL |

## Tài liệu tham khảo

- AWS SDK for Java 2.x Developer Guide: https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/
- Presigned URL: https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html
- API reference: https://sdk.amazonaws.com/java/api/latest/
- Cloudflare R2 với AWS SDK for Java: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java
