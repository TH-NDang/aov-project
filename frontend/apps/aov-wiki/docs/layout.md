# Bố cục thân trang

Tham chiếu: https://wiki.hoyolab.com/pc/hsr/home (đo ở 1440px).

## Độ rộng nội dung

- `PageContainer` (`src/components/page-container.tsx`): rộng tối đa **1188px**, căn giữa — token `--container-page` trong `wiki.css`, dùng qua class `max-w-page`.
- Khác HoYoWiki: bản PC của họ cố định 1188px và cuộn ngang khi màn hình hẹp hơn. Ở đây dùng `box-content` + lề 24px (15px dưới 640px) nên nội dung co theo màn hình, không cuộn ngang. Lề trên điện thoại 15px như HoYoWiki.

## Ảnh nền đầu trang

- `PageBackdrop` (`src/components/page-backdrop.tsx`): `position: fixed`, lớp màu phủ hết chiều ngang, ảnh căn giữa giới hạn 1440px, cao 540px, `background-size: cover`, căn trên, độ mờ 45%, nằm dưới mọi nội dung (`-z-10`).
- Lớp `::after` cao 364px ở đáy chuyển từ trong suốt sang màu nền trang, nên ảnh tan dần vào nền.
- Ảnh đứng yên khi cuộn, nội dung trượt lên trên ảnh.
- Điện thoại (≤640px), như bản mobile HoYoWiki: ảnh cuộn theo trang (`absolute`), cao 2/3 chiều rộng màn hình (250px ở 375px), độ hiện ảnh 45%, gradient bắt đầu từ 45% chiều cao ảnh và chuyển về nền tối ở đáy.
- Chưa có ảnh: hiện quầng sáng hổ phách (`--amber-accent`) làm chỗ giữ chỗ.
- Thêm ảnh: đặt file vào `public/images/` (ví dụ `home-bg.jpg`) rồi gán `HOME_BACKGROUND = { image: "/images/home-bg.jpg", color: "#27283f" }` trong `src/App.tsx`. Nên dùng ảnh ngang, rộng ≥ 1920px, chủ thể ở nửa trên vì phần dưới bị gradient che.

## Khoảng cách

- Khối chào mừng: đệm trên 71px, dưới 49px; tiêu đề 40px/49px màu `text-gold`, đổ bóng nhẹ như HoYoWiki.
- Điện thoại: đệm 15px; tiêu đề lớn chỉ còn cho trình đọc màn hình (`sr-only`), hiển thị dòng phụ đề vàng 13.5px với đường kẻ vàng mờ dần bên dưới — giống HoYoWiki mobile.
- Nội dung trang chủ đặt trong `PageContainer` thứ hai của `App.tsx`.
- `main` có đệm dưới 100px, khớp khoảng cách tới footer của HoYoWiki.

## Font chữ

- Cả trang dùng **Tahoma** (dự phòng Helvetica, Arial), giống HoYoWiki dùng cho tiếng Việt và các ngôn ngữ chữ Latin.
- Token trong `wiki.css`: `--font-sans` (mặc định cho cả trang) và `--font-heading` (hiện trỏ về `--font-sans`, dùng qua class `font-heading` cho tiêu đề). Muốn đổi font tiêu đề sau này chỉ cần sửa token này.
- Tahoma là font hệ thống, chỉ có 2 độ đậm: thường (400) và đậm (700). Dùng `font-normal`/`font-bold`; `font-medium`/`font-semibold` sẽ hiển thị như thường hoặc đậm.
- Có sẵn trên Windows và macOS; Android/iOS không có nên trình duyệt dùng Helvetica/Arial/Roboto thay thế.
- Wordmark AOVWiKi trên header vẫn giữ Arial Black.

- Hai mép ảnh dùng mask chuyển mượt vào lớp màu xung quanh; lớp màu đậm dần về nền trang ở hai bên. Cấu hình image/color độc lập để sau này lấy từ backend. Trên 4K ảnh vẫn rộng 1440px, nội dung vẫn giới hạn 1188px.
