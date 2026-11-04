# AOV Stream

Giao diện công khai cho dữ liệu giải đấu được biên tập tại admin. Biểu tượng cú quan sát/ngôi sao là SVG, có thể điều chỉnh màu mà không tạo nhiều bản ảnh.

## Chạy cục bộ

Trong `frontend`, chạy `pnpm --filter @aov/aov-stream dev`. Ứng dụng dùng cổng 5174, proxy `/api/community` đến community-service cổng 8082. WiKi dùng cổng 8080 và frontend WiKi dùng 5173; admin dùng 5175. Có thể thay các địa chỉ bằng biến trong `.env.example`.

## Chuyển giữa Stream và Wiki

Trên desktop, tên AOV Stream cạnh logo cú mở menu gồm AOV Wiki và AOV Stream; ứng dụng hiện tại có nhãn **Đang xem**. Trên điện thoại, hai ô chuyển ứng dụng nằm trong menu “⋯”. Menu và chữ logo dùng chung thiết kế với Wiki, theo giao diện sáng/tối của Stream. Header không còn liên kết Wiki riêng để tránh trùng chức năng; liên kết Wiki ở cuối trang dùng cùng địa chỉ đích. Điều hướng chính gồm Bảng tin, Giải đấu và Khám phá; trên điện thoại các mục nằm ở hàng dưới header. Nhấn logo để về Bảng tin. Tra cứu ván đấu là liên kết phụ trong Giải đấu.

`VITE_WIKI_URL` đặt địa chỉ Wiki. Nếu bỏ trống, dùng cùng giao thức và hostname với Stream, cổng `5173` (kể cả IP mạng LAN). Khi triển khai, đặt URL công khai đầy đủ trước khi build, ví dụ `VITE_WIKI_URL=https://wiki.example.com`. Nếu dùng đường dẫn con, URL phải trỏ tới thư mục gốc của frontend đó. Khởi động lại dev server sau khi đổi biến môi trường.

Chiều Wiki → Stream dùng `VITE_STREAM_URL` trong `apps/aov-wiki`. Cả hai chiều chuyển trong cùng tab, không chuyển các bộ lọc riêng của ứng dụng.

## Dữ liệu và phạm vi

Icon tài khoản trên header mở popup khi hover, nhấn hoặc dùng bàn phím. Trên mobile, nút “⋯” mở drawer gọn: hàng tài khoản ở đầu, hai ô Wiki/Stream cạnh nhau, rồi ngôn ngữ và Sáng/Tối. Sau đăng nhập, các liên kết tài khoản xếp hai cột. Drawer dùng chung `PublicPreferencesDrawer` với Wiki; thanh kéo mảnh 36×3px nằm trong vùng kéo 64×24px, chỉ vùng này nhận thao tác kéo đóng. Nội dung cuộn độc lập, lớp nền mờ nhẹ và hiệu ứng mở 240ms; tôn trọng thiết lập giảm chuyển động. Popup desktop gom ngôn ngữ,
giao diện sáng/tối và đăng nhập; sau đăng nhập có các liên kết tài khoản và đăng xuất. Ngôn ngữ
hiện áp dụng cho menu tài khoản, điều hướng chính và trang đăng nhập; nội dung cộng đồng vẫn theo
ngôn ngữ tác giả, các màn hình nghiệp vụ còn lại dùng tiếng Việt. Lựa chọn giao diện/ngôn ngữ được lưu cục bộ.

Popup và drawer dùng màu nền, viền và trạng thái chọn từ bộ biến `--hub-*` của Stream. Ngôn ngữ dùng Select của `@aov/ui`; lựa chọn hiện tại, Sáng/Tối, tab, bộ lọc và điều hướng dùng cùng tông tím chàm/tím nhạt của chữ Stream trên cả hai giao diện. Hover của thẻ trang và ván đấu nhấn viền/nền nhẹ theo màu thương hiệu, không dịch chuyển vị trí thẻ.

Bố cục dùng mật độ gọn: header cao 52px trên desktop và 48px trên mobile. Các khối dùng chung biến khoảng cách `--hub-space-*`, `--hub-panel-padding` và `--hub-layout-gap`: padding và khoảng cách giữa khối là 16px trên desktop, 12px trên mobile; khoảng cách bên trong thường là 4/8/12px. Không cộng thêm padding bài viết vào mép khối đã có padding. Nhãn và điều khiển dùng chữ 12–13px đậm vừa, tiêu đề thẻ 14px; nội dung bài viết giữ 14px. Danh bạ mobile hiển thị từng hàng với avatar và tên được xuống dòng, không dùng thẻ ảnh bìa hai cột. Tab và nút trên mobile vẫn giữ vùng bấm 40–44px.

Trang hồ sơ đặt nút Theo dõi ở đầu trang cho cả khách và thành viên; khách chỉ nhận lời nhắc đăng nhập khi bấm.
Mạng xã hội/website hiển thị bằng icon thương hiệu ở góc dưới bên phải ảnh bìa. Hover mở ngay popup thông tin;
bấm icon giữ popup mở, không chuyển trang. Chỉ nút “Mở liên kết” mới mở kênh ở tab mới. Popup không có hiệu ứng
zoom/trượt và có khoảng chờ đóng ngắn để di chuột từ icon vào nội dung. Trên mobile, chạm icon mở drawer dưới.
Menu “⋯” của trang chứa nguồn thông tin, đề xuất chỉnh sửa và yêu cầu/quyền quản lý trang.
Nguồn được xem công khai trong hộp thoại; gửi đề xuất hoặc yêu cầu đại diện vẫn cần đăng nhập.

Các popup trên mobile (dưới 768px) của Wiki và Stream dùng drawer dưới qua `public-overlay` và `public-select`:
thông tin kênh/nguồn ảnh, menu trang/bài viết, thông báo, lời nhắc đăng nhập, biểu mẫu và danh sách chọn.
Riêng tìm kiếm chung của Stream mở rộng ngay trên header để ô nhập và kết quả nằm cùng một trang.
Drawer chỉ kéo đóng bằng tay nắm; nội dung cuộn riêng, có nút đóng, vùng an toàn đáy và chế độ giảm chuyển động.
Các drawer/sheet đã tồn tại giữ nguyên hướng mở. Desktop giữ popover, menu và hộp thoại tương ứng.

Đăng nhập dùng trang AOV riêng trên máy chủ xác thực, Code + PKCE S256; vẫn dùng phiên SSO chung
với Wiki và quay về URL đang xem. Xem [cài đặt theme](../../../backend/wiki-service/infra/local/keycloak-themes/README.md).

- Trang chủ `/` là bảng tin cộng đồng. Danh bạ và tìm kiếm nằm ở `/explore`; `/pages` chuyển về `/explore`, giữ query và hash. Hồ sơ từng trang giữ `/pages/:code`.
- Bảng tin có các bộ lọc Tất cả, Đang theo dõi, Video và Tin tức; không chèn danh sách ván đấu vào luồng bài viết. Kết quả trận nằm trong Giải đấu → Lịch & kết quả. Liên kết cũ `/?tab=results` chuyển tới `/competitions?tab=schedule&scope=results`.
- Mục **Giải đấu** `/competitions` có Các giải đấu và Lịch & kết quả (`?tab=schedule`). Danh mục nhóm theo hệ thống giải, lọc khu vực/năm/trạng thái/từ khóa; lịch nhóm theo ngày, lọc giai đoạn, ngày và lịch/kết quả. Bộ lọc nằm trên URL. Đọc hết các trang snapshot công bố trước khi lọc để không bỏ sót mùa giải.
- Mùa giải `/competitions/:id` mở mặc định Lịch & kết quả; các tab còn lại là BXH & nhánh đấu, Đội tham dự, Thông tin. Mỗi trận trỏ tới `/competitions/:id/matches/:matchKey`. Trên mobile, chạm trận mở drawer dưới xem nhanh tỷ số và chọn ván; có liên kết mở trang trận đầy đủ.
- Các ván trong trận lấy đúng `seriesId`, sắp xếp theo số ván, không tìm theo tên trận. `/matches/:seriesId` hỗ trợ quay lại từ ván cũ; ưu tiên kế hoạch đã công bố khi liên kết được, nếu không dùng thông tin trong snapshot ván. Thiếu ván chi tiết không làm mất lịch hoặc tỷ số trận. Không suy ra trạng thái trực tiếp chỉ từ giờ dự kiến.
- `/games` là **Tra cứu ván đấu**, không nằm ngang hàng với Giải đấu trong menu chính. `/games/:id` có đường dẫn Giải → Trận → Ván và thanh chuyển các ván cùng trận.
- Ô tìm kiếm chung luôn nằm trên header, kể cả Khám phá; từ khóa hiển thị theo URL và kết quả gồm trang, bài viết, giải đấu. Ở màn hình nhỏ, kính lúp mở ô nhập rộng ngay trên header; có nút quay lại và hỗ trợ Escape để đóng, gửi tìm kiếm sẽ thu bàn phím để xem kết quả bên dưới. Khám phá không có ô tìm kiếm riêng hoặc các lối tắt Giải đấu/Lịch & kết quả; mặc định tập trung vào nội dung cộng đồng, danh bạ và khu vực.
- Danh sách ván đấu chỉ lấy các ván đã xuất bản; bộ lọc giải và tìm đội nằm trên URL. Cuộn gần cuối tự tải trang kế tiếp. Chưa có dữ liệu thì hiển thị trạng thái trống; không trộn dữ liệu minh họa vào giải thật.
- `/games/:id` hiển thị cấm/chọn, 5 vị trí mỗi đội, tên tuyển thủ và một phụ trợ. Ảnh/tên dùng bản chụp đã lưu khi xuất bản, cùng mùa/patch riêng của ván. Hai ván trong một giải có thể dùng patch khác nhau.
- Dữ liệu ngọc/phù hiệu phân biệt đã ghi nhận, nguồn không hiển thị và chưa thu thập. Không hiển thị bộ trống như thể tuyển thủ không dùng.
- Trang bị là 6 ô ở các mốc quan sát. Chọn thời gian dùng bản ghi gần nhất trước hoặc tại mốc đó; không lấy ảnh tương lai. Giao dịch mua/bán/nâng cấp/đổi ô hiển thị riêng, không suy đoán từ khác biệt giữa hai ảnh. Ô “?” là chưa quan sát; ô trống là đã xác nhận trống.
- Nội dung công khai không gọi API admin hoặc gửi credential. Các bộ dữ liệu được cache ngắn bằng TanStack Query, request hỗ trợ hủy; khi cập nhật lỗi giữ nội dung đã tải và cho thử lại.

## Kiểm tra

`pnpm --filter @aov/aov-stream build`

`pnpm --filter @aov/aov-stream test:tournaments`

`pnpm --filter @aov/aov-stream test:account`

