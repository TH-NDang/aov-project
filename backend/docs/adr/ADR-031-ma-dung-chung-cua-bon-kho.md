# ADR-031 — Mã thuần dùng chung của bốn module kho

**Trạng thái:** Chấp nhận (người dùng duyệt ngày 17/11/2026)  
**Ngày:** 2026-11-17  
**Bổ sung:** [ADR-013](ADR-013-backend-organization.md)

## Bối cảnh

- Bốn module kho `item`, `arcana`, `spell`, `enchantment` có 32 tệp cùng tên. Sau khi đổi tên module, `arcana` trùng
  `item` 95% số dòng, `enchantment` 89%, `spell` 80% (rà soát phong cách mã ngày 13/11/2026, mục P57).
- ADR-013 cố ý giữ luồng nghiệp vụ của từng kho: đồ thị công thức của trang bị, bằng chứng loại bỏ của phụ trợ, nhánh
  của phù hiệu, bậc của ngọc. Quyết định đó vẫn đúng cho phần luật riêng.
- Phần trùng còn lại không mang nghĩa riêng của kho: điều kiện giới hạn trang chép 9 lần trong 4 tệp, phép cắt một trang
  từ danh sách đã lọc chép ở cả bốn `*CatalogQueries` (và ở `hero`, `media`), cách đọc thứ tự patch của một biến thể
  chép 8 lần. Sửa một lỗi phải sửa bốn nơi, và các bản đã bắt đầu lệch nhau.
- ADR-013 đã đưa luật bản dịch dùng chung vào `platform.CatalogTranslations`, và luật phạm vi đọc theo mùa/patch vào
  contract công khai `patch.CatalogReadScope`. Đó là mẫu cho việc này.

## Quyết định

1. Bốn module kho giữ luồng nghiệp vụ riêng: facade, entity, repository, mã lỗi, luật nội dung, thứ tự kiểm tra và
   audit vẫn thuộc từng module. Không tạo lớp cha chung cho facade hay entity, không dựng framework CRUD.
2. Mã thuần giống hệt về ý nghĩa ở cả bốn module chuyển vào gói gốc của `platform`, như `CatalogTranslations`:
   - giới hạn trang là hằng có tên (`PageLimits`), dùng trong ràng buộc `@Min`/`@Max` của tham số `*Api`;
   - cắt một trang từ danh sách đã lọc trong bộ nhớ là `PageSlice.of(danh sách, page, size)`;
   - các hàm trợ giúp cùng loại: không phụ thuộc Spring, JPA hay HTTP, trả kết quả hoặc vi phạm, không ném lỗi của
     một module cụ thể. Module gọi chọn mã lỗi của mình.
3. Mã dùng chung cần dữ liệu patch (thứ tự patch của một biến thể) đặt ở contract công khai của `patch`, cạnh
   `CatalogReadScope`, vì `platform` không phụ thuộc module tính năng.
4. Chỉ chuyển khi đoạn mã giống hệt về ý nghĩa ở cả bốn kho. Khác nhau dù nhỏ thì giữ ở module, hoặc ghi rõ khác biệt
   trước khi gộp. Đoạn mã chỉ giống về hình dạng nhưng gắn với entity của từng kho (đóng dấu phiên bản, tạo bản nháp,
   kiểm bản nháp còn sửa được) vẫn ở module.

## Hệ quả

- Lỗi trong giới hạn trang, cắt trang hay thứ tự patch sửa một nơi; test của phần dùng chung viết một lần.
- Bốn module vẫn đọc được độc lập; người đọc mở `platform` hoặc `patch` khi gặp một hàm dùng chung.
- Phần trùng mang nghĩa nghiệp vụ vẫn còn bốn bản. Gộp phần đó cần một ADR khác và bằng chứng các luồng thật sự giống
  nhau.

## Kiểm chứng

- `ModuleArchitectureTests` bảo đảm `platform` không phụ thuộc module kho nào.
- Test hiện có của bốn kho giữ nguyên kết quả: hình dạng trang, mã lỗi, thứ tự sắp xếp.
