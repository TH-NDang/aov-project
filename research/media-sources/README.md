# Nguồn và credit ảnh

Quy tắc dùng chung ở `frontend/packages/ui/src/lib/resource-media-sources.ts`, đọc manifest được
liệt kê trong note của gói tài nguyên. Không sửa ảnh hoặc JSON trong `resources/`.

```powershell
python -X utf8 research/media-sources/sync-media-sources.py
python -X utf8 research/media-sources/sync-media-sources.py --backend http://localhost:8080/api/wiki/v1
python -X utf8 research/media-sources/sync-media-sources.py --backend http://localhost:8080/api/wiki/v1 --apply
```

Lệnh đầu kiểm tra local; lệnh thứ hai lập kế hoạch đối chiếu phiên bản đang ở backend; chỉ lệnh
có `--apply` mới ghi bổ sung provenance. Dùng cấu hình xác thực của công cụ import hiện có.
Cần Node hỗ trợ strip TypeScript và backend đã áp dụng V035–V036 trước khi ghi. Báo cáo mặc định
ở `backend/wiki-service/.local-state/media-sources-report.json`, không ghi token hoặc URL upload.

Backfill khớp SHA-256 của version, không đoán theo tên tướng/file hoặc thứ tự. Giữ nguyên ID/key
và bytes trên cloud. Các trường hợp không khớp được liệt kê để xác minh; avatar cá nhân được bỏ qua.
Nguồn cấp version ưu tiên hơn provenance cấp asset cũ. Ảnh phát sinh từ ImageGen/chỉnh sửa được
phân biệt; URL mẫu gốc không biến ảnh tái tạo thành bản tải chính thức.

## Cách sử dụng

- Admin: nhập tên nguồn, loại nguồn, chủ sở hữu/credit, URL gốc và URL liên hệ bên cung cấp
  trong form tải ảnh. Nguồn được lưu riêng cho từng phiên bản khi tải mới hoặc nâng chất lượng.
- Trong **Quản lý ảnh**, cột **Nguồn ảnh** hiển thị **Cần bổ sung nguồn / credit** nếu chưa có
  nguồn đầy đủ cho phiên bản hiện hành. Bấm nhãn để mở chi tiết và bổ sung sau khi xác minh;
  URL hoặc tên nguồn đã biết vẫn được giữ nguyên. Ảnh chụp game đã xác nhận không bắt buộc có URL.
- Gói tài nguyên: đọc nguồn từ manifest, giữ trong phiên import để tiếp tục upload sau khi mở lại.
  Ảnh portrait qua Figma và 5 ảnh phụ trợ từ ZIP được ghi là ảnh chụp Liên Quân do người dùng
  cung cấp, credit Garena / Liên Quân Mobile theo xác nhận; không tự suy ra ngày chụp.
- Wiki: biểu tượng thông tin ở góc ảnh mở nguồn và credit. Liên kết đính chính dẫn đến `/contact`
  kèm ảnh/phiên bản. Form lưu yêu cầu trong backend; không tự gửi email.
- Admin: mục **Liên hệ về ảnh** trong thư viện ảnh mở `/media-contact-requests`. Người có
  `media:write` được xem yêu cầu, xem đúng phiên bản bị phản ánh, bổ sung nguồn và đánh dấu đã xử lý.

Ghi chú import và đường dẫn local chỉ dành cho admin; tên/email của người liên hệ cũng không công khai.
Backend cần chạy migration mới trước khi dùng các form. Backfill metadata của ảnh đã upload là một
bước riêng: lập kế hoạch bằng lệnh không có `--apply`, kiểm tra báo cáo rồi áp dụng cùng backend đó.

## Kiểm tra

Chạy `pnpm --filter @aov/admin-aov test:media-credits` trong `frontend` để kiểm tra nguồn theo bytes,
upload/nâng chất lượng, checkpoint và hiển thị nguồn của phiên bản hiện hành. Khi admin dev server
đang chạy, `/tests/fixtures/media-credit.html` cung cấp ảnh mẫu để thử mở popover và chuyển sang Liên hệ.
Backend được kiểm tra bằng `mvnw.cmd clean verify`, bao gồm persistence, quyền truy cập và OpenAPI.
