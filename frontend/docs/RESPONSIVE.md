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
- Nút bấm trên màn hình cảm ứng cao tối thiểu 36px. Ô nhập trên Wiki dùng chữ 16px để iPhone không tự phóng to trang.
- Khi đổi kiểu xem hoặc đổi mục, trang không được nhảy vị trí.

## Component dùng chung

| Component | Việc |
|---|---|
| `PublicFilterSheet` | Trên compact: một nút "Lọc" cạnh ô tìm kiếm, toàn bộ bộ lọc nằm trong drawer dưới và hiện số kết quả |
| `PublicTabBar` | Dãy tab dính dưới đầu trang, cuộn ngang |

## AOV Wiki

| Trang | Compact | Wide |
|---|---|---|
| Đầu trang | Một hàng: về trang chủ hoặc quay lại, tên trang, tìm kiếm, mục lục, thêm | Logo, ô tìm kiếm giữa trang, cài đặt và tài khoản |
| Điều hướng mục | Nút mục lục mở danh sách đầy đủ | Cột mục lục bên trái |
| Chi tiết tướng | Ảnh và tên → Chọn patch → Một dòng "Thay đổi ở bản này", bấm để mở xuống → Tổng quan gọn → Bộ kỹ năng → Trang phục → Video → Các lần thay đổi khác. Nút nổi mở drawer các phần | Màn đầu: ảnh tướng bên trái, bảng tên và Tổng quan bên phải. Sau đó: Chọn patch → Thay đổi → Bộ kỹ năng → Trang phục → Video → Lịch sử, mỗi phần một bảng. Từ 1180px có cột mục lục bên phải, dưới đó dùng nút nổi |
| Danh sách tướng | Ô tìm và nút Lọc dính dưới đầu trang → Thay đổi tại patch → Lưới tướng | Ô tìm → Vị trí và Vai trò → Thay đổi tại patch → Lưới tướng |
| Kho trang bị | Tab Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ → Tìm kiếm → Danh sách | Mục lục bên trái, thanh công cụ một hàng, danh sách |
| Chế độ chơi | Ô tìm → hàng bộ lọc cuộn ngang → Cẩm nang nổi bật → Danh sách dạng hàng: ảnh nhỏ, tên, thời lượng, tình trạng | Ô tìm và bộ lọc một hàng → Cẩm nang nổi bật → Lưới thẻ có ảnh theo nhóm PVP, Giải trí |
| Một chế độ | Ảnh → Hàng tab cẩm nang dính dưới đầu trang → Thông tin nhanh hai cột → Giới thiệu → Luật chơi gấp theo nhóm, nhóm đầu mở sẵn | Ảnh → Hàng tab → Giới thiệu và Luật chơi bên trái, Thông tin nhanh dính bên phải |
| Cẩm nang Cờ Liên quân | Quân cờ: lọc Phe/Nghề bằng icon, mỗi loại một hàng cuộn ngang; nút giá (đồng vàng + số) chia đều một hàng; lưới 4 cột chỉ ảnh và tên, chia theo giá. Phe & Nghề: lưới icon, bấm icon mở chi tiết trong ngăn kéo; bảng Phe × Nghề cuộn ngang, cột Nghề đứng yên. Chúc phúc: một cột thẻ màu theo bậc. Đội hình: nút chuyển Bàn cờ / Danh sách ở đầu mục; bàn cờ 3 hàng × 7 ô vuông (hàng trước ở trên, phía đối thủ), chỉ ảnh quân; danh sách là bàn 5×2; Phe/Nghề, trang bị và chúc phúc ưu tiên xếp dưới. Xếp đội hình: chế độ bàn cờ 3 × 7 — bấm ô trống mở ngăn chọn quân cho đúng ô đó, bấm quân để chọn rồi bấm ô khác để chuyển hoặc đổi chỗ, quân chưa có ô nằm ở hàng chờ dưới bàn; chế độ danh sách là 10 ô + ô thêm → Phe/Nghề đang kích hoạt | Quân cờ: thẻ có icon Phe và Nghề ngăn bằng vạch, rê chuột để xem tên, chia theo giá. Phe & Nghề: lưới icon bên trái, chi tiết dính bên phải. Đội hình: bàn cờ 3 × 7 (rộng tối đa 560px, tên quân hiện trên ảnh) hoặc bàn 5×2 bên trái, Phe/Nghề, trang bị và chúc phúc ưu tiên bên phải. Xếp đội hình: bàn cờ 3 × 7 hoặc 10 ô + ô thêm bên trái, Phe/Nghề bên phải |

## AOV Stream

Hàng tab Bảng tin, Giải đấu, Khám phá nằm ở đầu trang trên cả hai bố cục. Trang giải đấu: compact có ô tìm và nút Lọc, wide có ô tìm cùng nhóm ô lọc trên một hàng.

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

### Trang tướng: tab mục (09/11/2026)

Trang tướng trong Admin không còn cột "Trên trang này" và nút nổi mở mục lục. Tab "Nội dung" chia thành **hàng tab mục**: Tổng quan → Kỹ năng → Trang phục → Ảnh → Video (Video chỉ có khi tướng đã lưu). Chỉ áp dụng trong Admin, Wiki công khai giữ nguyên.

- **Hai hàng dính.** Trên là hàng tab quản lý (Nội dung, Bản dịch, Lịch sử, Theo patch, Phiên bản), dưới là hàng tab mục. Khi cuộn xuống, cả hai dính ở đầu khung rồi hàng tab quản lý trượt lên ẩn đi, chỉ còn hàng tab mục. Cuộn lên một chút là hàng tab quản lý hiện lại. Dùng bàn phím đi tới hàng này cũng làm nó hiện lại.
- **Tướng ở đầu hàng tab mục.** Khi đầu trang đã cuộn khỏi màn hình, đầu hàng tab mục hiện ảnh tướng, tên tướng (ẩn tên khi khung hẹp hơn 42rem) và nút đổi tướng. Các tab nằm bên phải phần này. Lúc đầu trang còn trong màn hình thì phần này thu lại, vì đầu trang đã có tên tướng.
- **Tổng quan gom nội dung.** Thẻ tướng, Đánh giá và Thuộc tính chiến đấu hiện đầy đủ. Các tab khác chỉ có bản thu nhỏ, xếp theo mức quan trọng. Bấm vào một mục trong bản thu nhỏ thì xem ngay tại chỗ, không chuyển tab. Chỉ nút "Xem chi tiết" mới sang tab đó:
  - Kỹ năng: dải icon chiêu, biến thể xếp chồng. Bấm một chiêu thì bên dưới hiện tên chiêu và 3 dòng đầu của mô tả. Chiêu đang xem dùng chung với tab Kỹ năng, nên "Xem chi tiết" mở đúng chiêu đó.
  - Trang phục: một hàng ảnh, không có tên. Lúc đầu hiện 8 trang phục, kéo ngang tới cuối hàng thì tải thêm 8. Bấm một ảnh thì mở ảnh lớn có tên, chuyển được giữa các trang phục đã hiện.
  - Ảnh: ba ảnh Đại diện, Chân dung, Ảnh nền thu nhỏ. Bấm thì mở ảnh lớn.
  - Video: số video và 3 video đầu, có ảnh thu nhỏ và mục đích. Bấm thì phát trong cửa sổ.
- **Thuộc tính chiến đấu** nằm chung thẻ với Đánh giá:
  - Các thuộc tính nổi bật hiện thành dòng giống Đánh giá: icon của game, tên, giá trị bên phải. Bên dưới là một dòng nguồn ghi nhận.
  - Nút "Toàn bộ thuộc tính" và "So sánh" mở cùng một cửa sổ rộng, có hai tab. Tab Thuộc tính chia hai cột trên màn rộng; tab So sánh là phần phân tích với các tướng khác. Cột bên cạnh thẻ tướng vì thế không bị kéo dài.
  - Cảnh báo nguồn trỏ tới thuộc tính sẽ mở thẳng cửa sổ này.
  - Không có thuộc tính nổi bật nào thì toàn bộ danh sách hiện luôn trong thẻ.
- **Bố cục Tổng quan.** Khung từ 820px: cột trái là thẻ tướng → Kỹ năng → Trang phục, cột phải 22rem là Đánh giá và thuộc tính → Ảnh → Video. Hẹp hơn thì xếp một cột theo thứ tự quan trọng: tướng → kỹ năng → đánh giá, thuộc tính → trang phục → ảnh → video.
- **Mỗi tab nhớ chỗ đang xem.** Quay lại một tab, hoặc bấm lại tab đang mở, thì trang về đúng vị trí đã cuộn trước đó. Sang Bản dịch hay Lịch sử rồi về Nội dung cũng vậy.
  - Tab mở lần đầu bắt đầu ngay dưới hàng tab. Nếu đầu trang còn trong màn hình thì giữ nguyên chỗ đó.
  - Vị trí được đặt lại khi tab còn đang tải và trang dài ra, cho tới khi người đọc tự cuộn hoặc gõ phím.
- **Tab được dựng một lần rồi giữ.** Lần đầu mở tab thì tab mới được dựng. Từ đó tab chỉ ẩn khi sang tab khác, nên chiêu, trang phục đang chọn và dữ liệu đã tải vẫn còn.
- **Sửa trong tab.** Bút mở trình sửa thay chỗ nội dung của tab đó; sửa phần Tổng quan thì trình sửa chiếm cả tab. Trình sửa mở ra thì đầu tab được đưa lên ngay dưới hàng tab. Trong lúc sửa vẫn sang tab khác đọc được; tab đang sửa có chấm nhỏ trên nhãn.
- `?tab=skills`, `?tab=media`… mở thẳng tab đó. Đổi tab chỉ thay `tab` trong URL, không thêm vào lịch sử trình duyệt.

Component: `HeroStickyBars` và `HeroContentTabs` trong `apps/admin-aov/src/features/publishing/hero-content-tabs.tsx`. Các bản thu nhỏ nằm trong `hero-overview-previews.tsx`. `HeroStickyBars` đặt một mốc cao 0px ngay trước hai hàng; mốc này bù lại khoảng cách `gap-4` của `Page`, và vị trí tab mở lần đầu được đo theo mốc đó.

Component dùng chung cho ngăn chi tiết: `SectionContents`, `ContentsSection` và `useSectionContents` trong `apps/admin-aov/src/components/section-contents.tsx`. Trang khai báo chiều cao các thanh dính phía trên bằng `--contents-offset` (px) trên `SectionContents`. Thanh dính cần `[overflow-anchor:none]` để trình duyệt không lấy nó làm mốc giữ vị trí cuộn.

| Trang | Cách xử lý |
|---|---|
| Chi tiết tướng | Tab: Nội dung → Bản dịch → Lịch sử → Theo patch → Phiên bản (tạo bản nháp kế thừa, chuyển mốc, ghi thay đổi patch; trước đây nằm trong menu `⋯`), trên điện thoại năm tab chia đều một hàng, icon trên nhãn. Nội dung chia tab mục Tổng quan → Kỹ năng → Trang phục → Ảnh → Video (xem "Trang tướng: tab mục"); trên điện thoại các tab mục cũng chia đều một hàng, icon trên nhãn, không hiện số đếm. Thẻ tướng: ảnh, tên, danh hiệu, giá vàng và quân huy dạng icon kèm số, vai trò, giới thiệu; cốt truyện mở bằng icon sách trong cửa sổ riêng. Kỹ năng khi đọc là một dải icon chiêu (nhãn Nội tại, Chiêu 1…) với nút Tập trung / Dạng phẳng ở cuối, chi tiết chiêu bên dưới, bản quyền ảnh ở chân thẻ; trình sửa vẫn có cột chọn chiêu |
| Chi tiết trang bị | Ngăn bên rộng tối đa 880px, trên điện thoại là sheet dưới. Tab: Nội dung → Bản dịch → Lịch sử. Nội dung: Thông tin (chỉ số, hiệu ứng, ghép từ, vị trí trong shop) → Mốc patch và ghi chú → Video. Cột mục lục khi ngăn từ 42rem |
| Chi tiết ngọc, phụ trợ, phù hiệu | Như trang bị. Nội dung: Thông tin → Phân loại ngọc / Thuộc tính / Hệ và vị trí → Chỉ số (ngọc) hoặc Trạng thái phụ trợ → Ảnh → Mốc patch và ghi chú → Video. Ngăn sửa hệ phù hiệu và nhóm trang bị vẫn giữ tab vì chỉ là một biểu mẫu ngắn |
| Đầu trang chi tiết tướng | Tên và nhóm nút là hai khối. Nút đổi tướng nằm ngay sau tên, cả ở đầu trang lẫn phần tướng ở đầu hàng tab mục (hoặc thanh tên dính ở các tab quản lý) khi cuộn. Phiên bản chỉ hiện `#số`, ngôn ngữ chỉ hiện lá cờ; tên đầy đủ nằm trong tooltip và menu. Khung đầu trang từ 42rem: `#số`, cờ, Xuất bản/Tạo bản nháp, `⋯`; không đủ chỗ thì cả nhóm xuống hàng dưới. Hẹp hơn (đo theo chính khung, nên đúng cả trong ngăn bên): một hàng, ẩn ảnh nhỏ cạnh tên, menu `#số` chứa danh sách phiên bản, mục Ngôn ngữ và Xuất bản/Tạo bản nháp, đặt ngay trái `⋯`. Menu `⋯` chỉ còn Mở trang đầy đủ và Hủy bản nháp. Ngăn tướng mở từ danh sách không có thanh tiêu đề riêng; "Mở trang tướng đầy đủ" nằm đầu menu `⋯` |
| Danh sách có bộ lọc | Ô tìm một khối, nhóm ô lọc một khối luôn nằm trên một hàng |
| Hồ sơ (Đội tuyển, Tuyển thủ…) | Tab trên một hàng, thiếu chỗ thì ẩn icon rồi cuộn ngang |
| Tuyển thủ | Ẩn cột theo độ rộng, tên đội chuyển xuống dòng phụ khi ẩn cột đội |
| Quản lý ảnh | Lọc nguồn một khối, loại ảnh cùng số lượng và kiểu xem một khối |

## Phong cách: Wiki và Stream khác nhau

Không dùng nền màu mờ lấy từ ảnh hay nền sặc sỡ: màu mạnh chỉ đến từ chính ảnh tướng và icon. Chuyển động nhẹ và tắt khi người đọc bật giảm chuyển động.

**Không dùng một khung cho mọi chỗ.** Mỗi loại nội dung có cách trình bày riêng. Trang nhiều dữ liệu cần nền yên tĩnh, không đặt họa tiết phía sau chữ. Ảnh mẫu chỉ để học hỏi: họa tiết và bố cục là thiết kế riêng.

### AOV Wiki: xanh than và vàng nhạt

Nền trang xanh than, bảng xám xanh, tiêu đề và dấu nhấn vàng nhạt. Màu nằm trong `tokens.css` với tên `--aov-wiki-*` và được `wiki.css` gán vào các token chung. Lớp `.public-panel` cho nội dung trong bảng thấp hơn bảng một bậc để thẻ nổi lên.

| Nội dung | Cách trình bày |
|---|---|
| Màn đầu trang tướng | `OrnatePanel`: bảng có góc vàng và hình huy hiệu mờ. Chỉ dùng ở đây |
| Bộ lọc tướng, kỹ năng đang chọn, Tổng quan trên điện thoại, Cập nhật mùa, Danh mục | `.wiki-slip`: bảng trơn bo góc |
| Kho trang bị và phần chi tiết | Đặt thẳng trên nền, thẻ bảng xám xanh, icon nổi rõ. Phần chi tiết cùng tông, icon có ánh vàng |
| Thay đổi ở bản này | Dải bảng có vạch vàng bên trái |
| Danh sách kỹ năng | Đặt thẳng trên nền, kỹ năng đang chọn có vạch vàng |
| Trang phục | Ảnh lớn đặt thẳng trên nền, viền vàng mảnh |
| Thẻ tướng | Khung xám xanh có góc vàng nhỏ, tên dưới ảnh |
| Video | Máy tính: thẻ bo góc theo lưới. Điện thoại: hàng dọc, ảnh bên trái như danh sách trong trình phát, hiện 3 mục đầu |
| Ghi chú cập nhật, Các lần thay đổi khác | Dòng thời gian: đường vàng dọc và các bảng nhỏ |
| Trang một bản cập nhật, Thuật ngữ | `.wiki-document`: một trang đọc có đường vàng ở trên |
| Danh mục ở trang chủ | Huy hiệu tròn viền vàng, nhãn vàng nhạt |
| Tham chiếu trong đoạn văn | Chữ thường cùng cỡ, chỉ khác màu, gạch chân khi rê chuột. Bôi đen được cả câu đi qua tham chiếu; thẻ thông tin chỉ mở khi bấm xong hoặc rê chuột |
| Icon thuật ngữ và chỉ số | Hình đơn sắc lấy màu chữ xung quanh |

### AOV Stream: màu của logo cú

Chàm đêm, lông xanh tím, mắt vàng, mặt kem. Màu nằm trong `tokens.css` với tên `--aov-stream-*`. Trang theo chế độ sáng hoặc tối của người xem, riêng thanh trên, dải tiêu đề và chân trang luôn tối.

| Nội dung | Cách trình bày |
|---|---|
| Nền trang | Hoàng hôn xanh tím, họa tiết vảy lông mờ dần từ đầu trang |
| Thanh trên | Dải chàm đêm, mục đang chọn là viên vàng như mắt cú |
| Tiêu đề trang | Dải chàm bo góc, hình cú ở cuối dải |
| Tiêu đề mục | Một chấm vàng như mắt cú |
| Mục đang chọn | Trang sáng: nền chàm, chữ kem. Trang tối: nền vàng, chữ chàm. Tab giữ chữ thường và có vạch vàng |
| Chữ logo | Vẽ bằng nét tròn đậm cho hợp con cú: AOV màu kem của mặt cú, Stream màu xanh tím của lông, kèm ngôi sao nhỏ của logo |
| Mục đang ở trên đầu trang | Khối bo góc màu chàm giống nền logo, chữ kem đậm, ngôi sao nhỏ ở góc |
| Thẻ hồ sơ | Ảnh bìa phía trên, viền sáng lên khi rê chuột |

Chưa dùng Three.js và ảnh tạo bằng AI, vì SVG và CSS đủ cho các họa tiết hiện có. Chỉ thêm khi có cảnh hoặc hình mà SVG không vẽ được.

## Cách đo lại

Mỗi lần đổi bố cục lớn, mở trang ở các độ rộng 375, 480, 640, 768, 900, 1024, 1180, 1280, 1440 và 1600px. Kiểm tra: không tràn ngang, không có nút rớt dòng một mình, nhãn nút không xuống dòng, không có chữ dưới 12px, phần chính nằm trong một đến hai màn hình đầu.
