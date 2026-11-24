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
- **Không có thanh điều hướng cố định ở đáy màn hình.** Wiki mở mục lục từ nút ở đầu trang, Stream dùng hàng tab ở đầu trang. Một nút tròn nổi mở drawer mục lục (trang tướng trên Wiki, ngăn chi tiết trang bị, ngọc, phụ trợ, phù hiệu trong Admin) không phải thanh điều hướng.
- **Các nút không xuống dòng lẻ từng cái.** Một hàng gồm nhiều phần thì gom thành nhóm và cho cả nhóm xuống dòng cùng nhau, hoặc xếp sẵn thành hai hàng. Không để một nút hay một ô lọc rớt xuống hàng riêng.
- Dãy tab dài cuộn ngang trên một hàng, không xuống dòng.
- Ô tìm kiếm giữ độ rộng tối thiểu bằng `flex-basis`, không dùng `flex: 1` kèm `flex-wrap` vì ô sẽ bị bóp nhỏ mà các ô khác không xuống dòng.
- Tiêu đề cột và nhãn nút không xuống dòng. Bảng không đủ chỗ thì ẩn cột phụ trước.
- Nút bấm trên màn hình cảm ứng cao tối thiểu 36px, nên 40px trên compact. Ô nhập trên điện thoại dùng chữ 16px để iPhone không tự phóng to trang.
- Khi đổi kiểu xem hoặc đổi mục, trang không được nhảy vị trí.

## Component dùng chung

| Component | Việc |
|---|---|
| `PublicFilterSheet` | Trên compact: một nút "Lọc" cạnh ô tìm kiếm, toàn bộ bộ lọc nằm trong drawer dưới và hiện số kết quả |
| `PublicTabBar` | Dãy tab dính dưới đầu trang, cuộn ngang |
| `CatalogHeading` (Wiki, `apps/aov-wiki/src/layout/catalog-heading.tsx`) | Đầu trang danh sách trên wide: tiêu đề, một dòng mờ, tối đa một nút hoặc phiên bản dữ liệu bên phải, đường quay lại cho trang con. Trên compact không hiện, vì header đã ghi tên trang; trang không có tên trên header (Liên hệ, Tài khoản) bật `compact` để giữ lại |

## AOV Wiki

Trang nằm trong cột `--aov-page-max` (1280px) với lề `--wiki-gutter`, cùng cột với thanh đầu trang. Không có cột mục
lục bên trái và không có thanh điều hướng ở đáy màn hình.

| Trang | Compact | Wide |
|---|---|---|
| Đầu trang | Một hàng cao 48px: logo (trang chủ) hoặc nút về trang chủ hoặc quay lại, tên trang ở giữa màn hình, tìm kiếm, mục lục, "⋯". Bấm tìm kiếm thì cả hàng thành nút đóng và ô nhập | Một thanh cao 56px: logo và menu chuyển ứng dụng, ô tìm kiếm ở giữa, thị trường và tài khoản |
| Điều hướng mục | Nút mục lục mở tấm trượt bên phải với mọi mục theo nhóm | Trang chủ có các ô mục; trang danh sách và tham khảo có sidebar các mục bên trái, dưới 1180px chỉ còn icon |
| Đầu trang danh sách | Tên trang nằm trên header, trang không lặp lại. Trang con (một chế độ, một bản cập nhật) tự có đường quay lại và tên | `CatalogHeading`: tiêu đề, một dòng mờ, phiên bản dữ liệu hoặc một nút bên phải; trang con có đường quay lại phía trên tiêu đề |
| Trang chủ | Ảnh tướng của ngày ở trên, header trong suốt đè lên → tiêu đề, ô tìm lớn, dòng bản đang áp dụng → 9 ô mục thành 3 × 3, icon trên tên, không có số đếm → Thay đổi ở bản đang áp dụng, hai tướng một hàng → Các bản cập nhật → Vai trò | Ảnh tướng của ngày phủ nửa phải, tiêu đề và ô tìm lớn bên trái → 9 ô mục trên một hàng (3 × 3 dưới 1180px) → Thay đổi ở bản đang áp dụng bên trái, Các bản cập nhật và 6 vai trò ở cột phải 340px (300px dưới 1180px) |
| Chi tiết tướng | Ảnh, tên, vai trò, giá và nút Video trên ảnh → Phiên bản dữ liệu (menu các bản có thay đổi) → Một dòng "Thay đổi ở bản …", bấm để mở xuống → Tổng quan gọn → Bộ kỹ năng → Build đề cử (khi có) → Trang phục → Video → Tướng cùng vị trí (một hàng cuộn ngang). Nút nổi mở drawer các phần | Màn đầu: tên, vai trò, giá và Tổng quan bên trái, ảnh tướng phủ bên phải, mờ dần vào nền. Sau đó: Phiên bản dữ liệu (menu các bản có thay đổi) → Thay đổi ở bản đang xem → Bộ kỹ năng → Build đề cử → Trang phục → Video → Tướng cùng vị trí, đặt thẳng trên nền. Từ 1180px có cột "Trên trang này" bên phải, dưới đó dùng nút nổi |
| Danh sách tướng | Ô tìm và nút Lọc (Vị trí, Vai trò trong drawer) dính dưới đầu trang → dòng phiên bản dữ liệu → Thay đổi ở bản đang xem → Lưới tướng 5 cột (4 dưới 720px, 3 dưới 480px) | Tiêu đề và phiên bản dữ liệu → Ô tìm, chip Vị trí và Vai trò có icon và tên → Thay đổi ở bản đang xem → Lưới tướng 7 cột (6 dưới 1100px) |
| Trang phục | Ô tìm và nút Lọc (tướng, bậc, hai kiểu sắp xếp trong drawer) dính dưới đầu trang → dòng phiên bản → bộ lọc đang chọn thành chip bỏ được, kèm số kết quả → mỗi tướng một hàng vuốt ngang, thẻ cuối bị mép màn hình cắt để báo còn nữa | Tiêu đề, số trang phục và phiên bản → thanh công cụ một hàng dính dưới đầu trang: tìm, tướng, bậc, sắp xếp → mỗi tướng một hàng 8, 7 hoặc 6 thẻ trọn vẹn tùy độ rộng, cuối hàng là ô "+N" mở hết hàng tại chỗ. Lọc một tướng, hoặc tìm và lọc bậc ra nhiều tướng, thì thành một lưới |
| Kho trang bị | Đầu trang trong suốt, ghi tên phần đang xem ở giữa, phủ mờ khi cuộn; các phần khác mở từ nút mục lục → Khung minh họa: số mục, câu dẫn và một câu về cách phần này hoạt động bên trái, ảnh của chính phần đó dựng thành cảnh bên phải (phù hiệu: một bộ mẫu, ba bậc của hệ chính nối bằng đường màu hệ và hai phù hiệu hệ khác; các phần khác: ảnh xếp như kệ trưng bày) → Ô tìm và nút Lọc → dòng phiên bản → Danh mục (trang bị là danh sách dưới 768px vì sơ đồ cửa hàng cần ba cột). Chọn một mục mở tấm chi tiết từ bên phải, từ dưới lên khi màn hình từ 640px trở xuống | Khung minh họa có viền: tên phần và số mục, câu dẫn, câu về cách hoạt động, phiên bản dữ liệu bên trái; cùng cảnh như trên điện thoại, dàn rộng trên ba phần năm bên phải → một hàng tìm kiếm và bộ lọc (trang bị có thêm nút chuyển Sơ đồ / Danh sách và một hàng chip chỉ số) → Danh mục rộng hết cột; chọn một mục thì chi tiết đứng bên phải, rộng 320–380px |
| Một bản cập nhật | Quay lại "Tất cả bản cập nhật" → tên bản và thông tin → hàng mục lục cuộn ngang, có ảnh tướng → thay đổi theo nhóm Tướng, Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ | Tiêu đề có đường quay lại, ngày và nguồn → thay đổi theo nhóm bên trái, mục lục dính bên phải tô sáng mục đang đọc |
| Chế độ chơi | Ô tìm → hàng chip lọc cuộn ngang → Cẩm nang nổi bật (ảnh nhỏ cạnh tên) → các nhóm, mỗi chế độ một hàng: ảnh nhỏ, tên, thời lượng, tình trạng → ghi chú lịch ở cuối | Tiêu đề, số chế độ và ghi chú lịch → Ô tìm và chip lọc một hàng → Cẩm nang nổi bật → Lưới thẻ có ảnh theo nhóm PVP, Chế độ giải trí, tối đa 6 thẻ một hàng (4 dưới 1180px) |
| Một chế độ | Quay lại và tên chế độ → Hàng tab cẩm nang dính dưới đầu trang (khi chế độ có cẩm nang) → Ảnh → Giới thiệu → Thông tin nhanh dạng ô → Một câu nêu những gì chưa ghi nhận → Luật chơi gấp theo nhóm, nhóm đầu mở sẵn → Nguồn | Tiêu đề có đường quay lại → Hàng tab → Ảnh bên trái; giới thiệu, thông tin nhanh dạng hàng ngăn bằng vạch và nguồn bên phải → Luật chơi |
| Cẩm nang Cờ Liên quân | Quân cờ: ô tìm, nút Lọc (giá, Phe, Nghề) và nút chuyển Theo giá / Chỉ số; theo giá là tiêu đề từng giá rồi lưới 5 cột (7 cột từ 600px) chỉ ảnh và tên; bảng chỉ số chỉ giữ cột đang sắp xếp để không cuộn ngang; bấm quân mở chi tiết trong ngăn kéo. Phe & Nghề: danh mục, bấm một mục mở chi tiết trong ngăn kéo; bảng Phe × Nghề cuộn ngang, cột Nghề đứng yên. Trang bị, Chúc phúc, Nhiệm vụ: các hàng ngăn bằng vạch; Chúc phúc lọc bằng ô tìm và chip theo bậc. Đội hình: nút chuyển Bàn cờ / Danh sách; bàn cờ 3 hàng × 7 ô vuông (hàng trước ở trên, phía đối thủ), quân chưa có ô nằm ở hàng chờ dưới bàn; danh sách 5 quân một hàng. Xếp đội hình: bàn cờ là phần chính — bấm ô trống mở sheet chọn quân cho đúng ô đó, bấm quân để chọn rồi bấm ô khác để chuyển hoặc đổi chỗ; chế độ danh sách là 10 ô + ô thêm → Phe/Nghề đang kích hoạt | Quân cờ: một hàng công cụ (tìm, chip giá, chip Phe và chip Nghề mở bảng chọn, nút chuyển); mỗi giá một hàng như cửa hàng trong game, 14 quân một hàng từ 1180px, 7 quân dưới đó; bảng chỉ số sắp được theo nhiều cột. Phe & Nghề: danh mục bên trái, chi tiết bên phải dính dưới hàng tab. Đội hình: mỗi đội hình một thẻ, hai thẻ một hàng. Xếp đội hình: thẻ bàn cờ và mọi quân chờ bên dưới để bấm hoặc kéo vào ô, Phe/Nghề đang kích hoạt ở cột phải. Phân tích: hai cột |

## AOV Stream

Hàng tab Bảng tin, Giải đấu, Khám phá nằm ở đầu trang trên cả hai bố cục: trên wide nằm trong thanh trên, trên compact
là hàng thứ hai dính ở đầu màn hình. Trang nằm trong cột `--aov-page-max` với lề `--hub-gutter`, cùng cột với thanh trên.

| Trang | Compact | Wide |
|---|---|---|
| Đầu trang | Hàng thương hiệu cao 48px (cú, chữ AOV Stream, nút tìm kiếm, chuông khi đã đăng nhập, "⋯" dưới 768px hoặc tài khoản) cuộn đi khi đọc; hàng tab bên dưới dính lại, cuộn ngang, dưới 420px bỏ icon. Bấm tìm kiếm thì nút quay lại và ô nhập thay hàng thương hiệu | Một thanh cao 56px: cú và menu chuyển ứng dụng, ba mục, ô tìm kiếm, chuông thông báo và tài khoản. Dưới 1100px ô tìm thu thành nút, bấm thì ô nhập chiếm cả thanh |
| Bảng tin | Dải Trận đấu cuộn ngang → chip lọc bảng tin → bài viết, tải thêm khi cuộn | Dải Trận đấu → bảng tin bên trái, cột phụ 320px bên phải: Giải đang và sắp diễn ra; Tham gia cộng đồng khi chưa đăng nhập, Đang theo dõi và Gợi ý theo dõi khi đã đăng nhập. Dưới 1100px cột phụ ẩn vì chỉ chứa lối tắt đã có ở chỗ khác |
| Giải đấu | Tiêu đề và nút Tra cứu ván đấu → tab Các giải đấu, Lịch & kết quả → ô tìm và nút Lọc → Đang và sắp diễn ra → các hệ thống giải. Ở tab Lịch & kết quả, chip Tất cả, Lịch đấu, Kết quả nằm hàng riêng dưới ô tìm | Tiêu đề, một dòng mờ và nút Tra cứu ván đấu → tab → ô tìm cùng nhóm ô lọc trên một hàng (chip Tất cả, Lịch đấu, Kết quả cạnh ô tìm) → Đang và sắp diễn ra → mỗi hệ thống giải một nhóm, mùa mới nhất trước, mùa cũ gấp lại |
| Một giải | Quay lại Tất cả giải đấu → đầu giải (logo, hệ thống giải, tên, trạng thái, ngày, số đội, giải thưởng, nhà vô địch) → tab Tổng quan, Lịch & kết quả, BXH & nhánh đấu, Đội tham dự, cuộn ngang → Tổng quan: trận, bảng xếp hạng, nhánh đấu, rồi Thông tin, Thể thức, Giải thưởng cá nhân | Như compact; từ 1080px Thông tin, Thể thức, Giải thưởng cá nhân nằm ở cột phải 320px |

## Admin

Admin vẫn dùng một bố cục, co giãn bằng container query theo độ rộng khung nội dung, vì khung này đổi theo thanh bên và bảng ảnh gốc.

### Trang chi tiết dạng phẳng

Nội dung của một mục (trang bị, ngọc, phụ trợ, phù hiệu) nằm trên **một trang cuộn** trong tab "Nội dung", mỗi phần trước đây là một tab nay là một phần có tiêu đề, giữ đúng thứ tự cũ. Các tab quản lý (Bản dịch, Lịch sử, Theo patch) vẫn là tab riêng.

- Khung đủ rộng: cột "Trên trang này" dính bên phải, tô sáng phần đang đọc, bấm để cuộn tới.
- Khung hẹp (điện thoại, hoặc khi bảng ảnh gốc chiếm chỗ): cột biến mất, thay bằng **một nút tròn nổi** ở góc dưới bên phải mở drawer dưới với cùng mục lục. Chọn một mục thì drawer đóng rồi trang mới cuộn.
- Phần nào trước đây chỉ tải khi mở tab thì nay tải khi cuộn đến gần (khoảng 600px trước khi vào màn hình). Khi nhảy tới một phần, các phần phía trên nó được tải trước rồi mới cuộn, để không có gì tải sau làm trang trôi.
- Địa chỉ cũ vẫn dùng được: `?tab=skills`, `?tab=media`… mở trang ở đúng phần, `?view=skills` cũng vậy. Bấm mục lục ghi lại `tab` vào URL; cuộn tay thì không đổi URL.
- Mỗi phần có thể nằm trong **thẻ riêng** (`framed`): viền, nền thẻ, khoảng cách 24px giữa các thẻ, để trang dài vẫn đọc rõ từng phần. Tiêu đề phần có ô icon, số đếm và nút sửa **chỉ là cây bút**.
- **Sửa ngay tại chỗ:** bấm bút thì trình sửa thay phần nội dung của đúng phần đó, tiêu đề hiện nhãn "Đang sửa", các phần khác vẫn đọc được nhưng bút bị khóa cho tới khi lưu hoặc hủy. Trong lúc sửa, cột mục lục thu vào nút nổi để trình sửa dùng hết chiều rộng.
- Mục lục chỉ tìm phần trong trang của chính nó: các trang tướng mở ở tab khác của Admin có cùng id phần.

### Trang tướng: một trang cuộn (11/11/2026)

Trang tướng trong Admin có hai tab quản lý: **Nội dung** và **Lịch sử**. Lịch sử gom phiên bản đang mở, thay đổi theo patch và phần so sánh hai phiên bản. Bản dịch không còn tab riêng: chọn ngôn ngữ ở menu ngôn ngữ trên đầu trang, mỗi ngôn ngữ có bút riêng và ô dịch hiện ngay tại chỗ. Đầu trang và hàng tab dính cùng nhau ở trên khi cuộn. Chỉ áp dụng trong Admin, Wiki công khai giữ nguyên.

- **Mọi phần trên một trang**, theo thứ tự đọc: Tổng quan → Kỹ năng → Đặc điểm → Mạnh, yếu và khắc chế → Trang phục → Ảnh → Video (Video chỉ có khi tướng đã lưu). Không có hàng tab mục, cột "Trên trang này" hay nút nổi mở mục lục.
- **Bố cục Tổng quan.** Thẻ tướng và Đánh giá nằm cùng một hàng, cao bằng nhau; khung Tổng quan từ 820px thì Đánh giá là cột phải 22rem. Thuộc tính chiến đấu chiếm trọn một hàng ngay dưới, trước Kỹ năng. Hẹp hơn thì xếp một cột theo đúng thứ tự đó.
- **Thuộc tính chiến đấu:**
  - Các thuộc tính nổi bật hiện thành dòng giống Đánh giá: icon của game, tên, giá trị bên phải. Bên dưới là một dòng nguồn ghi nhận.
  - Nút "Toàn bộ thuộc tính" và "So sánh" mở cùng một cửa sổ rộng, có hai tab. Tab Thuộc tính chia hai cột trên màn rộng; tab So sánh là phần phân tích với các tướng khác.
  - Cảnh báo nguồn trỏ tới thuộc tính sẽ mở thẳng cửa sổ này.
  - Không có thuộc tính nổi bật nào thì toàn bộ danh sách hiện luôn trong thẻ.
- Mỗi phần nằm trong thẻ riêng. Tiêu đề thẻ có icon, số đếm và nút sửa là cây bút.
- **Sửa tại chỗ.** Bút mở trình sửa thay chỗ nội dung của đúng phần đó, tiêu đề hiện nhãn "Đang sửa"; sửa phần Tổng quan thì trình sửa chiếm cả thẻ Tổng quan. Trong lúc sửa, bút ở các phần khác bị khóa cho tới khi lưu hoặc hủy. Phiên bản đã xuất bản không có bút ở từng phần: bút ở đầu trang tạo bản nháp trước.
- Mở trình sửa thì `tab` trong URL ghi phần đang sửa (`?tab=skills`, `?tab=media`…; Tổng quan thì bỏ `tab`), để đóng trình sửa thì trang mở lại ở phần đó. Liên kết cũ vẫn dùng được: `?view=skills` mở trang Nội dung ở phần Kỹ năng, `?view=patch` và `?view=versions` mở tab Lịch sử.

Component: `HeroContent` trong `apps/admin-aov/src/features/publishing/components/workspace/hero-content.tsx`. Thứ tự các phần và id của từng phần (`hero-content-<phần>`) nằm trong `hero-content-tabs.tsx`; hai tab quản lý nằm trong `hero-workspace-tabs.tsx`.

Component dùng chung cho ngăn chi tiết: `SectionContents`, `ContentsSection` và `useSectionContents` trong `apps/admin-aov/src/components/section-contents.tsx`. Trang khai báo chiều cao các thanh dính phía trên bằng `--contents-offset` (px) trên `SectionContents`. Thanh dính cần `[overflow-anchor:none]` để trình duyệt không lấy nó làm mốc giữ vị trí cuộn.

| Trang | Cách xử lý |
|---|---|
| Chi tiết tướng | Tab: Nội dung → Lịch sử; bản dịch làm tại chỗ qua menu ngôn ngữ. Nội dung là một trang cuộn Tổng quan → Kỹ năng → Đặc điểm → Mạnh, yếu và khắc chế → Trang phục → Ảnh → Video (xem "Trang tướng: một trang cuộn"). Thẻ tướng: ảnh, tên, danh hiệu, giá vàng và quân huy dạng icon kèm số, vai trò, giới thiệu; cốt truyện mở bằng icon sách trong cửa sổ riêng. Kỹ năng khi đọc là một dải icon chiêu (nhãn Nội tại, Chiêu 1…) với nút Tập trung / Dạng phẳng ở cuối, chi tiết chiêu bên dưới, bản quyền ảnh ở chân thẻ; trình sửa vẫn có cột chọn chiêu |
| Chi tiết trang bị | Ngăn bên rộng tối đa 880px, trên điện thoại là sheet dưới. Tab: Nội dung → Bản dịch → Lịch sử. Nội dung: Thông tin (chỉ số, hiệu ứng, ghép từ, vị trí trong shop) → Mốc patch và ghi chú → Video. Cột mục lục khi ngăn từ 42rem |
| Chi tiết ngọc, phụ trợ, phù hiệu | Như trang bị. Nội dung: Thông tin → Phân loại ngọc / Thuộc tính / Hệ và vị trí → Chỉ số (ngọc) hoặc Trạng thái phụ trợ → Ảnh → Mốc patch và ghi chú → Video. Ngăn sửa hệ phù hiệu và nhóm trang bị vẫn giữ tab vì chỉ là một biểu mẫu ngắn |
| Đầu trang chi tiết tướng | Tên và nhóm nút là hai khối. Nút đổi tướng nằm ngay sau tên; đầu trang dính ở trên khi cuộn nên nút luôn ở đó. Phiên bản chỉ hiện `#số`, ngôn ngữ chỉ hiện lá cờ; tên đầy đủ nằm trong tooltip và menu. Khung đầu trang từ 42rem: `#số`, cờ, Xuất bản/Tạo bản nháp, `⋯`; không đủ chỗ thì cả nhóm xuống hàng dưới. Hẹp hơn (đo theo chính khung, nên đúng cả trong ngăn bên): một hàng, ẩn ảnh nhỏ cạnh tên, menu `#số` chứa danh sách phiên bản, mục Ngôn ngữ và Xuất bản/Tạo bản nháp, đặt ngay trái `⋯`. Menu `⋯` chỉ còn Dạng của tướng (khi tướng có dạng) và Hủy bản nháp. Ngăn tướng mở từ danh sách không có thanh tiêu đề riêng và đóng bằng nút × ở cuối hàng đầu trang, như các ngăn khác |
| Danh sách có bộ lọc | Ô tìm một khối, nhóm ô lọc một khối luôn nằm trên một hàng |
| Hồ sơ (Đội tuyển, Tuyển thủ…) | Tab trên một hàng, thiếu chỗ thì ẩn icon rồi cuộn ngang |
| Tuyển thủ | Ẩn cột theo độ rộng, tên đội chuyển xuống dòng phụ khi ẩn cột đội |
| Quản lý tệp | Lọc nguồn một khối, loại ảnh cùng số lượng và kiểu xem một khối |

## Phong cách: một khung, hai bảng màu

Wiki và Stream dùng chung một khung và một bộ cách trình bày, chỉ khác bảng màu: thanh trên chứa thương hiệu, các mục
chính, tìm kiếm và tài khoản; trang nằm trong cùng cột với thanh trên; mỗi trang danh sách mở bằng tiêu đề, một dòng mờ
và tối đa một nút; nội dung đặt thẳng trên nền, chỉ thứ bấm được hoặc nhóm cần tách biệt mới là thẻ; chip, tab và bo
góc theo cùng một thang (xem `DESIGN-TOKENS.md`).

Màu mạnh chỉ đến từ ảnh và icon của game. Không dùng nền sặc sỡ, góc vàng, khung trang trí, họa tiết hay dải màu phía
sau chữ và dữ liệu. Chuyển động nhẹ và tắt khi người đọc bật giảm chuyển động.

**Không lồng khung trong khung.** Một nhóm đã nằm trong thẻ thì bên trong chỉ ngăn bằng khoảng trống hoặc đường kẻ mảnh.
Các hàng của một danh sách dài nằm thẳng trên nền, ngăn nhau bằng đường 1px.

### AOV Wiki: Đêm hoàng kim

Nền xanh mực đậm, thẻ sáng hơn nền một bậc, tiêu đề mục và dấu nhấn vàng đậm; Wiki luôn tối. Màu nằm trong `tokens.css`
với tên `--aov-wiki-*` và được `wiki.css` gán vào các token chung.

| Nội dung | Cách trình bày |
|---|---|
| Thanh đầu trang | Nền gần đặc màu thanh, vạch vàng mờ ở dưới. Mục đang ở có chữ vàng và gạch chân vàng |
| Đầu trang danh sách | `CatalogHeading`: tiêu đề màu chữ, một dòng mờ, phiên bản dữ liệu hoặc một nút bên phải; không có ảnh hay hình trang trí |
| Mở đầu trang chủ và trang tướng | Ảnh tướng phủ nửa phải, mờ dần vào nền ở mép trái và mép dưới; chữ đặt thẳng trên nền bên trái. Trên compact ảnh nằm trên cùng, tên tướng ở chân ảnh |
| Tiêu đề mục | Màu vàng, số đếm nhỏ màu mờ, tối đa một liên kết bên phải, đường vàng mảnh bên dưới |
| Thẻ (tướng, ô mục, trang phục, mục kho, chế độ, kỹ năng) | Nền thẻ, bo 10px, không viền, không bóng; rê chuột sáng lên một bậc. Thẻ đang chọn có viền vàng 1px và nền vàng rất nhạt |
| Thay đổi ở bản này | Một bề mặt, vạch bên trái theo màu của loại thay đổi: tăng sức mạnh xanh lá, giảm đỏ, làm lại cam, mới vàng, còn lại xanh dương |
| Thay đổi ở bản đang áp dụng trên trang chủ | Nhóm theo loại thay đổi, mỗi tướng một thẻ nhỏ có vạch màu của loại bên trái |
| Các bản cập nhật, luật chơi, nhiệm vụ | Hàng đặt thẳng trên nền, ngăn bằng đường mảnh |
| Chip lọc | Viên cao 32px màu thẻ; chip đang chọn có viền vàng trên nền vàng nhạt, chữ vàng sáng |
| Tab | Gạch chân vàng dưới tab đang mở, một hàng, cuộn ngang khi thiếu chỗ |
| Video | Máy tính: thẻ theo lưới, số cột chọn để hàng cuối không còn một thẻ lẻ. Điện thoại: hàng dọc, ảnh bên trái như danh sách trong trình phát, hiện 3 mục đầu |
| Tham chiếu trong đoạn văn | Chữ thường cùng cỡ, chỉ khác màu, gạch chân khi rê chuột. Bôi đen được cả câu đi qua tham chiếu; thẻ thông tin chỉ mở khi bấm xong hoặc rê chuột |
| Icon thuật ngữ và chỉ số | Hình đơn sắc lấy màu chữ xung quanh |
| Trạng thái trống và lỗi | Linh vật chuột chũi, một câu nói rõ chuyện gì xảy ra và bước tiếp theo |

### AOV Stream: màu của logo cú

Bảng màu "Oải hương" lấy từ lông cú: đêm ngả tím, nhấn tím oải hương; vàng mắt cú và mặt kem chỉ còn trong logo, để
Stream khác hẳn màu vàng của Wiki. Màu nằm trong `tokens.css` với tên `--aov-stream-*`. Trang theo chế độ sáng hoặc tối
của người xem, riêng thanh trên và chân trang luôn màu đêm ngả tím.

| Nội dung | Cách trình bày |
|---|---|
| Nền trang | Một màu phẳng: sương tím nhạt ở giao diện sáng, đêm ngả tím ở giao diện tối; không họa tiết |
| Thanh trên và chân trang | Theo giao diện: nền trắng ở giao diện sáng, đêm ngả tím ở giao diện tối. Logo cú 32px, các mục dạng tab chữ: mục đang ở chữ đậm và vạch màu nhấn ở chân thanh. Ô tìm kiếm ở giữa và các nút tròn dùng nền mờ, không viền |
| Tìm kiếm trên điện thoại | Bấm nút tìm kiếm thì thanh thành nút quay lại và ô nhập; bên dưới mở một màn phủ kín trang với lối tắt Bảng tin, Giải đấu, Khám phá và một dòng gợi ý, đến khi người xem tìm |
| Chữ logo | Cùng một kiểu với Wiki (`PublicAppWordmark`): "AOV" đậm màu chữ, tên sản phẩm màu nhấn có ánh chuyển nhẹ, cùng cỡ chữ ở hai app |
| Đầu trang danh sách | `.tn-page-head`: tiêu đề 28/36, một dòng mờ (ẩn trên compact), tối đa một nút bên phải |
| Đầu một giải, một trận | Nền `.hub-art` màu sinh từ tên, vì các giải chưa có ảnh riêng; chỉ cao vừa nội dung |
| Tiêu đề mục | `.tn-heading`: 18/24 đậm, số đếm mờ, một liên kết bên phải |
| Thẻ | Nền thẻ, bo 10px, không viền; rê chuột đổi nền, không xê dịch thẻ. Thẻ trận nhỏ `.tn-match` giữ viền mảnh |
| Màu nhấn | Giao diện sáng: xanh tím đậm của lông cú. Giao diện tối: tím oải hương. Liên kết, chip và tab đang chọn theo màu này |
| Chip | `.hub-pills`: một hàng cuộn ngang, chip đang chọn tô đặc màu nhấn |
| Tab | `.cp-tabs`: chữ 14px; tab đang mở giữ màu chữ thường, đậm hơn và có vạch màu nhấn bên dưới; một hàng cuộn ngang |
| Logo đội và giải | Nằm trên ô `--hub-plate`, để logo vẽ cho nền tối vẫn thấy ở giao diện sáng |
| Trang trong danh bạ | Thẻ gọn: logo hoặc ảnh, tên tối đa ba dòng, nút theo dõi; không dùng ảnh bìa |
| Trạng thái trống và lỗi | `.hub-state`: cú 48px, một câu, bước tiếp theo |

Chưa dùng Three.js và ảnh tạo bằng AI, vì SVG và CSS đủ cho các hình hiện có. Chỉ thêm khi có cảnh hoặc hình mà SVG không vẽ được.

## Cách đo lại

Mỗi lần đổi bố cục lớn, mở trang ở các độ rộng 375, 480, 640, 768, 900, 1024, 1180, 1280, 1440 và 1600px. Kiểm tra: không tràn ngang, không có nút rớt dòng một mình, nhãn nút không xuống dòng, không có chữ dưới 12px, phần chính nằm trong một đến hai màn hình đầu.
