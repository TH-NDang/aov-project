# ADR-014 — Tách bucket ảnh công khai và vùng tạm riêng tư

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-10-22

## Bối cảnh

R2 phục vụ và cache ảnh qua custom domain ở cấp bucket. Không được bật truy cập công khai cho bucket chứa `incoming/` và `imports/`. Luồng Media hiện có đã phân biệt key ảnh hoàn tất với key tạm, nhưng cấu hình chỉ hỗ trợ một bucket vật lý.

## Quyết định

- Giữ một port `ObjectStorage`, một adapter S3 và alias logic `primary`. Không thêm dịch vụ hoặc thay schema.
- `wiki.storage.bucket` chứa dữ liệu riêng tư. `wiki.storage.assets-bucket` tùy chọn chứa key bắt đầu chính xác bằng `assets/`; bỏ trống giữ cách chạy một bucket ở local.
- Adapter định tuyến mọi thao tác theo key, kể cả nguồn và đích của CopyObject. Complete vẫn xác thực ảnh rồi mới copy sang kho ảnh hoàn tất.
- Không bật public cho kho riêng tư. Chỉ kho assets được gắn custom domain hoặc URL thử nghiệm, sau khi xác nhận phạm vi công khai.
- Tắt AWS chunked encoding để tương thích R2. Tiếp tục checksum WHEN_REQUIRED và presigned PUT/GET.
- Cloud được tạo và cấu hình bên ngoài ứng dụng; cho phép tắt initializer ngay cả khi dùng profile local.
- Không thay key, UUID hoặc phiên bản media khi chuyển kho. Sao chép và kiểm chứng toàn bộ phiên bản trước khi đổi storage đang phục vụ.

## Hệ quả

Ranh giới công khai không còn phụ thuộc quy tắc chặn prefix tại CDN. Cần quyền object read/write trên hai bucket và smoke test CopyObject trên R2 thật. SeaweedFS integration test kiểm chứng định tuyến, copy, chữ ký và cache header nhưng không thay thế thử nghiệm R2.

`r2.dev` chỉ dùng thử, không cung cấp CDN cache. Khi có domain, đổi public base URL sang `https://img.<domain>/assets`; không đổi ID hoặc key ảnh. CDN giữ cache một năm cho URL phiên bản bất biến; đổi ảnh tạo URL phiên bản mới.

## Tham khảo

- https://developers.cloudflare.com/r2/buckets/public-buckets/
- https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/
- https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
