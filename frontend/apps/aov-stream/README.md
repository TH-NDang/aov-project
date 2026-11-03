# AOV Stream

Giao diện công khai cho dữ liệu giải đấu được biên tập tại admin. Biểu tượng cú quan sát/ngôi sao là SVG, có thể điều chỉnh màu mà không tạo nhiều bản ảnh.

## Chạy cục bộ

Trong `frontend`, chạy `pnpm --filter @aov/aov-stream dev`. Ứng dụng dùng cổng 5174, proxy `/api/community` đến community-service cổng 8082. WiKi dùng cổng 8080 và frontend WiKi dùng 5173; admin dùng 5175. Có thể thay các địa chỉ bằng biến trong `.env.example`.

## Chuyển giữa Stream và Wiki

Trên desktop, tên AOV Stream cạnh logo cú mở menu gồm AOV Wiki và AOV Stream; ứng dụng hiện tại có nhãn **Đang xem**. Trên điện thoại, hai ô chuyển ứng dụng nằm trong menu “⋯”. Menu và chữ logo dùng chung thiết kế với Wiki, theo giao diện sáng/tối của Stream. Header không còn liên kết Wiki riêng để tránh trùng chức năng; liên kết Wiki ở cuối trang dùng cùng địa chỉ đích. Điện thoại không có thanh điều hướng cố định dưới; Ván đấu và Cộng đồng nằm trong menu “⋯” trên header; nhấn logo để về Trang chủ.

`VITE_WIKI_URL` đặt địa chỉ Wiki. Nếu bỏ trống, dùng cùng giao thức và hostname với Stream, cổng `5173` (kể cả IP mạng LAN). Khi triển khai, đặt URL công khai đầy đủ trước khi build, ví dụ `VITE_WIKI_URL=https://wiki.example.com`. Nếu dùng đường dẫn con, URL phải trỏ tới thư mục gốc của frontend đó. Khởi động lại dev server sau khi đổi biến môi trường.

Chiều Wiki → Stream dùng `VITE_STREAM_URL` trong `apps/aov-wiki`. Cả hai chiều chuyển trong cùng tab, không chuyển các bộ lọc riêng của ứng dụng.

## Dữ liệu và phạm vi

Icon tài khoản trên header mở popup khi hover, nhấn hoặc dùng bàn phím. Trên mobile, nút “⋯” mở drawer gọn: hàng tài khoản ở đầu, hai ô Wiki/Stream cạnh nhau, rồi ngôn ngữ và Sáng/Tối. Sau đăng nhập, các liên kết tài khoản xếp hai cột. Drawer dùng chung `PublicPreferencesDrawer` với Wiki; thanh kéo mảnh 36×3px nằm trong vùng kéo 64×24px, chỉ vùng này nhận thao tác kéo đóng. Nội dung cuộn độc lập, lớp nền mờ nhẹ và hiệu ứng mở 240ms; tôn trọng thiết lập giảm chuyển động. Popup desktop gom ngôn ngữ,
giao diện sáng/tối và đăng nhập; sau đăng nhập có các liên kết tài khoản và đăng xuất. Ngôn ngữ
hiện áp dụng cho menu tài khoản, điều hướng chính và trang đăng nhập; nội dung cộng đồng vẫn theo
ngôn ngữ tác giả, các màn hình nghiệp vụ còn lại dùng tiếng Việt. Lựa chọn giao diện/ngôn ngữ được lưu cục bộ.

Popup và drawer dùng màu nền, viền và trạng thái chọn từ bộ biến `--hub-*` của Stream. Ngôn ngữ dùng Select của `@aov/ui`; lựa chọn hiện tại, Sáng/Tối, tab, bộ lọc và điều hướng dùng cùng tông tím chàm/tím nhạt của chữ Stream trên cả hai giao diện. Hover của thẻ trang và ván đấu nhấn viền/nền nhẹ theo màu thương hiệu, không dịch chuyển vị trí thẻ.

Bố cục dùng mật độ gọn: header cao 52px trên desktop và 48px trên mobile; khoảng cách chính 12–16px, padding khối thường 14–16px. Nhãn và điều khiển dùng chữ 12–13px đậm vừa, tiêu đề thẻ 14px; nội dung bài viết giữ 14px. Banner, ảnh bìa và avatar trong danh bạ thu nhỏ tương ứng; tab và nút trên mobile vẫn giữ vùng bấm 40–44px.

Đăng nhập dùng trang AOV riêng trên máy chủ xác thực, Code + PKCE S256; vẫn dùng phiên SSO chung
với Wiki và quay về URL đang xem. Xem [cài đặt theme](../../../backend/wiki-service/infra/local/keycloak-themes/README.md).

- Trang chủ chỉ lấy các ván đã xuất bản; bộ lọc giải và tìm đội nằm trên URL. Cuộn gần cuối tự tải trang kế tiếp. Chưa có dữ liệu thì hiển thị trạng thái trống; không trộn dữ liệu minh họa vào giải thật.
- `/games/:id` hiển thị cấm/chọn, 5 vị trí mỗi đội, tên tuyển thủ và một phụ trợ. Ảnh/tên dùng bản chụp đã lưu khi xuất bản, cùng mùa/patch riêng của ván. Hai ván trong một giải có thể dùng patch khác nhau.
- Dữ liệu ngọc/phù hiệu phân biệt đã ghi nhận, nguồn không hiển thị và chưa thu thập. Không hiển thị bộ trống như thể tuyển thủ không dùng.
- Trang bị là 6 ô ở các mốc quan sát. Chọn thời gian dùng bản ghi gần nhất trước hoặc tại mốc đó; không lấy ảnh tương lai. Giao dịch mua/bán/nâng cấp/đổi ô hiển thị riêng, không suy đoán từ khác biệt giữa hai ảnh. Ô “?” là chưa quan sát; ô trống là đã xác nhận trống.
- Nội dung công khai không gọi API admin hoặc gửi credential. Các bộ dữ liệu được cache ngắn bằng TanStack Query, request hỗ trợ hủy; khi cập nhật lỗi giữ nội dung đã tải và cho thử lại.

## Kiểm tra

`pnpm --filter @aov/aov-stream build`

`pnpm --filter @aov/aov-stream test:tournaments`

`pnpm --filter @aov/aov-stream test:account`

