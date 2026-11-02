# AOV Stream

Giao diện công khai cho dữ liệu giải đấu được biên tập tại admin. Biểu tượng cú quan sát/ngôi sao là SVG, có thể điều chỉnh màu mà không tạo nhiều bản ảnh.

## Chạy cục bộ

Trong `frontend`, chạy `pnpm --filter @aov/aov-stream dev`. Ứng dụng dùng cổng 5174, proxy `/api/community` đến community-service cổng 8082. WiKi dùng cổng 8080 và frontend WiKi dùng 5173; admin dùng 5175. Có thể thay các địa chỉ bằng biến trong `.env.example`.

## Chuyển giữa Stream và Wiki

Tên AOV Stream cạnh logo cú là nút mở menu gồm AOV Wiki và AOV Stream; ứng dụng hiện tại có nhãn **Đang xem**. Menu và chữ logo dùng chung thiết kế với Wiki, theo giao diện sáng/tối của Stream và hoạt động trên desktop/điện thoại. Header không còn liên kết Wiki riêng để tránh trùng chức năng; các liên kết Wiki ở cuối trang và menu dưới điện thoại dùng cùng địa chỉ đích.

`VITE_WIKI_URL` đặt địa chỉ Wiki. Nếu bỏ trống, dùng cùng giao thức và hostname với Stream, cổng `5173` (kể cả IP mạng LAN). Khi triển khai, đặt URL công khai đầy đủ trước khi build, ví dụ `VITE_WIKI_URL=https://wiki.example.com`. Nếu dùng đường dẫn con, URL phải trỏ tới thư mục gốc của frontend đó. Khởi động lại dev server sau khi đổi biến môi trường.

Chiều Wiki → Stream dùng `VITE_STREAM_URL` trong `apps/aov-wiki`. Cả hai chiều chuyển trong cùng tab, không chuyển các bộ lọc riêng của ứng dụng.

## Dữ liệu và phạm vi

- Trang chủ chỉ lấy các ván đã xuất bản; bộ lọc giải và tìm đội nằm trên URL. Cuộn gần cuối tự tải trang kế tiếp. Chưa có dữ liệu thì hiển thị trạng thái trống; không trộn dữ liệu minh họa vào giải thật.
- `/games/:id` hiển thị cấm/chọn, 5 vị trí mỗi đội, tên tuyển thủ và một phụ trợ. Ảnh/tên dùng bản chụp đã lưu khi xuất bản, cùng mùa/patch riêng của ván. Hai ván trong một giải có thể dùng patch khác nhau.
- Dữ liệu ngọc/phù hiệu phân biệt đã ghi nhận, nguồn không hiển thị và chưa thu thập. Không hiển thị bộ trống như thể tuyển thủ không dùng.
- Trang bị là 6 ô ở các mốc quan sát. Chọn thời gian dùng bản ghi gần nhất trước hoặc tại mốc đó; không lấy ảnh tương lai. Giao dịch mua/bán/nâng cấp/đổi ô hiển thị riêng, không suy đoán từ khác biệt giữa hai ảnh. Ô “?” là chưa quan sát; ô trống là đã xác nhận trống.
- Nội dung công khai không gọi API admin hoặc gửi credential. Các bộ dữ liệu được cache ngắn bằng TanStack Query, request hỗ trợ hủy; khi cập nhật lỗi giữ nội dung đã tải và cho thử lại.

## Kiểm tra

`pnpm --filter @aov/aov-stream build`

`pnpm --filter @aov/aov-stream test:tournaments`

`pnpm --filter @aov/aov-stream test:account`

