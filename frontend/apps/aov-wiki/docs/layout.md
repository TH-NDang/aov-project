# Bố cục thân trang

Tham chiếu: https://wiki.hoyolab.com/pc/hsr/home (đo ở 1440px).

## Trạng thái hiện tại

Trang chủ giữ header, ảnh nền, câu chào, banner tự chuyển cùng khung cập nhật mùa hiện tại. Thư viện Tướng dùng bố cục riêng tại `/hero`; chi tiết tại `/hero/:heroCode` hiện tập trung vào tên và ảnh tướng. Các route Tướng được tải riêng khi truy cập, không đưa toàn bộ giao diện thư viện vào lần tải trang chủ.

## Khối trang chủ

- Nội dung rộng tối đa 1188px, căn giữa với lề 24px; mobile dùng lề 15px. Desktop hiển thị banner bên trái, cập nhật mùa bên phải; từ 960px trở xuống hai khối xếp dọc.
- Trên desktop đủ rộng, banner có kích thước khoảng 852 × 284px, khung cập nhật rộng 336px. Khối chào mừng có thêm khoảng thở phía trên và dưới; tiêu đề dùng Cambria, dự phòng Times New Roman để hiển thị dấu tiếng Việt đồng nhất.
- Banner dùng ba ảnh tướng đã có trên CDN, chữ ngắn và bố cục theo vị trí nhân vật. Tự chuyển mỗi 6 giây, hỗ trợ vuốt, nút trước/sau, chọn ảnh và tạm dừng. Tự chuyển dừng khi hover, focus, tab bị ẩn hoặc người dùng bật giảm chuyển động. Nút trước/sau hiện khi hover hoặc focus trên desktop; mobile dùng vuốt và các chấm chọn.
- Đường tiến trình 3px ở mép dưới banner thể hiện thời gian tới lần chuyển tiếp theo. CSS animation và timeout cùng chu kỳ 6 giây; tạm dừng giữ phần thời gian còn lại, đổi slide thì bắt đầu lại. Không cập nhật state React theo từng khung hình.
- Resize hoặc đổi breakpoint giữ nguyên chu kỳ nếu vẫn xem cùng banner; sự kiện khởi tạo lại bố cục của carousel không đặt lại tiến trình.
- Mobile dùng banner ngang 3:1, khung cập nhật mùa gọn bên dưới và tách nền khỏi banner. Vùng ảnh trượt tràn thêm 1px mỗi mép bên trong khung cắt để tránh lộ ảnh liền kề do làm tròn vị trí ở kích thước lẻ.
- Cập nhật lấy từ API public `GET /api/wiki/v1/seasons/current/updates?region=VN&locale=vi-VN&limit=4`, dùng TanStack Query: dữ liệu mới trong 60 giây, tự kiểm tra lại mỗi 5 phút khi tab đang mở. Chỉ hiện patch đã công bố và có hiệu lực trong mùa áp dụng cho Việt Nam; không suy đoán mùa nếu backend chưa xác nhận.
- Ngày patch giữ đúng độ chính xác backend; đường dẫn nguồn mở tab mới nếu có URL HTTPS hợp lệ. Lỗi kết nối có nút thử lại.
- Bên dưới là 5 ô danh mục Tướng, Trang phục, Kho trang bị, Bản đồ, Chế độ chơi. Ô Tướng dùng `Link` đến `/hero`; các ô còn lại chưa mở trang nội dung và chưa hiển thị số lượng. Cả desktop và mobile dùng 5 cột; nhãn tự xuống dòng khi cần. Icon SVG dạng khối vàng nhiều lớp nằm trong huy hiệu tròn, không thêm ảnh vào Git.

## Thư viện Tướng

- `/hero` dùng nền xanh xám riêng, nội dung căn giữa và giới hạn chiều ngang. Desktop có mục lục bên trái, ghim dưới header; phần danh sách bên phải. Từ 640px trở xuống, mục lục chuyển thành tấm trượt từ phải qua (`Sheet` của `@aov/ui`), mở bằng icon trên header. Nhóm **Sổ tay nhân vật** gồm **Danh sách tướng** dẫn đến `/hero` và **Trang phục** ghi “Sắp có”; Kho trang bị, Bản đồ, Chế độ chơi là các mục ngang hàng bên ngoài nhóm và chưa mở nội dung.
- Danh sách lấy các tướng đã xuất bản từ API public `GET /api/wiki/v1/heroes?region=VN&locale=vi-VN&size=100&page=0`. Nếu có nhiều trang, chương trình đọc tiếp trước khi lọc; số lượng kết quả được tính từ dữ liệu thực tế, không cố định theo một bộ mẫu. Mỗi mục có thể kèm trường `portrait` để dùng ảnh `PORTRAIT` ngay từ API danh sách, không cần tải chi tiết từng tướng chỉ để lấy ảnh.
- TanStack Query giữ dữ liệu danh sách và chi tiết ở trạng thái mới trong 60 giây, dùng chung danh sách khi chuyển giữa thư viện và chi tiết. Khi lỗi có nút thử lại; khi chưa có dữ liệu hoặc không khớp bộ lọc có trạng thái riêng, không thay bằng tướng mẫu.
- Hai nhóm bộ lọc phân biệt rõ: **Vị trí** gồm Đường Caesar, Rừng, Đường giữa, Đường Rồng, Hỗ trợ; **Vai trò** gồm Đỡ đòn, Đấu sĩ, Sát thủ, Pháp sư, Xạ thủ, Trợ thủ. Mỗi lựa chọn dùng icon, tên xuất hiện khi hover hoặc focus và có nhãn cho trình đọc màn hình.
- Vai trò lấy trực tiếp từ backend. Vị trí hiện dùng bảng tham khảo tạm trong `hero-classifications.ts`, ánh xạ rõ từng mã tướng, không suy luận từ vai trò. Nhãn “Tham khảo” giải thích đây là phân loại minh họa, chờ biên tập; chưa coi đây là dữ liệu vị trí do backend quản lý.
- Trạng thái lọc lưu trên URL: `q` là tên hoặc mã tướng, `role` và `position` là các giá trị phân cách bằng dấu phẩy, ví dụ `/hero?q=amily&role=WARRIOR&position=TOP,JUNGLE`. Trong cùng nhóm chỉ cần khớp một lựa chọn; giữa tìm kiếm, vai trò và vị trí phải đồng thời khớp. Tìm kiếm không phân biệt chữ hoa, chữ thường hoặc dấu tiếng Việt, gồm cả `đ`/`d`.
- Thẻ tướng ưu tiên ảnh `PORTRAIT` thật, dùng `HEAD` nếu thiếu hoặc lỗi chân dung, rồi mới dùng chỗ giữ chỗ. Khung ảnh bất đối xứng, chỉ bo mạnh góc trên bên phải; không cắt ảnh thành hình tròn. Desktop rộng dùng 2 cột thẻ ngang, tên và vai trò lấy từ backend nằm bên cạnh ảnh, phía sau có hình vai trò trang trí rất mờ. Khoảng tablet hẹp chuyển về 1 cột; điện thoại từ 380px dùng 4 cột, hẹp hơn dùng 3 cột. Thẻ mobile giảm khoảng đệm, giữ icon vai trò và chừa hai dòng tên để hàng không đổi chiều cao theo tên. Toàn bộ thẻ mở chi tiết và giữ đường dẫn bộ lọc để quay về.
- 11 icon vị trí/vai trò trong `public/icons/hero/` là SVG có nền trong suốt. `HeroGlyph` hiển thị bằng CSS mask và `currentColor`, nên có thể đổi màu bằng CSS mà không tạo thêm bản ảnh. Các PNG nguồn trong `resources/` vẫn được giữ nguyên.

## Trạng thái chờ của thư viện

- Trong lúc tải mã trang hoặc dữ liệu, header, mục lục và khung nội dung vẫn có bố cục tương ứng. Skeleton danh sách dùng cùng khung ảnh, thân thẻ và lưới responsive với thẻ thật; trang chi tiết giữ vùng ảnh lớn, ảnh đại diện và dòng tên trước khi dữ liệu sẵn sàng.
- `WikiImage` dùng chung cho ảnh thẻ, bảng đổi tướng, ảnh đại diện và ảnh lớn. Kích thước được giữ bởi khung trước khi ảnh tải; chỉ hiện ảnh sau khi tải và giải mã xong, chuyển nhẹ trong 180ms. Các ảnh thẻ vẫn tải lười theo vùng nhìn thấy, không chờ toàn bộ danh sách mới hiện nội dung.
- Ảnh đã cache vẫn được nhận diện khi gắn vào trang. Đổi nguồn ảnh tạo trạng thái chờ riêng; kết quả tải/giải mã cũ không làm hiện nhầm ảnh mới. Lỗi chân dung thử ảnh head, lỗi ảnh lớn thử portrait; hết nguồn thì dùng chỗ giữ chỗ hoặc thông báo thiếu ảnh, không hiện biểu tượng ảnh hỏng của trình duyệt.
- Dữ liệu đã có trong cache vẫn hiển thị nếu lần cập nhật nền bị lỗi. Hiệu ứng chờ và chuyển ảnh tắt khi thiết bị bật giảm chuyển động.

## Chi tiết Tướng

- `/hero/:heroCode` dùng bố cục ảnh rộng riêng, không đặt sidebar desktop cạnh ảnh. Header vẫn có mục lục trên điện thoại. Phạm vi hiện tại chỉ gồm tên, ảnh đại diện, ảnh lớn và điều hướng trở về thư viện; chưa dựng kỹ năng, chỉ số hoặc các phần nội dung khác.
- Mã tướng trên URL được đối chiếu với danh sách đã xuất bản; chi tiết đọc từ `GET /api/wiki/v1/heroes/{id}?region=VN&locale=vi-VN`. URL ảnh dùng phiên bản Media mà backend trả về.
- Hiển thị ảnh nền `SPLASH` độ phân giải cao; chỉ dùng `PORTRAIT` dự phòng nếu thiếu hoặc lỗi ảnh nền. Không có nút chuyển loại ảnh và không phóng `HEAD` thành ảnh lớn. Nếu cả hai ảnh lớn đều không dùng được, giao diện hiển thị trạng thái thiếu ảnh.
- Cạnh tên tướng là icon tròn dùng ảnh `HEAD`, kích thước 52px trên desktop và 40px trên điện thoại. Ảnh có đệm trong 2px, viền mảnh theo màu điểm nhấn và bóng nhẹ; tên dùng cỡ 32–44px trên desktop, 26–30px trên mobile, căn giữa với ảnh và nút đổi tướng. Tên dài được xuống dòng, không đẩy nút ra ngoài màn hình. Thiếu hoặc lỗi ảnh thì dùng chân dung dự phòng, sau đó là chữ cái đầu của tên. Header chi tiết trong suốt ở đầu trang trên mọi kích thước, tối dần trong 100px cuộn đầu tiên; mobile không đặt tên tướng hoặc wordmark trên header.
- Nút icon cạnh tên mở bảng **Đổi tướng nhanh** từ bên trái trên desktop và điện thoại. Vòng tròn nhìn thấy rộng 28px, biểu tượng 16px; trên điện thoại vẫn giữ vùng chạm trong suốt 44px và căn giữa theo tên. Bảng dùng chung cache danh sách tướng, có tìm tên/mã không phân biệt dấu, lọc vai trò, đánh dấu tướng đang xem và cuộn riêng trong bảng. Chọn một tướng sẽ đóng bảng và chuyển chi tiết; chọn lại tướng hiện tại chỉ đóng bảng. Đường dẫn bộ lọc danh sách được giữ để quay về.
- Nút đóng nằm giữa mép phải bảng chọn, có dạng tay nắm mũi tên thu vào. Trên mobile, nút đổi tướng giữ vùng chạm 44px; nút lọc vai trò thu còn 32px và vị trí 34px để bảng gọn hơn. Vai trò cuộn ngang, vị trí cuộn dọc khi thiếu chỗ; hỗ trợ vuốt cảm ứng, bánh xe và giữ chuột rồi kéo. Kéo không kích hoạt nhầm bộ lọc. Nút “Tất cả” dùng icon bốn ô vuông và có chú thích khi hover hoặc focus. Thanh lọc có nền vừa nội dung, phân cách sau nút “Tất cả”; cột đường chỉ hiện icon, không có tiêu đề chữ. Nền tròn sau icon trên thẻ dùng độ hiện 35% để thấy ảnh bên dưới. Ô tìm kiếm dùng chữ 16px để tránh tự phóng to trên iPhone, tên thẻ 12px được xuống dòng đầy đủ. Tiêu đề, huy hiệu số lượng và ô tìm kiếm nằm cùng hàng; thông tin bộ lọc chỉ xuất hiện khi đang áp dụng. Phần đầu và cuối bảng chừa vùng an toàn của thiết bị.
- Bảng chọn có thanh lọc đường theo chiều dọc bên trái; phân loại này dùng cùng dữ liệu **tham khảo** với thư viện. Đường, vai trò và tên/mã được kết hợp để lọc. Mọi icon lọc đều có tooltip tên đầy đủ khi hover hoặc focus bằng bàn phím; tooltip vai trò hiện bên dưới, tooltip đường hiện bên phải. Thẻ dùng ảnh toàn khung, lớp chuyển màu dưới tên, không có viền trắng; icon đường và vai trò nằm trên ảnh, cách nhau 4px trên desktop và 3px trên mobile. Điện thoại từ 360px dùng 3 cột thẻ gọn; màn hình hẹp hơn dùng 2 cột để tên vẫn dễ đọc. Icon trên thẻ thu nhỏ theo ảnh; các bộ lọc có vùng cuộn riêng.
- Bảng màu trong `hero-appearance.ts` hiện được phối riêng theo ảnh của 24 tướng đang xuất bản, gồm màu bề mặt, nền và điểm nhấn. Tướng chưa có cấu hình dùng bảng màu trung tính. Đây là lựa chọn biên tập tại frontend, không phải màu suy ra từ vai trò hoặc lấy bằng canvas trên trình duyệt: CDN hiện không cung cấp CORS để đọc pixel ảnh. Đợt này không thay đổi cấu hình cloud.
- Khi thay ảnh gốc cần rà soát và cập nhật bảng màu tương ứng; về sau có thể chuyển các màu này thành metadata do backend cung cấp để đi cùng phiên bản ảnh.

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
