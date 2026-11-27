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
| Trang chủ | Sân khấu ảnh trang phục của ngày phủ kín, cắt vào mặt tướng, header trong suốt đè lên → tiêu đề → bản đang áp dụng tràn hai mép: ba dòng đầu ngắn, hàng thẻ chân dung vuốt ngang có thẻ kế ló ra, các bản của mùa thành dòng thời gian vuốt ngang mở ở bản đang áp dụng → Khám phá: thẻ hai cột, Tướng, Trang phục, Cập nhật, Thuật ngữ cả hàng, bốn phần kho hai thẻ một hàng, vai trò thành hàng chip vuốt ngang | Tiêu đề trên sân khấu tràn bề ngang (ảnh lớn bên phải, bản mờ của nó phủ màu cả dải) → bản đang áp dụng: một dòng đầu, một hàng thẻ chân dung nhỏ, các bản của mùa thành dòng thời gian ngang, mới nhất bên trái → Khám phá: thẻ có dải ảnh trên bốn cột, Tướng và Trang phục 2 cột, bốn phần kho 1 cột, Cập nhật và Thuật ngữ 2 cột; vai trò là sáu ô dưới tên Tướng |
| Chi tiết tướng | Ảnh, tên, vai trò, giá và nút Video trên ảnh → Phiên bản dữ liệu (menu các bản có thay đổi) → Một dòng "Thay đổi ở bản …", bấm để mở xuống → Tổng quan gọn → Bộ kỹ năng → Build đề cử (khi có) → Trang phục → Video → Tướng cùng vị trí (một hàng cuộn ngang). Nút nổi mở drawer các phần | Màn đầu: tên, vai trò, giá và Tổng quan bên trái, ảnh tướng phủ bên phải, mờ dần vào nền. Sau đó: Phiên bản dữ liệu (menu các bản có thay đổi) → Thay đổi ở bản đang xem → Bộ kỹ năng → Build đề cử → Trang phục → Video → Tướng cùng vị trí, đặt thẳng trên nền. Từ 1180px có cột "Trên trang này" bên phải, dưới đó dùng nút nổi |
| Danh sách tướng | Ô tìm và nút Lọc (Vị trí, Vai trò trong drawer) dính dưới đầu trang → dòng phiên bản dữ liệu → Thay đổi ở bản đang xem → Lưới tướng 5 cột (4 dưới 720px, 3 dưới 480px) | Tiêu đề và phiên bản dữ liệu → Ô tìm, chip Vị trí và Vai trò có icon và tên → Thay đổi ở bản đang xem → Lưới tướng 7 cột (6 dưới 1100px) |
| Trang phục | Ô tìm và nút Lọc (tướng, bậc, hai kiểu sắp xếp trong drawer) dính dưới đầu trang → dòng phiên bản → bộ lọc đang chọn thành chip bỏ được, kèm số kết quả → mỗi tướng một hàng vuốt ngang, thẻ cuối bị mép màn hình cắt để báo còn nữa | Tiêu đề, số trang phục và phiên bản → thanh công cụ một hàng dính dưới đầu trang: tìm, tướng, bậc, sắp xếp → mỗi tướng một hàng 8, 7 hoặc 6 thẻ trọn vẹn tùy độ rộng, cuối hàng là ô "+N" mở hết hàng tại chỗ. Lọc một tướng, hoặc tìm và lọc bậc ra nhiều tướng, thì thành một lưới |
| Kho trang bị | Đầu trang trong suốt, ghi tên phần đang xem ở giữa, phủ mờ khi cuộn; các phần khác mở từ nút mục lục → Khung minh họa: số mục, câu dẫn và một câu về cách phần này hoạt động bên trái, ảnh của chính phần đó dựng thành cảnh bên phải (phù hiệu: một bộ mẫu, ba bậc của hệ chính nối bằng đường màu hệ và hai phù hiệu hệ khác; các phần khác: ảnh xếp như kệ trưng bày) → Ô tìm và nút Lọc → dòng phiên bản → Danh mục (trang bị là danh sách dưới 768px vì sơ đồ cửa hàng cần ba cột). Chọn một mục mở tấm chi tiết từ bên phải, từ dưới lên khi màn hình từ 640px trở xuống | Khung minh họa có viền: tên phần và số mục, câu dẫn, câu về cách hoạt động, phiên bản dữ liệu bên trái; cùng cảnh như trên điện thoại, dàn rộng trên ba phần năm bên phải → một hàng tìm kiếm và bộ lọc (trang bị có thêm nút chuyển Sơ đồ / Danh sách và một hàng chip chỉ số) → Danh mục rộng hết cột; chọn một mục thì chi tiết đứng bên phải, rộng 320–380px |
| Một bản cập nhật | Quay lại "Tất cả bản cập nhật" → tên bản và thông tin → hàng mục lục cuộn ngang, có ảnh tướng → thay đổi theo nhóm Tướng, Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ | Tiêu đề có đường quay lại, ngày và nguồn → thay đổi theo nhóm bên trái, mục lục dính bên phải tô sáng mục đang đọc |
| Chế độ chơi | Sân khấu sát hai mép dưới thanh đầu trang (một chế độ: tên, thời lượng, tình trạng, nút vàng trải ngang, liên kết cẩm nang cuộn ngang) → Hàng Đang mở vuốt từng thẻ → Tất cả chế độ: ô tìm, chip lọc cuộn ngang, bộ sưu tập hai cột theo nhóm → ghi chú lịch ở cuối | Sân khấu (tiêu đề và số chế độ ở góc, một chế độ chiếu lớn với giới thiệu và nút vào) → Hàng Đang mở có nút lùi, tiến → Tất cả chế độ: ô tìm và chip lọc một hàng, tường ghép theo nhóm PVP, Chế độ giải trí, ô rộng hai cột cho chế độ có ảnh, ô nhỏ cho chế độ khóa (6 cột, 4 dưới 1180px) → ghi chú lịch |
| Một chế độ | Banner ảnh sát hai mép dưới thanh đầu trang trong suốt (nhóm, tên, thời lượng · số người · tình trạng; thấp hơn ở các tab công cụ) → Hàng tab cẩm nang dính dưới đầu trang, cuối hàng có nút mở tấm chín ô của mọi phần (khi chế độ có cẩm nang) → Giới thiệu → Một câu nêu những gì chưa ghi nhận → Tấm thông tin còn lại dạng ô → Luật chơi gấp theo nhóm, nhóm đầu mở sẵn → Nguồn | Breadcrumb → Banner có ảnh → Hàng tab → Giới thiệu và nguồn bên trái, tấm thông tin còn lại dạng hàng bên phải → Luật chơi |
| Cẩm nang Cờ Liên quân | Quân cờ: ô tìm, nút Lọc (giá, Phe, Nghề) và nút chuyển Theo giá / Chỉ số; theo giá là tiêu đề từng giá rồi lưới 5 cột (7 cột từ 600px) chỉ ảnh và tên; bảng chỉ số chỉ giữ cột đang sắp xếp để không cuộn ngang; bấm quân mở chi tiết trong ngăn kéo. Phe & Nghề: danh mục, bấm một mục mở chi tiết trong ngăn kéo; bảng Phe × Nghề cuộn ngang, cột Nghề đứng yên. Trang bị, Chúc phúc, Nhiệm vụ: các hàng ngăn bằng vạch; Chúc phúc lọc bằng ô tìm và chip theo bậc. Đội hình: nút chuyển Bàn cờ / Danh sách; bàn cờ 3 hàng × 7 ô vuông (hàng trước ở trên, phía đối thủ), quân chưa có ô nằm ở hàng chờ dưới bàn; danh sách 5 quân một hàng. Xếp đội hình: bàn cờ là phần chính — bấm ô trống mở sheet chọn quân cho đúng ô đó, bấm quân để chọn rồi bấm ô khác để chuyển hoặc đổi chỗ; chế độ danh sách là 10 ô + ô thêm → Phe/Nghề đang kích hoạt | Quân cờ: một hàng công cụ (tìm, chip giá, chip Phe và chip Nghề mở bảng chọn, nút chuyển); mỗi giá một hàng như cửa hàng trong game, 14 quân một hàng từ 1180px, 7 quân dưới đó; bảng chỉ số sắp được theo nhiều cột. Phe & Nghề: danh mục bên trái, chi tiết bên phải dính dưới hàng tab. Đội hình: mỗi đội hình một thẻ, hai thẻ một hàng. Xếp đội hình: thẻ bàn cờ và mọi quân chờ bên dưới để bấm hoặc kéo vào ô, Phe/Nghề đang kích hoạt ở cột phải. Phân tích: hai cột |

## AOV Stream

Hàng tab Bảng tin, Giải đấu, Khám phá nằm ở đầu trang trên cả hai bố cục: trên wide nằm trong thanh trên, trên compact
là hàng thứ hai dính ở đầu màn hình. Trang nằm trong cột `--aov-page-max` với lề `--hub-gutter`, cùng cột với thanh trên.

| Trang | Compact | Wide |
|---|---|---|
| Đầu trang | Hàng thương hiệu cao 48px (cú, chữ AOV Stream, nút tìm kiếm, chuông khi đã đăng nhập, "⋯" dưới 768px hoặc tài khoản) cuộn đi khi đọc; hàng tab bên dưới dính lại, cuộn ngang, dưới 420px bỏ icon. Bấm tìm kiếm thì ô nhập và nút Đóng thay hàng thương hiệu, gợi ý phủ cả màn hình bên dưới | Một thanh cao 56px: cú và menu chuyển ứng dụng, ba mục, ô tìm kiếm, chuông thông báo và tài khoản. Dưới 1100px ô tìm thu thành nút, bấm thì ô nhập chiếm cả thanh; gợi ý thả xuống dưới ô |
| Bảng tin | Dải Trận đấu cuộn ngang → chip lọc bảng tin → kênh đang trực tiếp cuộn ngang → bài viết, tải thêm khi cuộn; dòng đầu của bài là trang đăng và giờ | Dải Trận đấu → bảng tin bên trái, cột phụ 304px bên phải đi theo khi cuộn: Giải đang và sắp diễn ra; Tham gia cộng đồng khi chưa đăng nhập, Đang theo dõi và Gợi ý theo dõi khi đã đăng nhập. Mỗi bài có lề trái 152px nói ai đăng, dính lại khi cuộn qua bài dài; chữ và ảnh chung một cột. Dưới 1100px cột phụ ẩn vì chỉ chứa lối tắt đã có ở chỗ khác |
| Vị trí của trang | `PlaceTrail` ở đầu trang: mục lớn và các chặng giữa còn dấu hiệu (icon, logo), chặng gần nhất có tên. Trận, ván và tướng có hai mũi tên sang trang liền kề. Cuộn xuống thì hàng tab của Stream vẫn dính ở trên | Đường dẫn đủ tên. Cuộn qua đầu trang thì `PlaceBar` cao 48px dính dưới thanh trên: lối lên, tên trang (bấm để về đầu trang), tab và nút liền kề; trang có tab thì thanh này là chân của đầu trang ngay từ đầu. Còn đầu trang thì thanh tối cùng sân khấu, hết đầu trang thì thanh theo giao diện (`--hub-subbar`): oải hương nhạt ở giao diện sáng |
| Trang cộng đồng (tổ chức, đội, tuyển thủ, nhân sự) | Đầu trang tràn hai mép: ảnh bìa, hình, tên, nút Theo dõi và "⋯", các con số, kênh → tab dính dưới thanh trên, có thêm Giới thiệu → Tổng quan: đang trực tiếp, trận đấu, đội hình (giá treo áo cuộn ngang), thành tích (kệ cúp cuộn ngang), bài viết theo ngày | Tab nằm ở chân đầu trang; cột phải 304px dính lại: giới thiệu, nguồn, trang cùng khu vực. Bài viết có lề trái ghi ngày, mỗi ngày một lần |
| Đội, tuyển thủ, nhân sự chưa có trang | Cùng đầu trang, giá treo áo và kệ cúp, dựng từ các giải đã công bố | Như compact, một cột |
| Khám phá | Kênh trực tiếp cuộn ngang → video mới 2 cột → chip loại trang và Khu vực → mỗi loại trang một bức tường logo hoặc áo đấu 4 cột và lối Xem tất cả. Chọn loại hoặc khu vực thì thành danh sách, tải thêm khi cuộn | Như compact; video 4 cột, tường 8 cột, danh sách nhiều cột |
| Giải đấu | Đang diễn ra (sân khấu của giải, các trận đang và sắp đấu bên dưới) → bảng tỉ số cuộn ngang theo ngày (đang đấu, sắp tới, vừa xong; bỏ các trận đã có trên sân khấu) với lối Lịch & kết quả bên dưới → Sắp diễn ra (một giải thì chiếm cả hàng và nêu các đội) → Đương kim vô địch: cờ treo, cuộn ngang → Các mùa giải: chip năm; chip khu vực có cờ chỉ hiện khi năm đó có hơn 6 hệ thống giải → mỗi hệ thống giải là một danh sách mùa của năm đang chọn, mỗi mùa có một vạch nhỏ chỉ vị trí trong năm. Không có tiêu đề và tab; ô tìm là ô của thanh trên. Toàn bộ lịch (`?tab=schedule`): đường dẫn → công tắc Tất cả, Lịch đấu, Kết quả → chip khu vực → dải ngày cuộn ngang → các trận theo ngày; các trận chưa biết đội và giờ gộp một dòng mỗi giải | Như compact; giải đang diễn ra có các trận ở nửa phải sân khấu; các mùa giải là bản đồ năm: tháng ở trên, mỗi hệ thống giải một làn, mỗi mùa một vạch đúng thời gian dưới huy hiệu nhà vô địch, tên các phần (vòng loại, wildcard) ở dưới và vạch "Hôm nay". Khi tìm thì bản đồ thành danh sách mùa của mọi năm và phần mở đầu ẩn đi. Không có nút Lọc: bản đồ đã xếp theo hạng, có cờ và đặt vòng loại dưới mùa của nó. Ở lịch, công tắc và chip khu vực chung một hàng |
| Một giải | Sân khấu của giải tràn hai mép (đường dẫn có ô chọn mùa, logo, tên, trạng thái, ngày, số đội, giải thưởng, nhà vô địch hoặc tiến độ, các giai đoạn ở chân, bấm một giai đoạn thì mở nó ở BXH & nhánh đấu) → tab Tổng quan, Lịch & kết quả, BXH & nhánh đấu, Thống kê (chỉ khi có ván đã xuất bản), Đội tham dự, Thể thức & thông tin, cuộn ngang và ghim dưới thanh trên → Tổng quan: trận đang và sắp đấu, kết quả mới nhất, nhánh đấu (cuộn ngang, mở ở vòng đang đấu), tướng có mặt nhiều nhất (cuộn ngang), bảng xếp hạng, thông tin, xếp hạng chung cuộc, giải thưởng. BXH & nhánh đấu: hàng logo đội cuộn ngang, bấm một đội thì theo đội đó qua cả tab (`team=`) → từng giai đoạn, đấu sau đứng trước → xếp hạng chung cuộc. Giai đoạn loại là nhánh đấu cuộn ngang, giai đoạn không nối trận là mỗi vòng một cột. Giai đoạn có bảng: cuộc đua thứ hạng (từ năm bước và năm đội), tên viết tắt ở cuối đường → nút lùi, tiến và thanh kéo qua từng bước (`at=`; giai đoạn nhiều bảng thì dùng chung, ở tiêu đề) → bảng có tiêu đề vùng hạng → câu nói vì sao ranh giới rơi ở đó → các trận của bước khi địa chỉ nêu bước → Đối đầu: tỷ số từng trận hoặc cộng lại, bấm ô mở bảng trượt; quá 10 đội thì một đội với từng đội, ít cặp gặp nhau (Swiss) thì đường đi của từng đội | Như compact; nhánh đấu chiếm cả bề ngang, từ 1080px xếp hạng chung cuộc và giải thưởng nằm ở cột phải 304px (cột trống thì nhường chỗ cho nội dung). BXH & nhánh đấu: nút lùi, tiến ở tiêu đề giai đoạn; từ 1100px cuộc đua đứng bên trái bảng, đường chạy thẳng vào hàng của đội, dãy bước phía trên là thanh kéo; dưới 1100px cuộc đua nằm trên bảng. Bảng luôn có T–B, HS, Điểm; rộng từ 560px thêm Phong độ, từ 730px thêm Ván. Đối đầu tới 14 đội: vạch từng ván trên tỷ số từng trận, bấm ô mở thẻ cạnh ô |
| Thống kê của giải | Bốn phần Tướng (mặc định), Đội, Điểm nhấn, Tìm ván chia đều một hàng → số ván đang đếm, bấm để đếm riêng một giai đoạn hoặc một bản cập nhật (`in=`) → phần đang mở. Tướng: ba tướng dẫn đầu xếp dọc trên sân khấu → ô tìm, menu đường, nút đổi ảnh và bảng → Có mặt, Chọn, Thắng, Cấm → kệ ảnh, trên điện thoại năm tướng một hàng, hoặc bảng giữ số đo đang xếp, T–B và Cấm. Đội: mỗi đội là tên, thành tích, vạch từng ván, tướng hay chọn, tướng cấm hơn đội khác → MVP. Điểm nhấn: năm đường cuộn ngang trên sân khấu, tướng bị cấm nhiều nhất bên dưới, tên viết dưới mặt và số (trên wide tên hiện khi trỏ vào) → các mục, một cột dưới 760px. Tìm ván: bàn cấm chọn xếp dọc, mở từ liên kết có điều kiện thì gập thành dải 64px có nút Sửa (bỏ hết điều kiện thì bàn mở lại) → câu trả lời và thứ tự → gợi ý thu hẹp cuộn ngang → các ván, mỗi đội một dòng. Một tướng (`hero=`), một đội (`view=teams`, `club=`): đường dẫn với hai mũi tên thay hàng bốn phần → sân khấu, đội có thêm hàng logo các đội phía trên → liên kết Phân tích và danh sách ván (`list=`) → các mục một cột, Cùng đội và Đối thủ chung một danh sách có công tắc | Bốn phần ở đầu hàng, phạm vi đếm ở cuối hàng; trang một tướng, một đội đặt phạm vi đếm cạnh đường dẫn. Tướng: ba tướng trên một hàng; ô tìm, năm đường và Ảnh tướng / Bảng số trên một hàng; ảnh nhỏ dần theo kệ (khoảng 96, 80, 64, 52px), kệ ngắn đứng chung hàng; bảng đủ cột, bấm tên cột để xếp. Đội: từ 1100px mỗi đội một dòng. Điểm nhấn: năm đường thành năm cột, các mục thành hai chồng cao gần bằng nhau. Tìm ván: bàn cấm chọn nằm ngang, đứng đúng trên cột của các ván bên dưới; MVP của ván chỉ hiện từ 1240px. Một tướng: đội chơi và đội cấm thành hai cột từ 1100px, Cùng đội và Đối thủ là hai cánh của tướng, từng tuần và từng lượt cấm chọn đứng cạnh nhau. Một đội: năm đường đứng cạnh nhau ở Hay chọn và Tướng của từng tuyển thủ, hai danh sách cấm thành hai cột, các lượt cấm chọn thành bốn |
| Một trận | Sân khấu của trận: hai đội và tỷ số, dưới đó là nút xem, rồi giờ đấu và MVP; các ván ở chân → Các ván đấu, tiêu đề có lối “n ván X gặp Y ở giải này” khi hai đội còn gặp nhau ở ván khác của giải → Tướng của từng tuyển thủ → So sánh hai đội (trận chưa đấu thì đứng trước các ván) → ban bình luận → Trận khác của hai đội. Xem video: phòng xem thay đầu trang, video dính đầu cửa sổ (trừ khi chiếm quá ba phần tư chiều cao), dưới nó các ván và thanh của ván, rồi phần theo dõi; điện thoại xoay ngang (từ 619px) thì video và phần theo dõi đứng cạnh nhau. Rời trang thì video tạm dừng | Như compact; giờ đấu, nút xem và MVP chung một hàng. Phòng xem: video, phần theo dõi bên phải, thanh kể trận dưới cả hai; phòng đổi dáng theo tỷ lệ cửa sổ (`shapeOf` trong `lib/watch-shape.ts`), ngoại lệ duy nhất của mốc 900px. Thanh trên của Stream cuộn theo trang khi phòng còn trong cửa sổ. Cuộn qua phòng, thu nhỏ hoặc sang trang khác thì video nhỏ ở góc |
| Một ván | Sân khấu của trận (tỷ số, ván, thời lượng, MVP, bản cập nhật, lối vào phòng xem), các ván của trận ở chân → Đội hình: mỗi đường một hàng, hai người đối mặt qua dấu của đường; cạnh tướng là trang bị, hai hàng ba ô, dưới tướng là tên, phụ trợ và phù hiệu chính. Bấm cả ô mở bảng trượt: phù hiệu theo nhánh, trang bị kèm món đã lên từ và thời điểm, Đã đổi, Tình huống, bảng ngọc, hai lối sang trang tuyển thủ và tướng ở giải → một dòng nói ván ghi đủ tới đâu → Thứ tự cấm chọn cuộn ngang → Diễn biến → giao dịch trang bị và ghi chú gập lại. Nguồn cho thấy trang bị ở hai mốc trở lên thì có thanh thời điểm trên đội hình | Có trang bị: hai nửa đối xứng, trang bị ở mép ngoài trên một hàng (dưới 1160px hai hàng ba ô), tên tuyển thủ và tướng là liên kết riêng, bấm chỗ khác của ô mở thẻ cạnh ô. Chưa có trang bị: bàn năm đường đứng cạnh nhau, một đội phía trên, một đội phía dưới. Ván chưa ghi phụ trợ và phù hiệu của ai thì không giữ chỗ cho chúng |
| Hệ thống giải | Sân khấu có đương kim vô địch → giới thiệu → bảng vàng cuộn ngang → các mùa theo năm → thông tin | Bảng vàng và các mùa bên trái, mỗi năm các mùa đứng cạnh nhau; thông tin ở cột phải |

## Admin

Admin vẫn dùng một bố cục, co giãn bằng container query theo độ rộng khung nội dung, vì khung này đổi theo thanh bên và bảng ảnh gốc. Ngoại lệ là màn xem và ghi trận: hai bố cục ở mốc 900px như Wiki và Stream, bên trong mỗi bố cục vẫn đo theo khung.

### Màn xem và ghi trận

Trận đấu (`/tournaments/:id/matches/:seriesId`) là một bàn làm việc lấp đầy vùng nội dung, không lề trang, không thẻ, không gì nổi đè lên hình. Khung nằm trong `apps/admin-aov/src/features/esports/components/series/studio.css`; kích thước tính bằng `cqw`, `cqh` của vùng nội dung nên gập thanh bên là hình lớn ra ngay.

| Phần | Wide (từ 900px) | Compact |
|---|---|---|
| Cả màn | Vừa một cửa sổ, vùng nội dung không cuộn. Trên: đầu màn 48px. Trái: hình, hàng điều khiển 44px, thanh toàn video 28px, đường thời gian (ít nhất 140px). Phải: khung ghi cao từ dưới đầu màn tới đáy. Chỉ nội dung khung ghi cuộn | Một cột cuộn theo trang: đầu màn trôi đi, hình cùng hàng điều khiển (48px) và thanh toàn video dính trên cùng, rồi các ván, bốn phần, chân khung, nội dung. Chân khung đứng trước nội dung để bước tiếp theo luôn trong tầm mắt; không có thanh dính đáy, không có nút nổi |
| Hình | Lấy hết chiều cao còn lại, khung ghi lấy bề ngang hình chừa ra: rộng 320–640px (ít nhất một phần tư màn). 1366×768 mở thanh bên: hình 746×420, khung ghi 380px; 1920×1032: 1260×709 và 420px | Rộng hết màn, cao 16:9 nhưng không quá 56% chiều cao cửa sổ, ít nhất 200px. Cửa sổ thấp dưới 560px (điện thoại xoay ngang) thì không dính gì |
| Đường thời gian | Luôn hiện; phần dư của chiều cao dùng để xếp mốc thành nhiều hàng, không kéo giãn | Cột video hẹp hơn 640px hoặc cửa sổ thấp dưới 560px thì gập sau nút "Dòng thời gian ván n" |
| Hàng điều khiển | Đo chính nó: từ 700px đủ mọi nút; dưới 700px bỏ thanh âm lượng (nút tắt tiếng còn); dưới 600px phụ đề, YouTube, toàn màn hình vào `⋯`; dưới 480px chỉ còn −10, phát, +10, vị trí, `⋯` | Như wide |
| Đầu màn | Thiếu chỗ thì tên giải ngắn lại trước, rồi vòng đấu, rồi giờ; vùng nội dung từ 1300px mới có tên đầy đủ của hai đội, BO và giờ, dưới 900px (cả khi cửa sổ rộng mà thanh bên mở) ẩn tên giải và vòng đấu | Như wide; dưới 600px nút Xuất bản và chuyển trận vào bảng "Trận này" |
| Khung ghi | Một phần một lúc, vừa ở 320px. Trận không có video: khung ghi chiếm cả bề ngang, các ván và bốn phần chung một hàng, nội dung hai cột, chân khung một dòng (khung từ 760px) | Như wide; phím tắt tắt, trừ Esc |
| Menu, ô chọn | Mở trong khung ghi (`PopoverBoundary`), không che hình và đường thời gian | Giữ trong phần dưới video |

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
của người xem, thanh trên và chân trang cũng vậy.

| Nội dung | Cách trình bày |
|---|---|
| Nền trang | Một màu phẳng: sương tím nhạt ở giao diện sáng, đêm ngả tím ở giao diện tối; không họa tiết |
| Thanh trên và chân trang | Theo giao diện: nền trắng ở giao diện sáng, đêm ngả tím ở giao diện tối. Logo cú 32px, các mục dạng tab chữ: mục đang ở chữ đậm và vạch màu nhấn ở chân thanh. Ô tìm kiếm ở giữa và các nút tròn dùng nền mờ, không viền |
| Tìm kiếm trên điện thoại | Bấm nút tìm kiếm thì thanh thành ô nhập và nút Đóng ở cuối; bên dưới mở một màn phủ kín trang với lối tắt Bảng tin, Giải đấu, Khám phá và một dòng gợi ý, đến khi người xem tìm |
| Chữ logo | Cùng một kiểu với Wiki (`PublicAppWordmark`): "AOV" đậm màu chữ, tên sản phẩm màu nhấn có ánh chuyển nhẹ, cùng cỡ chữ ở hai app |
| Đầu trang danh sách | `.tn-page-head`: tiêu đề 28/36, một dòng mờ (ẩn trên compact), tối đa một nút bên phải |
| Sân khấu của một giải, một trận | `Stage`: nền đêm ở cả hai giao diện, ánh sáng là chính logo của giải hoặc của hai đội làm nhòe thành màu; không có logo thì màu sinh từ tên. Ánh sáng chỉ hiện dần một lần khi mở trang |
| Nhánh đấu | `Bracket`: mỗi trận đứng ngang giữa các trận dẫn tới nó, nối bằng đường kẻ; trỏ vào một đội thì đường đi của đội sáng lên. Kế hoạch không ghi liên kết giữa các trận thì suy ra từ kết quả. Trận đầu của mỗi đội ghi hạng đội mang từ bảng trước: "#1", hoặc "A1" khi bảng có chữ. Theo một đội (`TeamFollow`) thì các trận của đội được đánh số, bên dưới là hành trình của đội. Giai đoạn không phải loại trực tiếp mà kế hoạch không nối trận nào, như Swiss chưa có bảng, vẽ mỗi vòng một cột (`stageDrawing`), không có đường nối và chữ "Dừng bước" |
| Bảng xếp hạng | Phong độ là năm vạch: vạch cao xanh lá là thắng, vạch thấp đỏ là thua; số hạng lên, xuống so với bước trước cũng xanh lá và đỏ. Tiêu đề vùng hạng (`ZoneHeading`) nằm trong bảng: ô đặc là lối tốt nhất, nhạt dần cho lối sau, ô rỗng là dừng bước; chữ mở đúng vòng đấu hay bảng mà các hạng đó dẫn tới, chưa ngã ngũ thì viết "Nhóm vào …". Cuộc đua (`StandingsRace`): mỗi đội một đường xám, đội bằng nhau gặp nhau giữa các hạng dùng chung, sau bước đang xem chỉ còn nét chấm dẫn vào hàng; đội được theo hoặc được trỏ có đường màu nhấn và mỗi trận một chấm (thắng đặc, thua rỗng). Ở tab BXH & nhánh đấu, huy chương và đường vàng của hạng nhất chỉ có khi giai đoạn đã xong, hạng dừng bước không có huy chương; dải màu huy chương chỉ ở Tổng quan. Đối đầu: vạch từng ván theo thứ tự trên tỷ số từng trận, trận thắng đậm, trận thua mờ |
| Tiêu đề mục | `.tn-heading`: 22/28 đậm (18/24 trên compact), số đếm mờ, một liên kết bên phải |
| Thẻ | Bảng và danh sách trận có nền thẻ, bo 10px, không viền. Giải, đội, tuyển thủ và trang trong danh sách đứng thẳng trên nền trang, rê chuột mới hiện nền. Ô trận trong nhánh đấu giữ viền mảnh |
| Đầu trang tràn | `Stage` với `bleeds`: rộng bằng cửa sổ, sát thanh trên, nội dung theo cột trang (`--stage-side`). Dùng cho trang cộng đồng, đội, tuyển thủ, nhân sự, hệ thống giải (`PageHead`), giải và trận |
| Bài đăng | `PostCard` trình bày theo thứ bài mang (`postForm`): tin tức đứng trên sân khấu màu của trang, có ảnh thì ảnh tràn lên đầu; video và ảnh đi trước chữ; lời nhắn ngắn một dòng ý thì cỡ lớn; còn lại là chữ thường. Trên bảng tin lề ghi trang đăng, trên trang của chính nó lề ghi ngày. Bấm ảnh mở `PostViewer` phủ màn hình |
| Bình luận | Bong bóng cạnh tên người viết; bình luận của trang nền màu nhấn nhạt |
| Đội hình | `TeamLineup`: áo đấu treo trên giá theo thứ tự đường. Đội không có đội hình trên trang thì lấy đội đăng ký ở giải mới nhất |
| Danh hiệu | `TitleShelf`: mỗi lần vô địch một chiếc cúp (`Trophy`) trên bục ghi năm. Kiểu cúp theo giải (`lib/title-model.ts`): cánh và quả cầu là giải quốc tế, lưỡi cao có vòng quỹ đạo là giải vô địch liên quốc gia, cúp hai quai là giải quốc gia, chén có đá là cúp lẻ, khiên là hạng dưới, sao thủy tinh là giao hữu. Bục vàng là đương kim vô địch, sao trên bục là số mùa liên tiếp (chỉ ở mùa cuối của chuỗi), nguyệt quế là bất bại. Một cúp thì kể cả chuyện bên cạnh, vài cúp thì kèm tỷ số chung kết, từ sáu cúp thì chia kệ Quốc tế, Quốc gia. Thắng vòng loại hoặc một phần của giải không tính |
| Một trận trong lưới | `MatchCard`: một cột của bảng tỉ số, không khung và không nền; vạch phía trên theo sức nặng của vòng (chung kết tổng màu vàng, chung kết nhánh màu nhấn, đang đấu màu đỏ) |
| Huy hiệu đội | `Crest`: logo trên khiên viền vàng; logo chỉ có một bản thì khiên mang nền của bản đó |
| Đương kim vô địch | `ChampionRafters`: cờ treo dưới giàn mái nhà thi đấu, nền tối ở cả hai giao diện; màu vải lấy từ logo đội, mỗi ngôi sao là một lần vô địch của hệ thống giải đó |
| Thống kê tướng | Một vạch là một ván: cao và đặc là thắng, thấp và nhạt là thua, rỗng là chưa rõ. Vạch theo thứ tự ván (`GameMarks`) chỉ ở nơi thứ tự là câu chuyện, như một trận hay một mùa của đội; nơi khác ván thắng đứng trước (`GameCells`). Cả danh sách chung một cỡ vạch nên dài ngắn so được với nhau, cỡ dưới 3px thì thành thanh hai phần. Số phận của một tướng là một thanh (`FateBar`) dài bằng mọi ván đang đếm, luôn kèm số: thắng đặc, thua nhạt, chọn mà chưa rõ kết quả nhạt nhất, bị cấm rỗng, không ai chọn là đường mảnh, chưa ghi lượt cấm là đường chấm. Thắng thua chỉ dùng màu nhấn; xanh và đỏ chỉ khi nói về bên của bản đồ, luôn kèm chữ hoặc vị trí. Tướng bị cấm mất màu và bị gạch chéo bằng một nét trắng viền tối, cùng một nét ở mọi trang. Con số đếm ván mở đúng những ván đó khi Tìm ván hỏi được. Số đếm đứng trước; tỷ lệ tính trên số ván chỉ ghi từ 10 ván, ít hơn thì ghi số ván; tỷ lệ thắng chỉ dùng để xếp khi đủ lượt chọn (`enoughPicks`). Vàng chỉ cho nhà vô địch |
| Đầu trang hồ sơ | `ProfileHead`: ánh màu lấy từ ảnh bìa hoặc logo; có ảnh bìa thì hình của trang đè lên mép ảnh bìa. Các con số ở chân, số lần vô địch màu vàng. Dòng loại trang viết thường |
| Diễn biến ván | Chỉ có mục tiêu thì là dòng thời gian ngang, mỗi đội một phía của trục; có hạ gục hoặc trên compact thì là danh sách dọc. Ván có mốc trên video thì mỗi diễn biến và mỗi lượt cấm chọn là liên kết vào phòng xem ở giây đó, giờ của diễn biến mang màu nhấn |
| Phòng xem | `WatchRoom`: nền đêm ở cả hai giao diện; không gì của Stream nằm đè lên video và không nút nào của YouTube được vẽ lại. Phần theo dõi đi theo video: cấm chọn từng lượt, đội hình cùng số trụ, Rồng, tà thần Caesar tới giây đang xem, giữa hai ván là ván kế; mỗi lượt và mỗi diễn biến bấm được để xem lại. Thanh kể trận: mỗi ván một chương, giờ nghỉ không chiếm chỗ; mốc đã qua đứng ở làn của đội, mốc chưa tới đứng giữa và không nói của đội nào, logo đội thắng chỉ hiện khi đã xem hết ván. Giờ nghỉ, đoạn chờ và tạm dừng tự bỏ qua sau khi đếm ngược, luôn có một nút ở lại. Video chưa có mốc thì thanh kể trận là hàng tab các ván, không có mốc giả |
| Màu nhấn | Giao diện sáng: xanh tím đậm của lông cú. Giao diện tối: tím oải hương. Liên kết, chip và tab đang chọn theo màu này |
| Chip | `.hub-pills`: một hàng cuộn ngang, chip đang chọn tô đặc màu nhấn |
| Chọn một trong vài | Đổi phần hay cách xem: `ChoiceTrack`, một thanh nền nhạt, mục đang xem nổi lên (phần của lịch, của thống kê, cách xem một danh sách). Đổi thứ tự hay số đo: `ChoiceWords`, chữ trong một hàng, mục đang dùng gạch chân. Các phần dưới một sân khấu: `StageTabs`. Nhiều lựa chọn: `ChoiceMenu`, trên điện thoại là bảng trượt. Điều kiện đang lọc là chip gỡ được (`Chips`). Danh sách dài gập bằng `FoldButton` |
| Tab | `.cp-tabs`: chữ 14px; tab đang mở giữ màu chữ thường, đậm hơn và có vạch màu nhấn bên dưới; một hàng cuộn ngang |
| Logo đội và giải | Nằm trên ô `--hub-plate` đổi theo giao diện, dùng bản logo vẽ cho nền đó |
| Bộ lọc | Chỉ thêm khi danh sách dài hơn một màn hình và chưa tự nói được điều cần lọc. Lịch của một giải có `FilterMenu` (giai đoạn, đội): một nút mở bảng chip, bảng trượt trên điện thoại; mục đang chọn hiện thành chip gỡ được. Khu vực là hàng chip có cờ |
| Chân trang | `StreamFooter`: cú của logo đậu trên đường kẻ (`PerchedOwl`), bấm để về đầu trang và ngước nhìn khi được trỏ tới. Bên dưới chỉ có tên ứng dụng, một câu giới thiệu và phần bản quyền; không có mục chuyển trang, vì thanh trên luôn ở trong tầm tay. Compact: hai phần xếp dọc |
| Bản quyền ảnh | Chân trang của mọi trang nói logo thuộc về ai, kèm đường tới `/credits`; trang có logo không cần dòng riêng |
| Tuyển thủ, nhân sự | Không có ảnh. Cỡ lớn: `Jersey` là áo đấu màu logo của đội, số áo là đường thi đấu (chưa rõ đường thì chữ cái đầu). Cỡ nhỏ: `PlayerMark` vẽ chữ cái đầu của tên trên màu sinh từ tên; tuyển thủ hình khiên, nhân sự hình tròn |
| Hình của trang | `PageMark`: ô bo góc theo cỡ, không cắt tròn logo; trang chưa có hình thì hai chữ cái đầu trên màu dịu |
| Vào và ra | Không có nút mũi tên quay lại. `PlaceTrail` nói trang đang ở đâu và đi lên được mọi chặng; `SeasonSwitch` đổi mùa ngay trên đường dẫn và giữ tab đang mở; `PlaceSteps` sang trận, ván, tướng liền kề; `PlaceBar` giữ lối lên khi đã cuộn. Trang đã tự nói tên thì đường dẫn không nhắc lại |
| Chuyển trang | `Travel`: vào một trang thì đứng ở đầu trang; quay ra thì về đúng chỗ cũ, mục vừa mở có viền màu nhấn rồi tắt dần, và các hiệu ứng mở trang không diễn lại (nhân thời lượng với `--entrance`); đổi tab thì đứng ngay dưới đầu trang. Vào sâu và đi ra chuyển động ngược hướng nhau, logo của dòng vừa bấm lớn dần thành logo đầu trang và thu về khi quay ra. Người dùng bật giảm chuyển động thì không có hiệu ứng, chỗ đứng vẫn giữ |
| Liên kết qua lại | `GoLink`: tên mở trang khác có gạch chân mờ, rê thì gạch và chữ sang màu nhấn; không có mũi tên phía sau, chỉ liên kết ra site khác giữ dấu mở ngoài. Trên sân khấu là một viên `hub-go-pill`; hàng và ô mở cả khối thì đổi nền hoặc màu tên khi rê |
| Tướng, trang bị, phù hiệu, phụ trợ | `EntryPeek` (qua `ReferenceArt`): rê vào hình hiện thẻ tên, chỉ số và một dòng mô tả từ Wiki, chân thẻ là lối mở trang Wiki ở thẻ mới. Bấm hình không rời trang; trên điện thoại chạm hình để mở thẻ |
| Gợi ý khi rê | `Tip` (`components/stream-tip.tsx`) thay `title`: nhãn nền đậm, cả trang dùng chung một lần chờ. Biểu tượng không chữ (đường đi của đội, ô cấm chưa rõ tướng) luôn có `Tip` |
| MVP | `MvpBadge`: chữ MVP trên nền vàng huy chương, kèm `Tip` nói rõ MVP của ván, trận hay giải; không dùng ngôi sao |
| Tướng bị cấm | Hình xám (`--hub-ban-filter`) kèm huy hiệu cấm đỏ ở góc (`--hub-ban-mark`); hàng cấm của ván nằm trong một khay có nhãn "Cấm", trên điện thoại khay bỏ nhãn |
| Tên trong văn bản | `ReferenceText`: trong câu tên có gạch chân màu nhấn, không có mũi tên vì mũi tên chen giữa tên và dấu câu. Rê chuột hiện thẻ xem trước; chạm lần đầu hiện thẻ cạnh tên (không dùng bảng trượt, để người đọc giữ chỗ đang đọc), chạm tiếp mở trang |
| Thứ hạng | `RankBadge`: ba hạng đầu là đồng xu trong vòng nguyệt quế, hạng 1 có vương miện; không dùng quầng sáng |
| Tìm kiếm | Mỗi màn hình một ô, ở thanh trên. Trang có danh sách riêng truyền `search` cho `StreamShell` để ô đó lọc danh sách |
| Trang trong danh bạ | Chưa lọc: mỗi loại một bức tường (`DirectoryHub`). Đã lọc: hàng gọn gồm logo hoặc ảnh, tên tối đa ba dòng, nút theo dõi; không dùng ảnh bìa |
| Trạng thái trống và lỗi | `.hub-state`: cú 48px, một câu, bước tiếp theo |

Chưa dùng Three.js và ảnh tạo bằng AI, vì SVG và CSS đủ cho các hình hiện có. Chỉ thêm khi có cảnh hoặc hình mà SVG không vẽ được.

## Cách đo lại

Mỗi lần đổi bố cục lớn, mở trang ở các độ rộng 375, 480, 640, 768, 900, 1024, 1180, 1280, 1440 và 1600px. Kiểm tra: không tràn ngang, không có nút rớt dòng một mình, nhãn nút không xuống dòng, không có chữ dưới 12px, phần chính nằm trong một đến hai màn hình đầu.
