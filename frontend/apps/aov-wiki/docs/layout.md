# Bố cục thân trang

Tham chiếu: https://wiki.hoyolab.com/pc/hsr/home (đo ở 1440px).

## Trạng thái hiện tại

Trang chủ giữ header, ảnh nền và thêm câu chào, banner tự chuyển cùng khung cập nhật mùa hiện tại. Chưa triển khai lại danh sách hoặc chi tiết tướng.

## Khối trang chủ

- Nội dung rộng tối đa 1188px, căn giữa với lề 24px; mobile dùng lề 15px. Desktop hiển thị banner bên trái, cập nhật mùa bên phải; từ 960px trở xuống hai khối xếp dọc.
- Trên desktop đủ rộng, banner có kích thước khoảng 852 × 284px, khung cập nhật rộng 336px. Khối chào mừng có thêm khoảng thở phía trên và dưới; tiêu đề dùng Cambria, dự phòng Times New Roman để hiển thị dấu tiếng Việt đồng nhất.
- Banner dùng ba ảnh tướng đã có trên CDN, chữ ngắn và bố cục theo vị trí nhân vật. Tự chuyển mỗi 6 giây, hỗ trợ vuốt, nút trước/sau, chọn ảnh và tạm dừng. Tự chuyển dừng khi hover, focus, tab bị ẩn hoặc người dùng bật giảm chuyển động. Nút trước/sau hiện khi hover hoặc focus trên desktop; mobile dùng vuốt và các chấm chọn.
- Đường tiến trình 3px ở mép dưới banner thể hiện thời gian tới lần chuyển tiếp theo. CSS animation và timeout cùng chu kỳ 6 giây; tạm dừng giữ phần thời gian còn lại, đổi slide thì bắt đầu lại. Không cập nhật state React theo từng khung hình.
- Resize hoặc đổi breakpoint giữ nguyên chu kỳ nếu vẫn xem cùng banner; sự kiện khởi tạo lại bố cục của carousel không đặt lại tiến trình.
- Mobile dùng banner ngang 3:1, khung cập nhật mùa gọn bên dưới và tách nền khỏi banner. Vùng ảnh trượt tràn thêm 1px mỗi mép bên trong khung cắt để tránh lộ ảnh liền kề do làm tròn vị trí ở kích thước lẻ.
- Cập nhật lấy từ API public `GET /api/wiki/v1/seasons/current/updates?region=VN&locale=vi-VN&limit=4`, dùng TanStack Query: dữ liệu mới trong 60 giây, tự kiểm tra lại mỗi 5 phút khi tab đang mở. Chỉ hiện patch đã công bố và có hiệu lực trong mùa áp dụng cho Việt Nam; không suy đoán mùa nếu backend chưa xác nhận.
- Ngày patch giữ đúng độ chính xác backend; đường dẫn nguồn mở tab mới nếu có URL HTTPS hợp lệ. Lỗi kết nối có nút thử lại.
- Bên dưới là 5 ô danh mục Tướng, Trang phục, Kho trang bị, Bản đồ, Chế độ chơi. Đợt này chỉ làm các ô, chưa gắn điều hướng hay số lượng. Cả desktop và mobile dùng 5 cột; nhãn tự xuống dòng khi cần. Icon SVG dạng khối vàng nhiều lớp nằm trong huy hiệu tròn, không thêm ảnh vào Git.

## Ảnh nền đầu trang

- `PageBackdrop` (`src/components/page-backdrop.tsx`): `position: fixed`, lớp màu phủ hết chiều ngang, ảnh căn giữa giới hạn 1440px, cao `min(540px, 50svh)` để không vượt nửa chiều cao màn hình, `background-size: cover`, căn trên, độ mờ 45%, nằm dưới mọi nội dung (`-z-10`).
- Lớp `::after` phủ toàn bộ vùng nền, chuyển từ trong suốt ở mốc 32,6% sang màu nền trang ở đáy.
- Ảnh đứng yên khi cuộn, nội dung trượt lên trên ảnh.
- Điện thoại (≤640px): ảnh cuộn theo trang (`absolute`), cao `min(66.667vw, 25svh)` để không vượt một phần tư chiều cao màn hình, độ hiện ảnh 45%, gradient bắt đầu từ 45% chiều cao ảnh và chuyển về nền tối ở đáy.
- Chưa có ảnh: hiện quầng sáng hổ phách (`--amber-accent`) làm chỗ giữ chỗ.
- Thêm ảnh: đặt file vào `public/images/` (ví dụ `home-bg.jpg`) rồi gán `HOME_BACKGROUND = { image: "/images/home-bg.jpg", color: "#27283f" }` trong `src/App.tsx`. Nên dùng ảnh ngang, rộng ≥ 1920px, chủ thể ở nửa trên vì phần dưới bị gradient che.

## Font chữ

- Cả trang dùng **Tahoma** (dự phòng Helvetica, Arial), giống HoYoWiki dùng cho tiếng Việt và các ngôn ngữ chữ Latin.
- Token trong `wiki.css`: `--font-sans` (mặc định cho cả trang) và `--font-heading` (hiện trỏ về `--font-sans`, dùng qua class `font-heading` cho tiêu đề). Muốn đổi font tiêu đề sau này chỉ cần sửa token này.
- Tahoma là font hệ thống, chỉ có 2 độ đậm: thường (400) và đậm (700). Dùng `font-normal`/`font-bold`; `font-medium`/`font-semibold` sẽ hiển thị như thường hoặc đậm.
- Có sẵn trên Windows và macOS; Android/iOS không có nên trình duyệt dùng Helvetica/Arial/Roboto thay thế.
- Wordmark AOVWiKi trên header vẫn giữ Arial Black.

- Hai mép ảnh dùng mask chuyển mượt vào lớp màu xung quanh; lớp màu đậm dần về nền trang ở hai bên. Cấu hình image/color độc lập để sau này lấy từ backend. Trên 4K ảnh vẫn rộng tối đa 1440px.
