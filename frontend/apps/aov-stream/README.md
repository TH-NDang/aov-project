# AOV Stream

Giao diện công khai cho dữ liệu giải đấu được biên tập tại admin. Biểu tượng cú quan sát/ngôi sao là SVG, có thể điều chỉnh màu mà không tạo nhiều bản ảnh.

## Chạy cục bộ

Trong `frontend`, chạy `pnpm --filter @aov/aov-stream dev`. Ứng dụng dùng cổng 5174, proxy `/api/community` đến community-service cổng 8082. WiKi dùng cổng 8080 và frontend WiKi dùng 5173; admin dùng 5175. Có thể thay các địa chỉ bằng biến trong `.env.example`.

## Dữ liệu và phạm vi

- Trang chủ chỉ lấy các ván đã xuất bản; bộ lọc giải và tìm đội nằm trên URL. Cuộn gần cuối tự tải trang kế tiếp. Chưa có dữ liệu thì hiển thị trạng thái trống; không trộn dữ liệu minh họa vào giải thật.
- `/games/:id` hiển thị cấm/chọn, 5 vị trí mỗi đội, tên tuyển thủ và một phụ trợ. Ảnh/tên dùng bản chụp đã lưu khi xuất bản, cùng mùa/patch riêng của ván. Hai ván trong một giải có thể dùng patch khác nhau.
- Dữ liệu ngọc/phù hiệu phân biệt đã ghi nhận, nguồn không hiển thị và chưa thu thập. Không hiển thị bộ trống như thể tuyển thủ không dùng.
- Trang bị là 6 ô ở các mốc quan sát. Chọn thời gian dùng bản ghi gần nhất trước hoặc tại mốc đó; không lấy ảnh tương lai. Giao dịch mua/bán/nâng cấp/đổi ô hiển thị riêng, không suy đoán từ khác biệt giữa hai ảnh. Ô “?” là chưa quan sát; ô trống là đã xác nhận trống.
- Nội dung công khai không gọi API admin hoặc gửi credential. Các bộ dữ liệu được cache ngắn bằng TanStack Query, request hỗ trợ hủy; khi cập nhật lỗi giữ nội dung đã tải và cho thử lại.

## Kiểm tra

`pnpm --filter @aov/aov-stream build`

`pnpm --filter @aov/aov-stream test:tournaments`

