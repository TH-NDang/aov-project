# Thứ tự hiển thị và bố cục theo cỡ màn hình

Tài liệu này ghi cách quyết định phần nào hiện trước và đặt ở đâu trên cả ba frontend.

## Hai bố cục, một mốc

AOV Wiki và AOV Stream có hai bố cục, đổi ở mốc **900px** (`usePageLayout` trong `packages/ui/src/hooks/use-page-layout.ts`):

- **compact** (dưới 900px): điện thoại và máy bảng dọc, một cột.
- **wide** (từ 900px): có cột phụ.

Cách chọn công cụ:

| Khi nào | Dùng gì |
|---|---|
| Thứ tự các phần, cách điều hướng hoặc cách thao tác khác nhau giữa hai bố cục | Hai component riêng, chọn bằng `usePageLayout()`. Thứ tự được viết thẳng trong component |
| Cùng thứ tự, chỉ khác tỷ lệ (số cột lưới, cỡ khoảng trống) | CSS `@media` trong file của component đó |

Không dùng `order` trong CSS hay để `flex-wrap` tự quyết định thứ tự. Phần dùng chung giữa hai bố cục được tách thành component nhỏ, ví dụ `AbilityPanel` và `OverviewPanel` trong trang tướng.

## Nguyên tắc

- Phần người đọc đến trang để tìm phải nằm trong màn hình đầu hoặc chỉ cách một lần vuốt.
- Bố cục compact rút gọn phần phụ thay vì chỉ đẩy xuống: chữ dài thì cắt kèm "Xem thêm", bộ lọc gom vào một nút.
- **Không có thanh điều hướng cố định ở đáy màn hình.** Wiki mở mục lục từ nút ở đầu trang, Stream dùng hàng tab ở đầu trang.
- **Các nút không xuống dòng lẻ từng cái.** Một hàng gồm nhiều phần thì gom thành nhóm và cho cả nhóm xuống dòng cùng nhau, hoặc xếp sẵn thành hai hàng. Không để một nút hay một ô lọc rớt xuống hàng riêng.
- Dãy tab dài cuộn ngang trên một hàng, không xuống dòng.
- Ô tìm kiếm giữ độ rộng tối thiểu bằng `flex-basis`, không dùng `flex: 1` kèm `flex-wrap` vì ô sẽ bị bóp nhỏ mà các ô khác không xuống dòng.
- Tiêu đề cột và nhãn nút không xuống dòng. Bảng không đủ chỗ thì ẩn cột phụ trước.
- Nút bấm trên màn hình cảm ứng cao tối thiểu 36px. Ô nhập trên Wiki dùng chữ 16px để iPhone không tự phóng to trang.
- Khi đổi kiểu xem hoặc đổi mục, trang không được nhảy vị trí.

## Component dùng chung

| Component | Việc |
|---|---|
| `PublicFilterSheet` | Trên compact: một nút "Lọc" cạnh ô tìm kiếm, toàn bộ bộ lọc nằm trong drawer dưới và hiện số kết quả |
| `PublicTabBar` | Dãy tab dính dưới đầu trang, cuộn ngang |

## AOV Wiki

| Trang | Compact | Wide |
|---|---|---|
| Đầu trang | Một hàng: về trang chủ hoặc quay lại, tên trang, tìm kiếm, mục lục, thêm | Logo, ô tìm kiếm giữa trang, cài đặt và tài khoản |
| Điều hướng mục | Nút mục lục mở danh sách đầy đủ | Cột mục lục bên trái |
| Chi tiết tướng | Ảnh và tên → Chọn patch → Một dòng "Thay đổi ở bản này", bấm để mở xuống → Tổng quan gọn → Bộ kỹ năng → Trang phục → Video → Các lần thay đổi khác. Nút nổi mở drawer các phần | Màn đầu: ảnh tướng bên trái, bảng tên và Tổng quan bên phải. Sau đó: Chọn patch → Thay đổi → Bộ kỹ năng → Trang phục → Video → Lịch sử, mỗi phần một bảng. Từ 1180px có cột mục lục bên phải, dưới đó dùng nút nổi |
| Danh sách tướng | Ô tìm và nút Lọc dính dưới đầu trang → Thay đổi tại patch → Lưới tướng | Ô tìm → Vị trí và Vai trò → Thay đổi tại patch → Lưới tướng |
| Kho trang bị | Tab Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ → Tìm kiếm → Danh sách | Mục lục bên trái, thanh công cụ một hàng, danh sách |

## AOV Stream

Hàng tab Bảng tin, Giải đấu, Khám phá nằm ở đầu trang trên cả hai bố cục. Trang giải đấu: compact có ô tìm và nút Lọc, wide có ô tìm cùng nhóm ô lọc trên một hàng.

## Admin

Admin vẫn dùng một bố cục, co giãn bằng container query theo độ rộng khung nội dung, vì khung này đổi theo thanh bên và bảng ảnh gốc.

| Trang | Cách xử lý |
|---|---|
| Đầu trang chi tiết tướng | Tên và nhóm nút là hai khối. Không đủ chỗ thì cả nhóm nút xuống hàng dưới, điện thoại giữ nút `⋯` ở góc trên |
| Danh sách có bộ lọc | Ô tìm một khối, nhóm ô lọc một khối luôn nằm trên một hàng |
| Hồ sơ (Đội tuyển, Tuyển thủ…) | Tab trên một hàng, thiếu chỗ thì ẩn icon rồi cuộn ngang |
| Tuyển thủ | Ẩn cột theo độ rộng, tên đội chuyển xuống dòng phụ khi ẩn cột đội |
| Quản lý ảnh | Lọc nguồn một khối, loại ảnh cùng số lượng và kiểu xem một khối |

## Phong cách: Wiki và Stream khác nhau

Không dùng nền màu mờ lấy từ ảnh hay nền sặc sỡ: màu mạnh chỉ đến từ chính ảnh tướng và icon. Chuyển động nhẹ và tắt khi người đọc bật giảm chuyển động.

**Không dùng một khung cho mọi chỗ.** Mỗi loại nội dung có cách trình bày riêng. Trang nhiều dữ liệu cần nền yên tĩnh, không đặt họa tiết phía sau chữ. Ảnh mẫu chỉ để học hỏi: họa tiết và bố cục là thiết kế riêng.

### AOV Wiki: xanh than và vàng nhạt

Nền trang xanh than, bảng xám xanh, tiêu đề và dấu nhấn vàng nhạt. Màu nằm trong `tokens.css` với tên `--aov-wiki-*` và được `wiki.css` gán vào các token chung. Lớp `.public-panel` cho nội dung trong bảng thấp hơn bảng một bậc để thẻ nổi lên.

| Nội dung | Cách trình bày |
|---|---|
| Màn đầu trang tướng | `OrnatePanel`: bảng có góc vàng và hình huy hiệu mờ. Chỉ dùng ở đây |
| Bộ lọc tướng, kỹ năng đang chọn, Tổng quan trên điện thoại, Cập nhật mùa, Danh mục | `.wiki-slip`: bảng trơn bo góc |
| Kho trang bị và phần chi tiết | Đặt thẳng trên nền, thẻ bảng xám xanh, icon nổi rõ. Phần chi tiết cùng tông, icon có ánh vàng |
| Thay đổi ở bản này | Dải bảng có vạch vàng bên trái |
| Danh sách kỹ năng | Đặt thẳng trên nền, kỹ năng đang chọn có vạch vàng |
| Trang phục | Ảnh lớn đặt thẳng trên nền, viền vàng mảnh |
| Thẻ tướng | Khung xám xanh có góc vàng nhỏ, tên dưới ảnh |
| Video | Máy tính: thẻ bo góc theo lưới. Điện thoại: hàng dọc, ảnh bên trái như danh sách trong trình phát, hiện 3 mục đầu |
| Ghi chú cập nhật, Các lần thay đổi khác | Dòng thời gian: đường vàng dọc và các bảng nhỏ |
| Trang một bản cập nhật, Thuật ngữ | `.wiki-document`: một trang đọc có đường vàng ở trên |
| Danh mục ở trang chủ | Huy hiệu tròn viền vàng, nhãn vàng nhạt |
| Tham chiếu trong đoạn văn | Chữ thường cùng cỡ, chỉ khác màu, gạch chân khi rê chuột. Bôi đen được cả câu đi qua tham chiếu; thẻ thông tin chỉ mở khi bấm xong hoặc rê chuột |
| Icon thuật ngữ và chỉ số | Hình đơn sắc lấy màu chữ xung quanh |

### AOV Stream: màu của logo cú

Chàm đêm, lông xanh tím, mắt vàng, mặt kem. Màu nằm trong `tokens.css` với tên `--aov-stream-*`. Trang theo chế độ sáng hoặc tối của người xem, riêng thanh trên, dải tiêu đề và chân trang luôn tối.

| Nội dung | Cách trình bày |
|---|---|
| Nền trang | Hoàng hôn xanh tím, họa tiết vảy lông mờ dần từ đầu trang |
| Thanh trên | Dải chàm đêm, mục đang chọn là viên vàng như mắt cú |
| Tiêu đề trang | Dải chàm bo góc, hình cú ở cuối dải |
| Tiêu đề mục | Một chấm vàng như mắt cú |
| Mục đang chọn | Trang sáng: nền chàm, chữ kem. Trang tối: nền vàng, chữ chàm. Tab giữ chữ thường và có vạch vàng |
| Chữ logo | Vẽ bằng nét tròn đậm cho hợp con cú: AOV màu kem của mặt cú, Stream màu xanh tím của lông, kèm ngôi sao nhỏ của logo |
| Mục đang ở trên đầu trang | Khối bo góc màu chàm giống nền logo, chữ kem đậm, ngôi sao nhỏ ở góc |
| Thẻ hồ sơ | Ảnh bìa phía trên, viền sáng lên khi rê chuột |

Chưa dùng Three.js và ảnh tạo bằng AI, vì SVG và CSS đủ cho các họa tiết hiện có. Chỉ thêm khi có cảnh hoặc hình mà SVG không vẽ được.

## Cách đo lại

Mỗi lần đổi bố cục lớn, mở trang ở các độ rộng 375, 480, 640, 768, 900, 1024, 1180, 1280, 1440 và 1600px. Kiểm tra: không tràn ngang, không có nút rớt dòng một mình, nhãn nút không xuống dòng, không có chữ dưới 12px, phần chính nằm trong một đến hai màn hình đầu.
