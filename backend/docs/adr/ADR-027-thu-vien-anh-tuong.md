# ADR-027 — Thư viện ảnh của tướng

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-12

## Bối cảnh

Phần "Ảnh" của trang tướng chỉ hiện ba ảnh của bản đang mở: đại diện, chân dung và ảnh nền. Ảnh của các bản cũ vẫn
còn trong media nhưng không có chỗ nào để xem lại. Ví dụ, Preyta đổi ảnh tướng và bộ icon chiêu khi được làm lại ngày
29/09/2026. Một số ảnh không thuộc bản nào: icon chiêu trước khi làm lại lấy từ nguồn ngoài, sticker chibi, ảnh sự
kiện. Media chỉ ghi các ảnh này trong ghi chú nguồn, không nối với tướng.

## Quyết định

- Thư viện ảnh của một tướng gồm hai phần:
  - **Ảnh theo bản**: mọi ảnh mà các bản chưa hủy của tướng đang hiện, tính khi đọc, không lưu thêm. Gồm ảnh tướng
    (đại diện, chân dung, nền), ảnh trang phục, icon chiêu, icon trạng thái chiêu và ảnh thư viện kỹ năng. Mỗi ảnh ghi
    các bản dùng nó, bản đó đang hiệu lực, là bản cũ hay bản nháp, và patch của bản.
  - **Ảnh gắn thêm**: ảnh có sẵn trong media được gắn thẳng vào tướng, cho ảnh không bản nào dùng. Lưu ở
    `hero.hero_gallery_item`, gồm loại (`HERO_ART`, `SKIN`, `SKILL`, `STICKER`, `OTHER`), chú thích, mã chiêu hoặc
    trang phục nếu có, và tùy chọn "dùng đến trước patch" (`untilPatchVariantId`) cho ảnh của giai đoạn trước một
    patch.
- Ảnh gắn thêm là dữ liệu sắp xếp, không phải lịch sử: sửa được, bỏ được (ảnh vẫn ở media), có hiệu lực ngay, không
  cần xuất bản lại tướng. Mỗi tướng gắn một ảnh tối đa một lần. Loại phải hợp với loại ảnh trong media: `HERO_ART` nhận
  ảnh đại diện, chân dung, nền; `SKIN` nhận ảnh trang phục; `SKILL` nhận icon kỹ năng; `STICKER` nhận sticker chibi;
  `OTHER` nhận mọi loại.
- Module hero báo các ảnh gắn thêm là nơi dùng ảnh (`GALLERY:<loại>`, đang hiển thị), để thư viện media không coi
  chúng là ảnh bỏ trống.
- Admin hiện thư viện trong phần "Ảnh" của trang tướng, chia tab theo loại, có ô xem lớn và lọc bản đang dùng hay bản
  cũ. Wiki công khai dùng cùng dữ liệu sau, qua API riêng chỉ trả bản đã xuất bản.

## Hệ quả

- Ảnh của bản cũ và icon chiêu trước khi làm lại được xem lại ở một chỗ, không phải tạo snapshot giả.
- Sticker và ảnh sự kiện gắn được vào tướng mà không đổi dữ liệu tướng.
- Thêm bảng `hero.hero_gallery_item` (migration `V066`) và các API `admin/heroes/{heroId}/gallery`.
