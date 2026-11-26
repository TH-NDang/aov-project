# AOV Stream

Giao diện công khai cho dữ liệu giải đấu được biên tập tại admin. Biểu tượng cú quan sát/ngôi sao là SVG, có thể điều chỉnh màu mà không tạo nhiều bản ảnh.

## Chạy cục bộ

Trong `frontend`, chạy `pnpm --filter @aov/aov-stream dev`. Ứng dụng dùng cổng 5174, proxy `/api/community` đến community-service cổng 8082. WiKi dùng cổng 8080 và frontend WiKi dùng 5173; admin dùng 5175. Có thể thay các địa chỉ bằng biến trong `.env.example`.

## Chuyển giữa Stream và Wiki

Trên desktop, tên AOV Stream cạnh logo cú mở menu gồm AOV Wiki và AOV Stream; ứng dụng hiện tại có nhãn **Đang xem**. Trên điện thoại, hai ô chuyển ứng dụng nằm trong menu “⋯”. Menu và chữ logo dùng chung thiết kế với Wiki, theo giao diện sáng/tối của Stream. Header không còn liên kết Wiki riêng để tránh trùng chức năng; liên kết Wiki ở cuối trang dùng cùng địa chỉ đích. Điều hướng chính gồm Bảng tin, Giải đấu và Khám phá; trên điện thoại các mục nằm ở hàng dưới header. Nhấn logo để về Bảng tin. Ván đấu xem trong trận của nó hoặc từ thống kê của giải.

`VITE_WIKI_URL` đặt địa chỉ Wiki. Nếu bỏ trống, dùng cùng giao thức và hostname với Stream, cổng `5173` (kể cả IP mạng LAN). Khi triển khai, đặt URL công khai đầy đủ trước khi build, ví dụ `VITE_WIKI_URL=https://wiki.example.com`. Nếu dùng đường dẫn con, URL phải trỏ tới thư mục gốc của frontend đó. Khởi động lại dev server sau khi đổi biến môi trường.

Chiều Wiki → Stream dùng `VITE_STREAM_URL` trong `apps/aov-wiki`. Cả hai chiều chuyển trong cùng tab, không chuyển các bộ lọc riêng của ứng dụng.

## Tiêu đề và tìm kiếm

Mỗi trang đặt tiêu đề, mô tả, canonical và thẻ xem trước qua `<StreamHead>` (`components/stream-head.tsx`), không dùng thẻ `<title>` trực tiếp. Trang tài khoản, quản lý trang, lời mời, đăng nhập và địa chỉ không có trang được gắn `noindex`; địa chỉ lạ hiện trang “Không tìm thấy trang” thay vì chuyển về trang chủ. Xem thêm [SEO của Wiki](../aov-wiki/docs/seo.md#stream).

## Dữ liệu và phạm vi

Icon tài khoản trên header mở popup khi hover, nhấn hoặc dùng bàn phím. Trên mobile, nút “⋯” mở drawer gọn: hàng tài khoản ở đầu, hai ô Wiki/Stream cạnh nhau, rồi ngôn ngữ và Sáng/Tối. Sau đăng nhập, các liên kết tài khoản xếp hai cột. Drawer dùng chung `PublicPreferencesDrawer` với Wiki; thanh kéo mảnh 36×3px nằm trong vùng kéo 64×24px, chỉ vùng này nhận thao tác kéo đóng. Nội dung cuộn độc lập, lớp nền mờ nhẹ và hiệu ứng mở 240ms; tôn trọng thiết lập giảm chuyển động. Popup desktop gom ngôn ngữ,
giao diện sáng/tối và đăng nhập; sau đăng nhập có các liên kết tài khoản và đăng xuất. Ngôn ngữ
hiện áp dụng cho menu tài khoản, điều hướng chính và trang đăng nhập; nội dung cộng đồng vẫn theo
ngôn ngữ tác giả, các màn hình nghiệp vụ còn lại dùng tiếng Việt. Lựa chọn giao diện/ngôn ngữ được lưu cục bộ.

Popup và drawer dùng màu nền, viền và trạng thái chọn từ bộ biến `--hub-*` của Stream. Ngôn ngữ dùng Select của `@aov/ui`; lựa chọn hiện tại, Sáng/Tối, tab, bộ lọc và điều hướng dùng cùng tông tím chàm/tím nhạt của chữ Stream trên cả hai giao diện. Hover của thẻ trang và ván đấu nhấn viền/nền nhẹ theo màu thương hiệu, không dịch chuyển vị trí thẻ.

Bố cục dùng mật độ gọn: header cao 52px trên desktop và 48px trên mobile. Các khối dùng chung biến khoảng cách `--hub-space-*`, `--hub-panel-padding` và `--hub-layout-gap`: padding và khoảng cách giữa khối là 16px trên desktop, 12px trên mobile; khoảng cách bên trong thường là 4/8/12px. Không cộng thêm padding bài viết vào mép khối đã có padding. Nhãn và điều khiển dùng chữ 12–13px đậm vừa; nội dung bài viết 15px. Danh bạ là các bức tường logo khi chưa lọc và từng hàng với hình và tên được xuống dòng khi đã lọc, không dùng thẻ ảnh bìa hai cột. Tab và nút trên mobile vẫn giữ vùng bấm 40–44px.

Trang hồ sơ đặt nút Theo dõi ở đầu trang cho cả khách và thành viên; khách chỉ nhận lời nhắc đăng nhập khi bấm.
Mạng xã hội/website hiển thị bằng icon thương hiệu ở chân đầu trang, cạnh các con số. Hover mở ngay popup thông tin;
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
- Đội, tuyển thủ và nhân sự chưa có trang riêng mở `/teams/:id`, `/players/:id`, `/people/:id`, dựng từ các giải đã công bố, cùng đầu trang (`components/page-head.tsx`), giá treo áo (`team-lineup.tsx`) và kệ cúp (`title-shelf.tsx`) với trang riêng.
- Thành tích của một trang là hồ sơ của nó cộng với hạng ở các giải đã công bố (`features/community/model/profile-records-model.ts`): kết quả đã có trong hồ sơ thì chỉ thêm liên kết, khớp theo mã giải, theo cùng các chữ trong tên hoặc theo cùng ngày kết thúc và cùng hạng.
- Cúp trên kệ (`lib/title-model.ts`) theo hạng, loại và quốc gia các đội của giải; giải chưa công bố thì theo hệ thống giải mà tên nó bắt đầu bằng. Đương kim vô địch chỉ nói khi đã đọc đủ các mùa của hệ thống giải đó (`circuitCompetitionsQuery`), và chỉ hỏi những hệ thống có danh hiệu gần đây. Mùa liên tiếp không tính qua khoảng trống đủ cho một mùa chưa công bố.
- Bài đăng trình bày theo thứ bài mang (`features/community/model/post-form.ts`); bài trên trang của chính nó nhóm theo ngày của người xem.
- Bảng tin có các bộ lọc Tất cả, Đang theo dõi, Video và Tin tức; không chèn danh sách ván đấu vào luồng bài viết. Kết quả trận nằm trong Giải đấu → Lịch & kết quả. Liên kết cũ `/?tab=results` chuyển tới `/competitions?tab=schedule&scope=results`.
- Mục **Giải đấu** `/competitions` có Các giải đấu và Lịch & kết quả (`?tab=schedule`). Danh mục mở đầu bằng giải đang diễn ra, bảng tỉ số, giải sắp tới và cờ của các đương kim vô địch, rồi bản đồ các mùa giải của một năm, mỗi hệ thống giải một làn (`lib/season-map.ts`); tìm thì thành danh sách mùa của mọi năm. Danh mục chọn theo năm, theo khu vực khi bản đồ dài và theo từ khóa; lịch nhóm theo ngày, chọn lịch/kết quả, khu vực và ngày. Lựa chọn nằm trên URL. Đọc hết các trang snapshot công bố trước khi lọc để không bỏ sót mùa giải.
- Mùa giải `/competitions/:id` mở mặc định Tổng quan; các tab còn lại là Lịch & kết quả, BXH & nhánh đấu, Thống kê, Đội tham dự, Thể thức & thông tin. Thống kê (`GET /competitions/{id}/statistics`) chỉ hiện khi giải có ván đã xuất bản; `?tab=stats&hero=<id>` mở các ván của một tướng. Mỗi trận trỏ tới `/competitions/:id/matches/:matchKey`.
- Kế hoạch nhập từ nguồn ngoài chỉ ghi đội của từng trận, nên Stream suy ra phần còn lại từ kết quả: đường nối và tên vòng của nhánh đấu (`lib/bracket-model.ts`), các bảng của vòng tròn (`lib/standings-model.ts`), nhà vô địch của giải đã kết thúc chưa có bảng chung cuộc (`lib/champion-model.ts`). Dữ liệu ghi rõ luôn được dùng trước; không suy ra khi nhánh đấu kết thúc ở nhiều trận hoặc giải là vòng loại.
- Các ván trong trận lấy đúng `seriesId`, sắp xếp theo số ván, không tìm theo tên trận. `/matches/:seriesId` hỗ trợ quay lại từ ván cũ; ưu tiên kế hoạch đã công bố khi liên kết được, nếu không dùng thông tin trong snapshot ván. Thiếu ván chi tiết không làm mất lịch hoặc tỷ số trận. Không suy ra trạng thái trực tiếp chỉ từ giờ dự kiến.
- Không có trang danh sách ván: `/games` chuyển về trận (`?series=`), thống kê của giải (`?tournament=`) hoặc Giải đấu. `/games/:id` có đường dẫn tới giải và trận, cùng thanh chuyển các ván cùng trận ở chân sân khấu.
- Vào và ra một mục: `components/travel.tsx` bọc `Routes`, giữ chỗ cuộn của từng mục lịch sử (cũng qua lần tải lại, trong `sessionStorage`), đặt tiêu điểm vào `main` khi mở trang mới và vào dòng vừa mở khi quay ra; quy tắc hướng đi nằm ở `lib/travel.ts`. Trang đánh dấu đầu trang bằng `data-place-head` và hình của nó bằng `data-place-mark`; hình trong danh sách được nhận ra qua `MARKS`. Trang mới khai báo các chặng phía trên bằng `Place[]` (`components/place-trail.tsx`), không thêm nút quay lại; trang liền kề lấy từ `lib/neighbours.ts`.
- Ô tìm kiếm chung luôn nằm trên header, kể cả Khám phá; từ khóa hiển thị theo URL và kết quả gồm trang, bài viết, giải đấu. Ở màn hình nhỏ, kính lúp mở ô nhập rộng ngay trên header; có nút Đóng ở cuối ô và hỗ trợ Escape, gửi tìm kiếm sẽ thu bàn phím để xem kết quả bên dưới. Khám phá không có ô tìm kiếm riêng hoặc các lối tắt Giải đấu/Lịch & kết quả; mặc định tập trung vào nội dung cộng đồng, danh bạ và khu vực.
- Thống kê và các ván của một tướng chỉ tính ván đã xuất bản. Cuộn gần cuối tự tải trang kế tiếp. Không trộn dữ liệu minh họa vào giải thật.
- `/games/:id` hiển thị đội hình từng đường đối mặt nhau, lượt cấm, tên tuyển thủ, một phụ trợ, thứ tự cấm chọn và diễn biến khi đã ghi nhận. Ảnh/tên dùng bản chụp đã lưu khi xuất bản, cùng mùa/patch riêng của ván. Hai ván trong một giải có thể dùng patch khác nhau.
- Dữ liệu ngọc/phù hiệu phân biệt đã ghi nhận, nguồn không hiển thị và chưa thu thập. Không hiển thị bộ trống như thể tuyển thủ không dùng.
- Trang bị là 6 ô ở các mốc quan sát. Chọn thời gian dùng bản ghi gần nhất trước hoặc tại mốc đó; không lấy ảnh tương lai. Giao dịch mua/bán/nâng cấp/đổi ô hiển thị riêng, không suy đoán từ khác biệt giữa hai ảnh. Ô “?” là chưa quan sát; ô trống là đã xác nhận trống.
- Nội dung công khai không gọi API admin hoặc gửi credential. Các bộ dữ liệu được cache ngắn bằng TanStack Query, request hỗ trợ hủy; khi cập nhật lỗi giữ nội dung đã tải và cho thử lại.

## Kiểm tra

`pnpm --filter @aov/aov-stream build`

`pnpm --filter @aov/aov-stream test:tournaments`

`pnpm --filter @aov/aov-stream test:account`

