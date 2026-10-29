# ADR-016 — Ghi thay đổi tướng từ ghi chú cập nhật và suy ra dữ liệu patch cũ

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-10-29

## Bối cảnh

Dữ liệu tướng chủ yếu được thu thập ở mùa/patch hiện tại. Change set hiện bắt buộc một revision
GAME_PATCH đã xuất bản làm đích, còn import PATCH_UPDATE cần snapshot trước đó; thiếu dữ liệu của
patch cũ thì báo INSUFFICIENT_DATA. Vì vậy không thể ghi thay đổi của các patch đã qua trong mùa dù
ghi chú cập nhật chính thức đã nêu rõ từng thay đổi, và trang mùa/patch không hiển thị được các thay
đổi đó.

Các dòng thay đổi đã có khóa chỉ số/kỹ năng cùng giá trị cũ và mới, đủ để mô tả thay đổi mà không
cần snapshot đầy đủ của tướng ở patch đó.

## Quyết định

- Change set của tướng có nguồn `sourceKind`:
  - `SNAPSHOT`: như hiện tại, đích là revision GAME_PATCH đã xuất bản đúng variant; giá trị chỉ
    số/vai trò/ảnh được đối chiếu với snapshot nguồn và đích.
  - `PATCH_NOTES`: ghi từ ghi chú cập nhật chính thức. Không bắt buộc revision nguồn hoặc đích; bắt
    buộc `sourceUrl` HTTP(S). Dòng STAT và SKILL phải có cả giá trị cũ và mới. Khóa chỉ số và kỹ năng
    phải thuộc snapshot đã xuất bản mới nhất của tướng trong cùng ruleset khi tướng đã có snapshot.
    Không nhận dòng VISUAL vì thay đổi ảnh cần asset thật.
- Mỗi tướng/variant vẫn tối đa một change set; change set vẫn bất biến sau khi ghi.
- Danh mục theo mùa/patch đếm cả change set từ ghi chú. Tên tướng lấy từ revision đích khi có; không
  có thì lấy snapshot chưa hủy mới nhất của tướng trong ruleset.
- Không suy luận BUFF/NERF từ dấu của giá trị; người biên tập chọn tính chất từng dòng.
- Dữ liệu tướng tại một patch được suy ra khi đọc, không lưu thành snapshot:
  - có revision đã xuất bản đúng patch: dùng revision đó (quan sát);
  - có revision đã xuất bản trước patch: áp xuôi giá trị mới của các change set trong khoảng
    `(mốc trước, patch]`;
  - chỉ có revision sau patch: áp ngược giá trị cũ của các change set trong khoảng `(patch, mốc sau]`
    theo thứ tự giảm dần.
  Giá trị bị chạm được đánh dấu suy ra, kèm change set; phần còn lại giữ như bản neo và đánh dấu chưa
  xác minh. Kỹ năng chỉ trả giá trị theo trường đã ghi vì nội dung kỹ năng là mô tả tự do.

## Hệ quả

- Ghi được thay đổi của các patch đã qua mà không cần thu thập lại toàn bộ dữ liệu tướng.
- Kết quả suy ra chỉ đúng khi ghi chú cập nhật đầy đủ; giao diện phải hiển thị rõ nguồn suy ra và
  phần chưa xác minh, không trình bày như dữ liệu đã quan sát.
- Bảng `hero.hero_patch_change_set` thêm `source_kind`, `source_url` và cho phép revision đích null
  với nguồn `PATCH_NOTES`. Dữ liệu cũ mặc định là `SNAPSHOT`.
- Trang bị, phụ trợ, bảng ngọc và phù hiệu chưa áp dụng quyết định này; mở rộng sau theo cùng mô hình.
