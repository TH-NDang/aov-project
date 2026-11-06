# Thiết kế dùng chung cho 3 app

Wiki, Stream và Admin là một họ sản phẩm nên dùng chung màu, phông chữ, bo góc và cách dựng bề mặt. Nguồn duy nhất là
`packages/ui/src/styles/tokens.css`; `globals.css` ánh xạ các token này sang biến của shadcn, còn `wiki.css` và
`stream.css` chỉ đặt tên lại, không khai báo giá trị màu riêng.

## Màu

- Mỗi màu dùng `light-dark()`, nên tự theo `color-scheme` mà từng app đang đặt: Wiki luôn tối, Stream và Admin theo lựa
  chọn của người xem hoặc hệ thống. Không viết lại bảng màu cho chế độ tối.
- Một màu nhấn vàng cho cả họ sản phẩm (`--aov-accent`). Mỗi màn hình chỉ nên có một nút chính dùng màu này.
- Màu trạng thái (`--aov-success`, `--aov-danger`, `--aov-warning`, `--aov-info`, `--aov-live`) chỉ mang ý nghĩa trạng
  thái, không dùng để trang trí.
- Các cặp chữ/nền chính đạt tỉ lệ tương phản AA (từ 4.5:1) ở cả hai chế độ. Khi đổi màu phải kiểm tra lại.
- Màu cố định chỉ còn ở phần phủ lên ảnh: banner, ảnh bìa, gradient nền tướng. Ảnh là nội dung nên giữ tông riêng.
- Biểu đồ một chuỗi số liệu dùng `--chart-1` (lấy từ `--aov-chart`). Màu này tối hơn màu nhấn vì màu nhấn quá sáng cho
  mảng đặc trên nền tối.

## Chữ

- Phông Be Vietnam Pro (`@fontsource/be-vietnam-pro`, trọng số 400–700), được thiết kế cho dấu tiếng Việt.
- Wiki và Stream dùng 13px cho chú thích, 15px hoặc 14px cho nội dung thường, 16px cho phần đọc dài. Các vai trò của Wiki
  nằm trong `apps/aov-wiki/src/styles/typography.css`.
- Admin giữ thang 12/14/16/24 và các lớp `type-*` theo `AGENTS.md`.

## Hình khối và bề mặt

- Bo góc: 6px cho điều khiển, 10px cho thẻ, 14px cho ảnh lớn; chỉ chip mới bo tròn hẳn.
- Không lồng khung trong khung. Một mục gồm tiêu đề và nội dung nằm thẳng trên nền trang; chỉ thứ bấm được hoặc nhóm cần
  tách biệt mới là thẻ.
- Thẻ dùng màu nền `--aov-surface`, không thêm viền và bóng. Trạng thái rê chuột dùng `--aov-raised`.
- Chiều rộng nội dung tối đa `--aov-page-max` (1280px), lề `--aov-gutter`.

## Minh họa

Hình vẽ dùng chung nằm trong ba sprite ở `packages/ui/src/assets`, mỗi hình khung 64×64, cùng một bộ màu và viền tối để nhìn liền nhau:

- `nav-art.svg`: mục điều hướng và các nhóm nội dung, dùng qua `navArtIcons`.
- `gameplay-art.svg`: chỉ số và thuật ngữ trong game, dùng qua `gameplayIcons`. `termIcon(id)` chọn hình cho thuật ngữ chưa có ảnh riêng.
- `change-art.svg`: loại thay đổi của một phiên bản, dùng qua `changeKindIcons`. Hiển thị từ 16px trở lên, nhỏ hơn thì viền lấn mất hình.

Còn trống hình thì thêm symbol vào sprite rồi khai báo trong file `*-icons.tsx` tương ứng, không nhúng SVG rời vào từng trang. Chỉ số trang bị lấy icon từ `ITEM_STATS` trong `lib/item-description.ts`.

Trạng thái trống và không tìm thấy dùng linh vật: Wiki gắn class `wiki-mascot-state`, Stream dùng `.hub-state`.

## Admin

Thanh điều hướng nằm bên trái. Để đổi lại bên phải, thêm `side="right"` cho `Sidebar` trong `app-sidebar.tsx` và đặt
`AppSidebar` sau `SidebarInset` trong `app-shell.tsx`.

## Trang đăng nhập

Theme Keycloak `aov-public` dùng cùng giá trị màu và phông nhưng phải chép tay vì chạy ngoài ứng dụng React. Khi đổi màu nhấn hoặc màu nền trong `tokens.css`, sửa cả `infra/local/keycloak-themes/aov-public/login/resources/css/aov-login.css` trong `backend/wiki-service`.

## Phiên đăng nhập của Wiki và Stream

Token vẫn chỉ nằm trong bộ nhớ theo ADR-008. Khi tải lại trang hoặc mở tab mới, ứng dụng hỏi lại Keycloak bằng `prompt=none` trong một iframe ẩn và nhận mã qua `/auth/callback`. Người chưa từng đăng nhập không phát sinh yêu cầu này, nhờ một dấu trong `localStorage` không chứa thông tin xác thực.
