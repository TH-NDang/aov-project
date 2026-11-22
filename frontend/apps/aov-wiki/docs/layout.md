# Bố cục thân trang

## Khung trang

- Mọi trang có thanh đầu trang `WikiHeader` (xem `header.md`) và chân trang `WikiFooter`. Các trang danh sách và tham
  khảo (`/hero`, `/skins`, `/warehouse/*`, `/modes/*`, `/updates/*`, `/terms/*`) dùng `WikiLibraryLayout` trong
  `src/layout/wiki-library-layout.tsx`; chi tiết tướng dùng `HeroDetailLayout` trong cùng file. Trang chủ, Liên hệ, Tài
  khoản và trang không tìm thấy tự đặt header của mình.
- Trang nằm trong cột `--aov-page-max` (1280px), lề `--wiki-gutter` mỗi bên, cùng cột với thanh đầu trang nên logo và
  nội dung bắt đầu trên cùng một đường.
- Trên wide, `WikiLibraryLayout` đặt sidebar các mục (`LibraryNavigation layout="sidebar"` trong
  `src/components/library-navigation.tsx`) bên trái trang: Trang chủ, rồi các mục theo nhóm Sổ tay nhân vật, Kho trang
  bị, Lối chơi, Tham khảo. Rê chuột thì hàng có nền mờ; mục đang ở có nền vàng nhạt, chữ vàng đậm và một vạch tròn ngắn
  ở mép trái. Sidebar rộng 200px, dính dưới thanh đầu trang và tự cuộn nếu cửa
  sổ thấp; dưới 1180px chỉ còn icon (52px), tên mục hiện trong tooltip bên phải icon ngay khi rê chuột hoặc focus
  bằng bàn phím. Trang chủ không có sidebar vì đã có các ô mục. Chi tiết tướng (`HeroDetailLayout`) cũng có sidebar trên
  wide: ảnh tướng nằm trong cột trang bên phải sidebar, vẫn bắt đầu dưới thanh đầu trang trong suốt. Phía trên tên tướng
  là breadcrumb Trang chủ › Tướng › tên tướng (`WikiBreadcrumb` trong `src/components/wiki-breadcrumb.tsx`) thay cho
  nút quay lại. Trên compact các mục nằm trong tấm mục lục mở từ header.
- Mỗi trang danh sách mở bằng `CatalogHeading` (`src/layout/catalog-heading.tsx`): tiêu đề (`title`), tối đa một dòng mờ
  (`lead`), tối đa một nút hoặc phiên bản dữ liệu bên phải (`action`), và đường quay lại (`back`) cho trang không mở từ
  header. Trên compact phần này không hiện vì header đã ghi tên trang; trang mà header không ghi tên (Liên hệ, Tài khoản)
  truyền `compact` để giữ lại.
- Sau đầu trang là điều khiển: tìm trước, lọc sau. Trên compact bộ lọc gom vào `PublicFilterSheet` hoặc một hàng cuộn
  ngang. Rồi đến nội dung, dùng hết cột trang; đoạn văn dài hẹp hơn, tối đa 72ch.
- Các route ngoài trang chủ được tải riêng khi truy cập (`lazy` trong `App.tsx`), không đưa vào lần tải trang chủ.
- Nền trang là màu nền Wiki với một quầng sáng rất nhạt ở đầu màn hình, đứng yên khi cuộn (`--aov-wiki-backdrop`, vẽ bằng
  `body::before` trong `wiki.css`).
- Cả trang dùng phông Be Vietnam Pro; cỡ chữ theo các vai trò trong `src/styles/typography.css` (xem
  `frontend/docs/DESIGN-TOKENS.md`). Ô nhập và nút thường dùng chung `src/styles/controls.css`: `.wiki-field`,
  `.wiki-input`, `.wiki-select`, `.wiki-button`, nút chính có `data-primary`.
- Trạng thái trống, lỗi và không tìm thấy dùng linh vật chuột chũi (`wiki-mascot-state`), một câu nói rõ chuyện gì xảy ra
  và bước tiếp theo.

## Hai bố cục

Dưới 900px trang dùng bố cục compact, từ 900px dùng bố cục wide. Hai bố cục là các component riêng, chọn bằng `usePageLayout`; nguyên tắc nằm ở `frontend/docs/RESPONSIVE.md`. Trên compact, đầu trang là một hàng gồm nút về trang chủ hoặc quay lại, tên trang, tìm kiếm, mục lục và nút "⋯". Các nút này dùng icon nét đậm (`weight="bold"`: ngôi nhà, kính lúp, lưới bốn ô, ba chấm đặc) vì thường nằm trên ảnh; khi thanh còn trong suốt, mỗi nút có nền tròn mờ phía sau. Không có thanh điều hướng ở đáy màn hình.

## Trang chủ

- Thứ tự giống nhau ở hai bố cục (`src/features/home/wiki-home.tsx`): mở đầu → các mục của Wiki → thay đổi
  của bản đang áp dụng → các bản cập nhật trong mùa và các vai trò. Hai bố cục chỉ khác tỉ lệ.
- Mở đầu (`HomeIntro`): dòng nhỏ "AOV Wiki · Liên Quân Mobile", tiêu đề và một dòng về bản đang áp dụng (ngày, tên bản, số tướng thay đổi) dẫn tới ghi chú của bản đó. Phía sau là
  ảnh tướng của ngày (`home-banners.ts`: mỗi ngày một trong ba ảnh, tên tướng ghi ở góc), phủ nửa phải và mờ dần vào
  nền ở mép trái và mép dưới. Ảnh không tự chuyển trong lúc đọc. Trên compact ảnh nằm trên cùng, header trong suốt đè lên.
- Các mục (`HomeSections`, dùng `WikiSectionTiles` trong `src/components/wiki-section-tiles.tsx`): chín ô Tướng, Trang
  phục, Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ, Chế độ chơi, Cập nhật, Thuật ngữ, lấy từ `src/lib/wiki-sections.ts`. Sáu
  ô đầu ghi số mục đã xuất bản, đọc từ tổng của một trang một dòng ở từng API danh mục (số tướng lấy từ danh sách tướng);
  ba ô sau ghi một dòng mô tả. Mỗi ô không có nền card: icon ở trên, tên, rồi dòng phụ mờ; rê chuột thì tên chuyển vàng
  và icon nhích lên. Luôn tối đa hai hàng: từ 1180px chín ô một hàng; 900–1179px năm rồi bốn; compact ba ô một hàng, hiện
  hai hàng đầu và phần trên của hàng thứ ba mờ dần (không bấm được) để người đọc biết còn mục; mũi tên mờ đè lên đó mở
  hàng thứ ba và đổi chiều để thu gọn. Trang không tìm thấy dùng cùng bộ ô này.
- Thay đổi ở bản đang áp dụng (`HomePatchChanges`): các tướng có ghi chú thay đổi ở bản đang áp dụng, nhóm theo loại
  thay đổi (mới, làm lại, tăng sức mạnh, giảm sức mạnh, rồi các loại khác), mỗi nhóm có hình và tên loại cùng số tướng.
  Mỗi tướng là một thẻ nhỏ có ảnh, tên và vai trò, vạch màu của loại bên trái; tướng đã có hồ sơ công khai thì mở trang
  tướng (đúng dạng tướng khi thay đổi ghi theo dạng, ADR-024), tướng chưa có hồ sơ vẫn được liệt kê nhưng không có liên
  kết. Liên kết "Xem ghi chú đầy đủ" nằm ở đầu mục trên wide, cuối mục trên compact. Trong lúc chờ danh sách tướng, mục
  giữ chỗ bằng các ô trống.
- Các bản cập nhật (`SeasonUpdates`): các bản của mùa đang áp dụng, mới nhất trước, mỗi bản một hàng có ngày, tên và nhãn
  Đang áp dụng, mở trang ghi chú của bản đó; liên kết "Tất cả" tới `/updates`. Dữ liệu lấy từ API public
  `GET /api/wiki/v1/seasons/current/updates?region=VN&locale=vi-VN&limit=4`, dùng TanStack Query: dữ liệu mới trong 60
  giây, tự kiểm tra lại mỗi 5 phút khi tab đang mở. Chỉ hiện patch đã công bố và có hiệu lực trong mùa áp dụng cho thị
  trường đang chọn; không suy đoán mùa nếu backend chưa xác nhận. Ngày patch giữ đúng độ chính xác backend. Lỗi kết nối
  có nút thử lại.
- Vai trò (`HomeRoles`): sáu vai trò, mỗi ô có icon, tên và số tướng, mở `/hero?role=...`.
- Wide: thay đổi của bản bên trái, cột phải 340px (300px dưới 1180px) chứa các bản cập nhật và vai trò. Compact: một cột,
  thẻ tướng thay đổi xếp hai thẻ một hàng.

## Thư viện Tướng

- `/hero` mở bằng phần trưng bày (`HeroShowcase` trong `src/features/hero/components/hero-showcase.tsx`, dựng trên
  `CatalogShowcase` của `src/components/catalog-showcase.tsx` mà bốn phần kho cũng dùng). Chữ chỉ có tiêu đề và số tướng
  (trên compact header đã ghi tên trang nên chỉ còn số tướng). Phiên bản dữ liệu là một viên kính mờ (`appearance="pill"`
  của `WikiVersionPicker`) ghim ở góc trên phải banner trên wide, cạnh số tướng trên compact. Phía sau là một bức tường chân dung phủ
  cả banner, kể cả sau chữ: 16 dải ảnh dọc cắt từ ảnh `PORTRAIT` để thấy mặt tướng, mỗi dải bắt đầu ở một độ cao khác nhau
  và chạy quá chân banner, nơi có lớp sương mờ. Bức tường trôi rất chậm sang trái rồi lặp lại không có chỗ nối (tắt khi
  người đọc giảm chuyển động). Lớp tối bên trái giữ chữ rõ. Tướng trên tường đổi theo ngày (`dailySpread` trong
  `model/hero-daily-spread.ts`), rải đều khắp danh sách. Trên compact header trong suốt đè lên bức tường.
- Ngay sau phần trưng bày là bảng thay đổi ở bản đang xem (`HeroPatchBoard`): một khung nền tối nhạt chia thành các nhóm theo loại
  thay đổi, ngăn bằng một đường mảnh. Mỗi nhóm ghi tên loại và số tướng, kèm dấu theo màu của loại: hai mũi tên lên
  (tăng, đỏ), hai mũi tên xuống (giảm, xanh lá), mũi tên vòng (làm lại, cam), dấu lấp lánh (mới, vàng), thanh chỉnh (điều
  chỉnh, xanh dương). Mỗi tướng là một thẻ chân dung có tên ở chân và một vạch mảnh màu của loại dưới thẻ. Góc thẻ có
  một nhãn chữ ngắn mà người chơi hay dùng: Buff, Nerf, Rework, New, Tweak; chữ đậm, nghiêng, màu của
  loại, có quầng sáng nhẹ, trên nền tối. Màu chỉ nằm ở các chi tiết này để khối không chói. Ở mọi chỗ trong Wiki (hàng thay đổi ở trang chủ, trang kho, trang tướng), tăng sức mạnh là màu đỏ và giảm sức mạnh là màu xanh lá. Các nhóm nằm cạnh nhau và
  cuộn ngang khi không đủ chỗ. Liên kết "Xem ghi chú đầy đủ" nằm bên phải tiêu đề. Tướng chưa có hồ sơ vẫn được liệt kê
  nhưng không có liên kết. Trên compact các nhóm xếp dọc, mỗi nhóm một hàng, để mọi loại thay đổi hiện ngay từ cái nhìn đầu; thẻ trong một hàng vuốt ngang riêng, có chặn theo từng thẻ, và mép phải mờ dần khi còn thẻ phía sau. Liên kết ghi chú chuyển xuống thành một hàng rộng ở cuối khung. Các trang kho vẫn dùng hàng chip `PatchChangesRow`.
- Bảng thay đổi luôn hiện đủ mọi tướng đổi ở bản đó, không theo ô tìm và bộ lọc: đó là tin của bản, đọc trước khi tra
  cứu. Ô tìm và bộ lọc nằm sau, ngay trên lưới tướng mà chúng thu hẹp. Trên wide chúng gom vào một khung tra cứu
  (`wiki-hero-finder`): dòng đầu là tên danh sách ("Tất cả tướng" hoặc "Kết quả"), số tướng, nút Xóa bộ lọc khi đang lọc
  và ô tìm ở cuối dòng; dưới một đường mảnh là hai nhóm chip Vị trí, Vai trò, mỗi chip có icon, tên và số tướng nó sẽ cho
  thấy khi giữ nguyên ô tìm và nhóm lọc còn lại; lựa chọn cho 0 tướng bị làm mờ nhưng vẫn bấm được. Trên compact, ô tìm
  dính dưới đầu trang; ngay dưới là hai hàng nút tròn chỉ có icon (Vị trí rồi Vai trò). Nút đang chọn hiện thêm tên. Rê
  chuột hoặc focus thì tooltip ghi tên và số tướng; trên màn cảm ứng tooltip hiện khoảng 1,6 giây sau khi chạm. Khi hai
  hàng icon cuộn khuất dưới thanh dính, nút Lọc chỉ có icon hiện trong thanh, mở drawer có đủ tên và số tướng. Sau đó là
  tiêu đề danh sách và lưới.
- Ô tìm (`HeroSearch` trong `components/hero-search.tsx`) chỉ tìm theo tên: tên, mã và tên các dạng của tướng, không
  cần dấu. Vai trò và vị trí không được tìm qua ô này vì đã có bộ lọc riêng; tìm cả chúng làm lẫn vào những tướng người
  đọc không định tìm (gõ "tro" ra cả nhóm Trợ thủ). Kết quả xếp theo mức khớp (`heroSearchRank` trong
  `model/hero-search-rank.ts`): tên bắt đầu bằng chữ đã gõ trước, rồi tên có một từ bắt đầu bằng chữ đó, cuối cùng là
  tên chỉ chứa chữ đó ở giữa; cùng mức thì theo thứ tự thư viện. Bấm / ở bất kỳ đâu trên trang (khi không
  đang gõ ở chỗ khác) để vào ô; lúc ô trống, phím / hiện như một nút nhỏ ở cuối ô trên máy có bàn phím. Đã gõ thì cuối ô
  có nút × để xóa, Esc cũng xóa. Khi chỉ còn đúng một tướng, Enter mở trang tướng đó. Trên compact ô cao 44px, chữ 16px
  để iOS không phóng to khi focus.
- Gõ trong ô hiện chữ ngay; lưới đi theo sau một nhịp (giá trị tìm được hoãn bằng `useDeferredValue`), và địa chỉ trang
  chỉ ghi `q` khi ngừng gõ khoảng 0,25 giây, để chia sẻ hoặc quay lại được. Danh sách đã lọc, bảng thay đổi và lưới được
  giữ nguyên khi không đổi, nên một phím bấm không vẽ lại cả trang.
- Khi đang tìm hoặc lọc, tướng không khớp không bị ẩn: tướng khớp lên đầu theo thứ tự xếp hạng trên, phần chữ khớp trong tên được tô vàng (so khớp
  không dấu nhưng tô đúng chữ có dấu); sau một đường đứt là dòng "Không khớp · N" có nút Thu gọn/Hiện, rồi các tướng còn
  lại mờ và xám, rê chuột thì rõ lại. Ô chữ cái chỉ hiện khi xem toàn bộ. Không có tướng nào khớp thì một dòng phía trên
  lưới nói vậy, kèm nút Xóa bộ lọc. Mọi thẻ nằm trong một lưới duy nhất và chỉ đổi thứ tự bằng CSS `order`, nên gõ tìm
  không dựng lại thẻ hay tải lại ảnh.
- Rồi đến lưới tướng, tiêu đề "Tất cả tướng" hoặc "Kết quả" kèm số tướng; khi đang lọc có nút Xóa bộ lọc. Thẻ tướng là
  ảnh chân dung phủ kín thẻ (3:4), tên, vai trò và dấu vị trí nằm trên lớp tối ở chân ảnh như thẻ trang phục; rê chuột thì
  viền và tên chuyển vàng.
  Mỗi nhóm tướng mở bằng một ô mục lục cùng cỡ thẻ: nhãn lớn viền vàng trên nền chấm và số tướng của nhóm.
- Ô "Xếp theo" cạnh số tướng (`sort` trên URL) chỉ hiện những cách xếp có dữ liệu: Tên A–Z (mặc định), Độ khó (nhóm
  Dễ/Trung bình/Khó theo `difficulty` của danh sách, thang 10), Bậc và Tỉ lệ thắng (từ `GET /hero-rankings`, chỉ khi có
  bảng xếp hạng đã xác nhận; tướng có hình thái lấy dòng của hình thái mặc định). Tướng chưa có dữ liệu xếp cuối, trong
  ô "Chưa có". Tên xếp và nhóm theo tên đang hiển thị, không theo mã: bỏ dấu, Đ tính như D, so sánh theo ngôn ngữ đang
  chọn, nên Triệu Vân nằm ở T.
- Trên compact, khi xếp theo tên và không lọc, một cột chữ cái nằm ở mép phải lúc lưới đang trên màn hình: chạm hoặc
  vuốt dọc cột để nhảy tới chữ đó, chữ đang chọn hiện lớn bên cạnh ngón tay.
- Trên desktop có chuột, rê lên thẻ khoảng 0,35 giây mở khung xem nhanh bên phải thẻ: vai trò, vị trí, độ khó và, khi có
  bảng xếp hạng, bậc cùng tỉ lệ thắng, chọn, cấm.
- Danh sách lấy các tướng đã xuất bản từ API public `GET /api/wiki/v1/heroes?region=VN&locale=vi-VN&size=100&page=0`. Nếu có nhiều trang, chương trình đọc tiếp trước khi lọc; số lượng kết quả được tính từ dữ liệu thực tế, không cố định theo một bộ mẫu. Mỗi mục có thể kèm trường `portrait` để dùng ảnh `PORTRAIT` ngay từ API danh sách, không cần tải chi tiết từng tướng chỉ để lấy ảnh.
- TanStack Query giữ dữ liệu danh sách và chi tiết ở trạng thái mới trong 60 giây, dùng chung danh sách khi chuyển giữa thư viện và chi tiết. Khi lỗi có nút thử lại; khi chưa có dữ liệu hoặc không khớp bộ lọc có trạng thái riêng, không thay bằng tướng mẫu.
- Danh sách gọi trang 1 và trang 2 cùng lúc (`ahead` của `wikiGetPages`), vì số tướng vượt một trang 100.
- Câu trả lời gần nhất của các danh mục được giữ trong IndexedDB của trình duyệt (`@aov/ui/lib/stored-answers`, nối
  một lần trong `main.tsx`): danh sách tướng, bốn kho và nhóm của kho, trang phục, danh sách phiên bản và tin cập nhật
  ở trang chủ. Mỗi truy vấn tự bật bằng `meta: { storedAnswer: "wiki-…@1" }`; số sau @ tăng khi đổi cấu trúc dữ liệu.
  Mỗi loại giữ một bản (đổi thị trường, ngôn ngữ hay phiên bản thì thay bản cũ), tổng tối đa khoảng 25MB, đầy thì bỏ
  bản cũ nhất. Lần mở sau, bản đã lưu hiện ngay trong lúc danh sách được đọc lại từ API. Dữ liệu của người đã đăng
  nhập không bao giờ được lưu. Trình duyệt không có hoặc từ chối IndexedDB thì chỉ mất phần hiện sẵn này.
- Hai nhóm bộ lọc phân biệt rõ: **Vị trí** gồm Đường Caesar, Rừng, Đường giữa, Đường Rồng, Hỗ trợ; **Vai trò** gồm Đỡ
  đòn, Đấu sĩ, Sát thủ, Pháp sư, Xạ thủ, Trợ thủ (`hero-classifications.ts`). Mỗi lựa chọn có icon và tên. Vai trò và vị
  trí lấy từ dữ liệu tướng đã xuất bản (`roles`, `positions`), không suy luận vị trí từ vai trò. Thêm **Độ khó**
  (Dễ, Trung bình, Khó; icon cột tăng dần) khi danh sách có độ khó, và **Phiên bản** với một lựa chọn "Đổi ở bản này"
  giữ các tướng (hoặc hình thái) được đổi ở phiên bản đang chọn. Trên compact, hai nhóm này chỉ nằm trong tấm lọc.
- Trạng thái lọc lưu trên URL: `q` là tên hoặc mã tướng, `role`, `position`, `difficulty` (`EASY`, `MEDIUM`, `HARD`) và `changed` (`CHANGED`) là các giá trị phân cách bằng dấu phẩy, ví dụ `/hero?q=amily&role=WARRIOR&position=TOP,JUNGLE`. Trong cùng nhóm chỉ cần khớp một lựa chọn; giữa tìm kiếm, vai trò và vị trí phải đồng thời khớp. Tìm kiếm không phân biệt chữ hoa, chữ thường hoặc dấu tiếng Việt, gồm cả `đ`/`d`.
- Thẻ tướng (`hero-card.tsx`) ưu tiên ảnh `PORTRAIT` thật, dùng `HEAD` nếu thiếu hoặc lỗi chân dung, rồi mới dùng chỗ giữ
  chỗ. Ảnh dọc tỉ lệ 4:5 trên nền thẻ, không viền; tên, vai trò và vị trí nằm dưới ảnh: vai trò ghi chữ khi thẻ đủ rộng,
  chỉ còn icon khi hẹp; vị trí luôn là icon. Lưới 7 cột, 6 cột dưới 1100px, 5 cột trên compact, 4 cột dưới 720px, 3 cột
  dưới 480px. Toàn bộ thẻ mở chi tiết và giữ đường dẫn bộ lọc để quay về; nguồn ảnh mở từ nút nhỏ trên thẻ.
- 11 icon vị trí/vai trò và 4 icon lọc (`easy`, `medium`, `hard`: ba cột tăng dần tô 1, 2, 3 cột; `changed`: mũi tên lên cạnh mũi tên xuống) trong `public/icons/hero/` là SVG có nền trong suốt. `HeroGlyph` hiển thị bằng CSS mask và `currentColor`, nên có thể đổi màu bằng CSS mà không tạo thêm bản ảnh. PNG nguồn không còn trong `resources/` (ADR-030); bản PNG vai trò nằm trong `apps/admin-aov/public/images/hero/vai-tro/`.
  Sáu icon vai trò dò viền từ icon trong game. Bốn icon đường Caesar, Rừng, Giữa, Rồng vẽ lại bằng đường thẳng và hình
  tròn theo huy hiệu trên sóng giải đấu: bản đồ cắt thành các khối riêng (chữ L trên, dải chéo giữa, chữ L dưới) cách
  nhau một khe; khối được chọn tô đặc, các khối còn lại chỉ vẽ viền mảnh. Ở Caesar và Rồng, hai chữ L gặp nhau ở đường
  chéo và ô vuông giữa trống, có chấm tròn (Caesar thêm một chấm nhỏ bị che một phần phía sau); ở Giữa, dải chéo chạy từ
  góc tới góc và hai chữ L lùi lại nhường chỗ. Rừng là hai tam giác trong khung mảnh. Đường Hỗ trợ dùng chung hình đôi
  cánh của vai trò Trợ thủ. Nét mảnh dày 2,4/48.

## Trạng thái chờ của thư viện

- Trong lúc tải mã trang hoặc dữ liệu, header, đầu trang, thanh công cụ và khung nội dung vẫn có bố cục tương ứng. Skeleton danh sách dùng cùng khung ảnh, thân thẻ và lưới responsive với thẻ thật; trang chi tiết giữ vùng ảnh lớn, ảnh đại diện và dòng tên trước khi dữ liệu sẵn sàng.
- `WikiImage` dùng chung cho ảnh thẻ, bảng đổi tướng, ảnh đại diện và ảnh lớn. Kích thước được giữ bởi khung trước khi ảnh tải; chỉ hiện ảnh sau khi tải và giải mã xong, chuyển nhẹ trong 180ms. Các ảnh thẻ vẫn tải lười theo vùng nhìn thấy, không chờ toàn bộ danh sách mới hiện nội dung.
- Ảnh Media lưu bản gốc (thẻ tướng khoảng 200KB). Khi build có `VITE_IMAGE_RESIZE=cloudflare`, `lib/sized-image.ts`
  xin ảnh qua Cloudflare Image Transformations đúng cỡ khung vẽ: `WikiImage` nhận `frameWidth` (hoặc lấy `width`), tạo
  `srcset` 1x/2x với các bề rộng cố định 64…2048 để số bản biến đổi ít; bản thu nhỏ lỗi thì tự quay về ảnh gốc một lần.
  Ảnh nền mờ dùng 384–512px, ảnh đầu trang chủ 1536px, ảnh tải trước trong khung xem trang phục cùng cỡ với ảnh sẽ vẽ.
  Để trống biến thì mọi ảnh giữ địa chỉ gốc.
- Ảnh đã cache vẫn được nhận diện khi gắn vào trang. Đổi nguồn ảnh tạo trạng thái chờ riêng; kết quả tải/giải mã cũ không làm hiện nhầm ảnh mới. Lỗi chân dung thử ảnh head, lỗi ảnh lớn thử portrait; hết nguồn thì dùng chỗ giữ chỗ hoặc thông báo thiếu ảnh, không hiện biểu tượng ảnh hỏng của trình duyệt.
- Dữ liệu đã có trong cache vẫn hiển thị nếu lần cập nhật nền bị lỗi. Hiệu ứng chờ và chuyển ảnh tắt khi thiết bị bật giảm chuyển động.

## Thư viện Trang phục

- `/skins` mở bằng `CatalogHeading` "Trang phục": dòng mờ là số trang phục đang hiện, ví dụ "1.101 trang phục của 123
  tướng", đổi theo bộ lọc; phiên bản dữ liệu nằm bên phải tiêu đề (trên compact là một dòng dưới thanh công cụ). Trang
  dùng hết cột trang.
- Dữ liệu lấy từ API public `GET /api/wiki/v1/skins?region=VN&locale=vi-VN&page=0&size=60`; chương trình đọc hết các
  trang (ba trang một lượt) rồi lọc, sắp xếp ở client. API chọn bản tướng đã xuất bản theo gameplay context hiện hành, trả
  trang phục, tên tướng, ảnh và nhãn bậc đã bản địa hóa. Không gọi API admin hay tải detail riêng của từng tướng để dựng
  danh sách.
- Ảnh gốc của tướng được lưu dưới trang phục “Mặc định” không xuất hiện trong danh mục này. Backend loại trước khi tính số kết quả, bộ lọc và phân trang; các ảnh đó vẫn dùng trong trang Tướng.
- Wide: tìm, tướng, bậc và sắp xếp nằm trên một thanh công cụ dính dưới header, chỉ có nền khi nội dung cuộn dưới nó; ô
  tìm co lại trước và lựa chọn dài được rút gọn, nên không có gì xuống dòng. Bộ lọc đang chọn hiện ảnh và tên với viền
  nhấn, kèm nút × để bỏ; từ hai điều kiện trở lên có thêm "Xóa lọc". Danh sách bậc xếp SSS+ xuống A trước, rồi các nhãn
  khác theo tên (`orderTierOptions` trong `skin-groups.ts`).
- Compact: ô tìm và nút Lọc dính dưới header; tướng, bậc và hai nhóm sắp xếp nằm trong `PublicFilterSheet`. Bộ lọc đang
  chọn hiện thành chip bỏ được dưới thanh công cụ, kèm số kết quả.
- Mỗi tướng là một hàng thẻ. Trên wide hàng chỉ gồm thẻ trọn vẹn (8, 7 hoặc 6 thẻ theo độ rộng, `skin-columns.ts`), cuối
  hàng là ô "+N trang phục khác" mở hết hàng tại chỗ; "Thu gọn" ở tiêu đề hàng gấp lại. Trên compact mỗi hàng vuốt ngang,
  kích thước chọn sao cho thẻ cuối bị mép màn hình cắt (khoảng 2,5 thẻ trên điện thoại) để báo còn nữa. Khi chỉ có một
  tướng (lọc theo tướng, hoặc kết quả thuộc một tướng) trang thành một lưới kèm liên kết "Xem tướng"; tìm kiếm hoặc lọc
  bậc ra nhiều tướng thì thành một lưới chung, tên tướng ghi trên từng thẻ.
- Hàng hiện dần khi cuộn: mỗi lượt 8 tướng, hoặc 6 hàng thẻ khi là lưới chung (`useRevealedCount` và `InfiniteScroll`).
  Không có nút phân trang.
- Thẻ: nền thẻ, bo 10px, không viền và bóng; nhãn bậc thật ở góc trên trái, tên trang phục trên lớp tối ở chân ảnh. Ảnh
  đang tải là một ô yên tĩnh có tên; trang phục không có ảnh hiện mặt tướng mờ (hoặc chữ cái đầu); thiếu portrait thì
  hiện một phần ảnh ngang thay vì phóng to ảnh head. Trang phục không có nhãn hoặc thiếu icon không được tự gán bậc minh
  họa. Skeleton dùng cùng lưới hoặc hàng, thanh công cụ và đầu trang như trang đã tải.
- Tìm tên trang phục/tướng, lọc tướng và bậc, cách sắp xếp lưu trong query `q`, `hero`, `rarity`, `heroSort` (`most`,
  `fewest`, `name`) và `skinSort` (`tier`, `name`). TanStack Query giữ cache mới 60 giây và hủy request không còn dùng.
- Chọn thẻ mở trình xem bằng Dialog (drawer dưới trên điện thoại), không điều hướng sang trang mới chỉ để xem ảnh. Khung
  ảnh theo tỉ lệ 13:8 của ảnh splash trong game và giữ nguyên khi đổi ảnh; bên dưới là dải ảnh của cùng danh sách, rồi
  tên, các thông tin (tướng có liên kết, bậc, cách nhận kèm giá) và nguồn ảnh có nút xem chi tiết. Từ 1100px phần ảnh và
  phần chữ chia hai cột.
- Trong trình xem có thể xem liên tiếp mà không cần đóng: nút trước/sau, phím ← →, vuốt ngang và dải ảnh. Thứ tự đi trong
  các trang phục của cùng tướng; trong lưới chung nhiều tướng thì đi theo danh sách kết quả. Ảnh kế tiếp được tải trước
  để chuyển không bị nháy. Đóng bằng nút đóng hoặc Escape, focus về thẻ của trang phục xem sau cùng, không phải thẻ đã
  mở lúc đầu; hàng đang gấp tự mở nếu trang phục đó bị ẩn.

## Kho trang bị

- `/warehouse/items|enchantments|arcana|spells` dùng chung bố cục thư viện. Thanh đầu trang có menu Kho trang bị gồm bốn
  phần; trang chủ có ô riêng cho từng phần. Tab và mục đang xem nằm trong đường dẫn (`/warehouse/<tab>/<code>`) để mỗi
  mục có trang và xem trước riêng; bộ lọc nhóm (`group`) và tìm kiếm (`q`) lưu trong query. Tất cả đều chia sẻ hoặc mở
  lại được; liên kết cũ dạng `?tab=&item=` tự chuyển sang địa chỉ mới. Mỗi phần có ô tìm riêng, tìm không dấu cả theo
  tên, tóm tắt và mô tả nên gõ tên hiệu ứng cũng ra; tìm kiếm chung trên header dẫn tới `/warehouse/items?q=...`.
- Trên wide, `CatalogHeading` ghi tên phần đang xem với phiên bản dữ liệu bên phải; bên dưới là một hàng tìm kiếm và bộ
  lọc. Trên compact, đầu trang ghi Kho trang bị và bốn phần Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ là dãy tab dính bên
  dưới; bộ lọc nằm trong nút Lọc, phiên bản dữ liệu là một dòng dưới thanh công cụ.
- Chỉ đọc dữ liệu công khai từ bốn API `/items`, `/enchantments`, `/arcana`, `/spells`; phụ trợ cũ đọc thêm `/spells/archived`. Không gọi API admin, không đưa bản nháp vào danh mục. Mục chưa xuất bản có trạng thái trống rõ ràng.
- Trang bị/phụ trợ chưa biết patch gốc có thể được xuất bản như dữ liệu nền chưa rõ patch khi nội dung đã đủ. Chi tiết hiển thị rõ trạng thái này, không ghi nhận thành thay đổi mới của mùa hiện tại. Bản cập nhật gắn patch thật được ưu tiên hơn dữ liệu nền; mục còn thiếu nội dung vẫn giữ nháp.
- TanStack Query giữ cache danh mục 60 giây, metadata nhóm 5 phút, hủy request khi không còn dùng. Danh mục hiện nhỏ nên tải tiếp các trang 100 mục rồi lọc không dấu ở client. Dữ liệu đã tải vẫn giữ nếu cập nhật nền lỗi; có nút thử lại. Metadata ảnh có ngay trong map `media` của từng mục; ảnh byte tiếp tục tải lười qua URL phiên bản CDN.
- Trang bị có hai kiểu xem, đổi bằng nút Sơ đồ / Danh sách trên thanh công cụ và lưu ở `layout`. Sơ đồ (`layout=shop`,
  mặc định khi đủ rộng) giữ bố cục cửa hàng trong game; Danh sách (`layout=list`, mặc định dưới 768px vì sơ đồ cần ba
  cột) xếp theo cấp, có thể sắp theo giá hoặc tên (`sort`). Danh sách hiện 36 hàng mỗi lượt và tải thêm khi cuộn; món
  đang mở luôn nằm trong phần đã hiện.
- Trong Sơ đồ, vị trí cột/hàng lấy từ dữ liệu shop, độc lập cấp trang bị; không tự đưa món cấp III sang cột III. Các vùng món hoàn chỉnh và nguyên liệu thuộc nhóm khác giữ đúng cột, có tên nhóm nguồn. Bấm một món là đọc được ngay, không cần thêm bước mở: đường ghép hiện trên sơ đồ (nguyên liệu trực tiếp nét liền, quan hệ gián tiếp và món có thể tạo thành nét đứt, có mũi tên) đồng thời chi tiết hiện ra. Bấm lại món đó, vùng trống hoặc Escape hủy chọn. Đây là giao diện chỉ đọc, không có chốt nối hoặc kéo sửa công thức như admin.
- Thẻ món hiện chỉ số thật bằng icon và số. Dữ liệu trang bị đang để chỉ số ở dạng chữ trong mô tả (`+60 Công vật lý`, `Hơi thở rồng: ...`), nên `packages/ui/src/lib/item-description.ts` tách mô tả thành chỉ số, nội tại và lời dẫn khi hiển thị, không đổi dữ liệu đã lưu. Chỉ số có cấu trúc (`content.stats`) được ưu tiên nếu có; dòng không nhận dạng được vẫn hiện nguyên văn thành hiệu ứng. Từ ADR-033, món có dữ liệu có cấu trúc chia hai phần: "Chỉ số" là các dòng "+N" của mô tả (`content.stats`), "Từ hiệu ứng" là chỉ số mà hiệu ứng cho thêm (`content.effects[].grants`), ghi tên hiệu ứng, cách tăng, trần, thời gian. Hiệu ứng thứ n ghép với hiệu ứng thứ n của mô tả; bản dịch viết số hiệu ứng khác thì ghép theo mã tên, không khớp thì vẫn liệt kê chỉ số nhưng không ghi tên hiệu ứng. Bộ lọc chỉ số tính cả hai phần; thẻ món hiện thêm chỉ số hiệu ứng chỉ khi đó là một số cố định (như "+60 Tốc chạy" của giày).
- Chip chỉ số lọc theo thứ người đọc cần mua (`stats`, ví dụ `stats=physical,crit`): chọn nhiều chip nghĩa là món phải
  có đủ các chỉ số đó, mỗi chip có số món sẽ còn lại và chip không còn kết quả được ẩn. Trên wide chip nằm thành một hàng
  riêng dưới thanh công cụ, trên compact nằm trong nút Lọc. Sơ đồ làm mờ món không khớp nhưng giữ bố cục, Danh sách ẩn
  hẳn.
- Phù hiệu có màu/icon từng hệ, đường nối liên tục từ biểu tượng hệ qua I–III. Bảng ngọc tìm và lọc như Trang bị: ô tìm
  kiếm tìm cả tên chỉ số (cả tiếng Việt lẫn tiếng Anh) và ghi số ngọc còn lại; nút "Chỉ số" (trên compact nằm trong nút
  Lọc) dùng chung các nhóm chỉ số của Trang bị (`stats=`), chọn được nhiều nhóm, mỗi nhóm có số ngọc sẽ còn lại, và các
  nhóm đã chọn hiện thành chip dưới thanh công cụ; dưới nữa là các chip màu. Không có bộ lọc bậc. Mỗi bậc chia cột theo
  màu (hoặc theo nhóm chỉ số khi đã chọn một màu). Mỗi hàng ngọc là các chỉ số của nó, mỗi chỉ số một dòng, tên chỉ số
  lấy từ danh sách chỉ số chung, con số canh phải; tên ngọc chỉ hiện ở chi tiết. Đầu bậc cao nhất có nút "1 viên / 10
  viên" (10 viên là lắp kín một màu). Như sơ đồ Trang bị, tìm kiếm và lọc chỉ số không ẩn ngọc mà làm mờ những viên không
  khớp (độ đậm 35%, rê chuột vào thì rõ lại), nên các cột giữ nguyên chỗ; chỉ bộ lọc màu mới bỏ ngọc khỏi trang. Chỉ số
  thuộc những nhóm đã chọn sáng hơn. Khi tìm, phần bậc thấp vẫn thu gọn và dòng của nó ghi số viên khớp. Bậc cao nhất
  mở sẵn; các bậc dưới gộp thành một dòng "Ngọc bậc I và II" thu gọn, mở ra có một câu giải thích. Cột hẹp (cạnh khung
  chi tiết) bỏ hình ngọc để giữ chỗ cho chỉ số. Phần trưng bày đầu trang Bảng ngọc vẽ một bảng ngọc như vòng tròn trong
  game: viền vàng kép có vạch chia quay chậm, mỗi màu một phần ba (Đỏ trên, Tím dưới phải, Xanh dưới trái; 6 ô vòng
  ngoài rồi 4 ô vòng trong), ba nan chia có hạt kim cương ở đầu, quầng sáng mỗi phần ba lấy từ ảnh viên ngọc, và lõi
  giữa ghi cấp của bảng (tổng bậc các viên, 90 khi đủ 30 viên bậc III). Ở danh sách nó lần lượt đổi giữa ba bộ mẫu (Công
  vật lý, Phép, Trung tính) kèm hai chỉ số lớn nhất; ở Lắp ngọc có bảng đang lắp thì vẽ đúng bảng đó.
- Phụ trợ dùng ảnh tròn, xếp lớp ảnh khi có nhiều trạng thái; mục cũ thu gọn. Hồi chiêu ghi theo giây như game; từ 60
  giây trở lên có thêm số phút gần bằng ("90 giây ≈ 1.5 phút"), ở thẻ, khung chi tiết và phần trưng bày. Phép tích trữ
  (như Trừng trị) ghi hồi chiêu là "giữa hai lần dùng" và có một hạt vàng cho mỗi lần tích trữ, kèm "Tích trữ N lần ·
  mỗi lần hồi N giây"; khung chi tiết tách thành "Giữa hai lần dùng", "Tích trữ" (có các hạt) và "Mỗi lần tích hồi sau",
  chú thích phần trưng bày ghi thêm "Tích trữ N lần". Mô tả hiện đầy đủ (không cắt dòng).
  Cấp mở khóa vẫn nằm trong dữ liệu nhưng không hiện ở trang công khai (thẻ, khung chi tiết, phần trưng bày). Phần trưng
  bày đầu trang là "đồng hồ hồi chiêu": một phép lớn ở giữa có lớp tối quét theo chiều kim đồng hồ như khi phép đang hồi
  trong trận rồi sáng lên khi sẵn sàng, các phép khác nằm trên một vòng quay chậm quanh nó; phép ở giữa đổi sau vài giây,
  chú thích ghi tên và hồi chiêu. Bốn phần của kho đều có phần trưng bày riêng.
- Bảng ngọc có nút chuyển "Danh sách / Lắp ngọc" (`view=page`). Lắp ngọc giống màn bảng ngọc trong game: ba hàng
  Đỏ, Tím, Xanh, mỗi hàng 10 ô, chỉ dùng ngọc bậc cao nhất. Bảng ô là một "sân khấu" tối có ánh vàng ở góc; mỗi hàng
  được thắp bằng chính ảnh viên ngọc của màu đó (phóng to, làm nhòe thành quầng sáng bên trái, mờ và nghiêng ở mép
  phải), nên màu lấy từ ảnh của game chứ không thêm màu mới; hàng đang chọn sáng hơn. Bấm một viên trong danh sách bên dưới để lắp vào ô trống của
  màu đang chọn; mỗi viên có nút bớt, thêm và "Lắp kín" (lắp vào mọi ô còn trống). Mỗi hàng gom các viên giống nhau
  thành một nhóm rộng theo số viên, ghi hình, tên (ghép từ tên chỉ số chung) và "×số", vạch ngắn ở mép dưới chia từng
  ô; nhóm hẹp bỏ tên trước rồi bỏ hình, số "×N" thì luôn còn. Rê chuột vào nhóm hiện tooltip có tên, số viên và chỉ số
  các viên đó cộng vào bảng (tooltip không mở khi chạm, kể cả khi DevTools giả lập điện thoại). Trên màn hẹp mỗi nhóm
  một dòng để luôn đọc được tên. Bấm một nhóm thì danh sách chuyển sang màu đó, cuộn tới viên đó và làm nó sáng lên một
  lúc để chỉnh số viên. Bấm phần "còn N ô" thì chọn màu đó. Màu vừa đủ 10 viên thì danh sách tự chuyển sang màu còn
  chỗ. Khung "Tổng chỉ số" cộng chỉ số của cả bảng theo thứ tự chỉ số chung và liệt kê các viên đã lắp theo thứ tự Đỏ,
  Tím, Xanh, bấm một viên ở đó cũng mở nó trong danh sách; trên wide khung này đứng bên phải và dính khi cuộn, trên màn
  hẹp nằm ngay dưới bảng ô. Bảng ngọc nằm trong địa chỉ (`slots=mã*số,...`), nên nút Sao chép chia sẻ được đúng bảng
  đó, nút Dán mở bảng từ một liên kết (hoặc phần `slots`) đã chép; liên kết bị sửa tay không làm một màu quá 10 viên
  và bỏ mã không có.
- Trên wide, danh mục rộng hết cột trang cho tới khi mở một mục; khi đó chi tiết đứng thành cột bên phải (320–380px) cho
  cả bốn phần, để đọc món này sang món khác không phải mở rồi đóng. Trên compact, chọn mục mở tấm chi tiết từ bên phải,
  hoặc từ dưới lên khi màn hình từ 640px trở xuống, không rời danh mục. Chi tiết có nút và phím ← → sang mục trước/sau
  theo đúng thứ tự đang hiển thị; chuyển mục không tạo thêm lịch sử trình duyệt.
- Chi tiết là một luồng đọc liền, không chia tab. Đầu trang có nhóm, cấp và giá; trang bị có tóm tắt, chỉ số, hiệu ứng (đánh dấu nội tại duy nhất), cây ghép nhiều tầng kèm tổng giá nguyên liệu và phí ghép, món nâng cấp thành và món cùng kiểu. Phù hiệu có thêm các lựa chọn cùng cấp trong hệ; phụ trợ nhiều trạng thái cho chọn từng trạng thái. Mô tả dùng parser `EntityRichText` dùng chung, không chèn HTML thô. Danh mục tham chiếu chỉ tải khi mở chi tiết và dùng API công khai; liên kết tham chiếu vào đúng tab của kho.
- Món cùng kiểu là gợi ý tự tính, không phải do biên tập chọn. Chỉ xét món cùng cấp, bỏ qua nguyên liệu và món nâng cấp vì đã có mục riêng. Điểm cao nhất là chung tên nội tại (trong game cùng tên là cùng cơ chế) hoặc cùng dòng công dụng, sau đó là nội tại có cùng hiệu ứng dù khác tên (giảm hồi máu, lá chắn, làm chậm, sát thương theo % máu…), rồi cùng nhóm shop và từng chỉ số chung. Nội tại xuất hiện ở quá nhiều món không được tính là dấu hiệu riêng. Món khác loại sát thương (vật lý và phép) hoặc món vai trò (phụ trợ, đi rừng) so với món thường bị trừ điểm, nên chỉ hiện khi có lý do mạnh. Mỗi món ghi rõ điểm chung để người đọc tự đánh giá.
- Phần lớn mục kho chưa từng có ghi chú thay đổi, nên khối Thay đổi theo phiên bản chỉ hiện khi có nội dung. Trạng thái dữ liệu nền chưa rõ patch là một dòng nhỏ ở cuối chi tiết.
- Admin dùng chung phần đọc này (chỉ số, hiệu ứng, cây ghép) trong trình sửa, kèm bút sửa từng phần. Sơ đồ admin có cùng chip lọc chỉ số, nút Mở chi tiết khi đang chọn một món và nhấp đúp để mở. Món chưa có chỉ số có cấu trúc được đánh dấu là đang đọc từ mô tả; phần sửa chỉ số có nút điền các chỉ số đọc được và gợi ý sẵn mã chỉ số. Phần "Hiệu ứng và chỉ số từ hiệu ứng" đặt mỗi hiệu ứng cạnh dòng mô tả của nó, có nút điền từ mô tả và cảnh báo khi số hiệu ứng lệch với mô tả.
- Kích thước ảnh, dòng tên và skeleton giữ chỗ trong lúc tải; skeleton đo theo thẻ thật của từng phần và hiện đúng kiểu
  xem sắp tới. Hàng chip cuộn ngang nếu thiếu chỗ. Hiệu ứng tắt khi người dùng bật giảm chuyển động.

## Ghi chú cập nhật

- `/updates` mở bằng `CatalogHeading` "Ghi chú cập nhật" và liệt kê các bản cập nhật đã công bố theo mùa, mới nhất lên
  trước. Mỗi bản là một hàng: ngày, tên, nhãn Đang áp dụng, số thay đổi theo loại và ảnh các tướng thay đổi (thêm "+N"
  khi nhiều). Hàng hiện dần khi cuộn.
- `/updates/:code` hiển thị thay đổi của một bản, chia theo Tướng, Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ và chỉ giữ nhóm
  có dữ liệu. Nguồn lấy từ `GET /patches` và `GET /patches/{id}/changes?domain=&patchVariantId=`. Trên wide đầu trang có
  đường quay lại Ghi chú cập nhật, ngày và nguồn công bố; mục lục các tướng và mục thay đổi dính bên phải, tô sáng mục
  đang đọc. Trên compact đầu trang có "Tất cả bản cập nhật" và tên bản (`h1`), mục lục thành một hàng cuộn ngang có ảnh
  tướng. Nhảy tới một mục ghi vị trí đó vào địa chỉ để chia sẻ được.
- Mọi nhãn loại thay đổi (Tăng sức mạnh, Giảm sức mạnh, Làm lại, Sửa lỗi…) đi kèm hình vẽ riêng, trên Wiki và Admin.
- Thay đổi của tướng dùng chung `ChangeList` (`src/components/change-list.tsx`) cho trang này và trang tướng. Mỗi
  tướng có đánh giá tổng thể (hoặc nhãn suy ra khi chưa đánh giá), số thay đổi và tóm tắt; các thay đổi gom theo từng kỹ
  năng, có ảnh và tên kỹ năng khi tướng đã có hồ sơ công khai. Loại thay đổi đã ghi cho cả tướng không lặp lại ở từng
  dòng. Giá trị ngắn hiện thành "cũ → mới" trên một dòng, giá trị dài xếp hai dòng Trước/Sau. Giá trị đổi theo cấp chiêu
  đọc trước thành một dòng; nút "Theo cấp" mở bảng Trước/Sau cho từng cấp, ô đã đổi được đánh dấu. Phần tính giá trị
  theo cấp nằm ở `packages/ui/src/lib/skill-rank-values.ts`, Admin và Wiki cùng dùng.
- Chi tiết thay đổi hiện sẵn bên dưới phần tóm tắt. Bộ thay đổi dài được cắt ở khoảng một kỹ năng, mờ dần ở cuối và có
  nút "Xem tất cả N thay đổi" để mở hết; bộ ngắn hiện đủ, không có nút. Trang ghi chú cập nhật có thêm "Mở rộng tất cả" /
  "Thu gọn tất cả". Mỗi kỹ năng có nút "Xem kỹ năng đầy đủ" ("Xem kỹ năng" trên compact). Trên trang tướng, nút này chọn
  đúng kỹ năng và cuộn tới Bộ kỹ năng; sau đó một nút nổi ở góc dưới (cạnh nút mục lục, dưới 1180px) đưa người đọc quay
  lại phần thay đổi.
- Mỗi thay đổi kỹ năng ghi rõ chiêu, thuộc tính, giá trị cũ và mới. Công thức được đọc thành chữ, ví dụ `21*(rank-1)`
  thành "21 mỗi cấp" và `0.2*physicalAttack` thành "20% Công vật lý"; công thức chưa nhận dạng được giữ nguyên như nguồn.
  Công thức dài chỉ xuống dòng trước một phép tính, không cắt giữa một thành phần.
- Trang chủ, hàng thay đổi phía trên các danh mục và khối Thay đổi theo phiên bản trong chi tiết mục kho đều dẫn tới trang này. Tướng đã có ghi chú nhưng chưa có hồ sơ công khai vẫn được liệt kê, không có liên kết.

## Thuật ngữ

- `/terms` mở bằng `CatalogHeading` "Thuật ngữ" với một dòng giải thích, rồi ô tìm và số kết quả. Danh sách lấy thuật
  ngữ công khai từ `GET /reference-catalog`, sắp theo tên, tìm không dấu theo tên, tên khác và nội dung (`q`). Các mục
  xếp lưới 1, 2 hoặc 3 cột theo độ rộng, mục dài trải hết một hàng ở cuối. Mô tả có thể liên kết sang thuật ngữ khác.
- Mọi nhắc tới thuật ngữ trong wiki có đích `/terms/{id}`, trang cuộn tới và đánh dấu mục đó. Liên kết cũ dạng `/?term={id}` tự chuyển sang đây; mã không tồn tại báo rõ và vẫn hiện danh sách.

## Chế độ chơi

- Dữ liệu lấy từ `/api/wiki/v1/game-modes`; đội hình riêng của người đọc đã đăng nhập lấy từ
  `/api/wiki/v1/users/me/game-modes`. Thứ tự từng phần trên hai bố cục nằm ở `frontend/docs/RESPONSIVE.md`.
- `/modes` mở bằng `CatalogHeading` "Chế độ chơi", dòng mờ ghi số chế độ và nói rõ lịch mở là lịch ghi nhận từ sảnh game.
  Ô tìm (`q`) và chip lọc (`loc`: Đang mở, PVP, Giải trí, Có cẩm nang) nằm trên một hàng; chip đang chọn được cuộn vào tầm
  nhìn. Cẩm nang nổi bật đứng đầu, rồi các nhóm PVP và Chế độ giải trí, mỗi nhóm có tiêu đề vàng và số chế độ. Wide là lưới
  thẻ có ảnh, số cột chọn để hàng cuối không còn một thẻ lẻ; compact là danh sách hàng gồm ảnh nhỏ, tên, thời lượng và
  tình trạng.
- `/modes/:code` mở bằng tên chế độ và đường quay lại. Chế độ có cẩm nang có hàng tab dính dưới header (`/modes/:code/:tab`,
  cuộn ngang trên compact, tab đang mở được cuộn vào tầm nhìn). Tổng quan gồm ảnh, giới thiệu, thông tin nhanh, một câu
  nêu những gì Wiki chưa ghi nhận về chế độ, nguồn, luật chơi (gấp theo nhóm trên compact) và tướng, vật phẩm riêng khi
  có. Chế độ ít dữ liệu có thêm bốn chế độ khác cùng nhóm để đi tiếp. Mọi tab dùng địa chỉ của chế độ làm canonical; chỉ
  trang chế độ được prerender.
- Cẩm nang Cờ Liên quân có các tab Tổng quan, Quân cờ, Phe & Nghề, Trang bị, Chúc phúc, Nhiệm vụ, Đội hình, Xếp đội hình,
  Phân tích (`auto-chess-guide.tsx`, mỗi tab một file `guide-*.tsx`). Trong lúc cẩm nang tải, tab giữ khung gồm tiêu đề,
  hàng điều khiển và lưới mục.

## Liên hệ, tài khoản và trang không tìm thấy

- `/contact` (`src/features/contact`) và `/account` (`src/features/account`) mở bằng `CatalogHeading` có bật `compact`,
  vì header không ghi tên hai trang này. Biểu mẫu dùng ô nhập và nút chung trong `src/styles/controls.css`.
- Địa chỉ không có trên Wiki mở trang không tìm thấy (`src/features/not-found`): linh vật, một câu giải thích, ô tìm lớn và
  chín ô mục của trang chủ.

## Video

Dữ liệu từ `GET /videos`, xem ADR-019. Chỉ hiện khối khi mục có video, nên mục chưa có video không đổi giao diện.

- Chi tiết Tướng: nút `Video · N` cạnh vai trò ở đầu trang đưa xuống khối `Video` trước lịch sử thay đổi, gồm cả video
  cốt truyện, có bộ lọc theo loại khi có từ hai loại trở lên. Thứ tự theo loại rồi theo thứ tự đặt trong admin. Khi chỉ
  một phần video là cốt truyện, Tổng quan có nút `Video cốt truyện` mở thẳng video đầu tiên của cốt truyện. `Video kỹ
năng` nằm trong kỹ năng đang chọn (xem Chi tiết Tướng).
- Trang phục: danh sách video nằm trong cột thông tin của trình xem. Bấm phát thì video thay ảnh ở khu vực ảnh; chuyển
  sang trang phục khác thì quay về ảnh.
- Kho trang bị: khối `Video` ở chi tiết mục, trước phần thay đổi.
- Trên wide video là thẻ theo lưới, số cột chọn để hàng cuối không còn một thẻ lẻ; trên compact là hàng dọc, ảnh bên
  trái, hiện 3 mục đầu.
- Bấm một thẻ mở trình xem lớn phủ lên trang: player, thông tin, nút Trước/Tiếp, phím ← → và danh sách phát gồm các video
  đang lọc. Trang bên dưới không xê dịch. Trên điện thoại là drawer với player giữ ở trên cùng. Khi YouTube hoặc tệp video
  phát hết thì tự sang video kế, tắt được ở danh sách phát và được nhớ trên trình duyệt. Trình xem trang phục vẫn phát ở
  khu vực ảnh và sang video kế tương tự.
- Video đang mở nằm trong địa chỉ dạng `?video=<id>`, nên chia sẻ được liên kết và nút Back đóng trình xem.
- Thẻ video chỉ tải ảnh xem trước; player được tạo khi bấm phát. Phát được YouTube,
  Facebook, TikTok, Twitch và tệp video (xem `@aov/ui/lib/video-playback`). Video dọc như TikTok, reel hiển thị theo
  khung dọc. Liên kết không nhúng được mở ở tab mới. Nhiều hơn số dòng mặc định thì có nút `Xem thêm` mở ngay bên dưới.
- Video gắn bản áp dụng hiện chip `Từ bản X` và bị ẩn khi đang xem phiên bản cũ hơn.

## Thị trường, ngôn ngữ và mốc dữ liệu

- `WikiContextProvider` dùng chung cho mọi trang. Thị trường dữ liệu (`region`) độc lập ngôn ngữ giao diện (`locale`);
  lựa chọn lưu trong URL và ghi nhớ trên thiết bị. Trên thanh rộng, thị trường có nút riêng (cờ và mã thị trường), ngôn
  ngữ nằm trong popup tài khoản; trên compact cả hai nằm trong menu "⋯". Các thị trường chưa hỗ trợ vẫn hiện nhưng khóa
  theo trạng thái backend, không tự đổi sang VN hoặc coi Global là dữ liệu tổng hợp.
- UI hỗ trợ `vi-VN` và `en-US`; dữ liệu game chưa có bản dịch dùng nội dung ngôn ngữ gốc. `GET /catalog-context` trả các thị trường, ngôn ngữ, mùa và patch công khai có thể xem, đánh dấu mùa/patch hiện tại. Ngày không có trong lịch thị trường hiện “Chưa rõ ngày”, không suy diễn ngày/giờ từ mã patch.
- Danh mục Tướng, Trang phục và bốn nhóm kho nhận `season` và `patch` trên URL; adapter chuyển thành `seasonId` và `patchVariantId` khi gọi API. Chọn riêng mùa sẽ lấy dữ liệu tại patch công khai cuối cùng đã đủ điều kiện của mùa, không ép chọn patch. Bỏ cả hai trở về dữ liệu đang hiệu lực. Hiện chỉ duyệt trong ruleset hiện hành của thị trường; không cho chọn patch tương lai hoặc patch không thuộc mùa/ruleset đó.
- Khi xem lịch sử, dữ liệu nền chưa xác định patch không tự xuất hiện. Khi một phần của kho không có mục nào ở mốc đang
  xem, trạng thái trống có nút "Xem thêm dữ liệu chưa rõ patch" để bật kèm dữ liệu nền chưa rõ mốc (`unscoped=1`), luôn
  giải thích đây là dữ liệu tham khảo chưa xác nhận tồn tại ở mốc đang xem. Các mục đó có nhãn "Chưa rõ mốc" và không tạo
  sự kiện lịch sử giả.
- Cache TanStack Query tách theo thị trường, locale, mùa, patch và tùy chọn dữ liệu chưa rõ mốc; API tham chiếu cũng nhận cùng phạm vi. Điều hướng giữa các danh mục và mở liên kết tham chiếu giữ phạm vi hiện tại. Trang chủ vẫn hiển thị cập nhật mùa đang hiệu lực, không biến thành bảng tin lịch sử khi duyệt một mùa cũ.
- Phiên bản dữ liệu (`WikiVersionPicker` trong `src/components/wiki-version-picker.tsx`) là một dòng "Dữ liệu bản
  <ngày>" kèm nhãn Đang áp dụng; bản chưa có ngày thì ghi tên bản, xem cả mùa thì ghi tên mùa. Dòng này nằm bên phải tiêu
  đề trên wide và dưới ô tìm trên compact (thư viện Tướng, Trang phục, Kho trang bị), dưới màn đầu trên trang tướng. Khi
  có bản khác thay đổi trang đang xem, giá trị mở menu chỉ liệt kê các bản đó theo mùa, mới nhất trước, cùng lựa chọn
  "Cả mùa …"; không có thì chỉ là chữ. Với chuột, menu mở ngay khi rê lên giá trị (sau khoảng 0,1 giây) và đóng khi
  chuột rời cả giá trị lẫn menu; cảm ứng và bàn phím mở bằng cách bấm. Đang xem bản cũ thì có nút "Về bản hiện tại".
  Dạng viên kính mờ (`appearance="pill"`, dùng ở thư viện Tướng) gom nhãn, ngày và mũi tên vào một viên nền mờ trên
  ảnh; bản đang áp dụng chỉ hiện chấm xanh thở nhẹ, chữ "Đang áp dụng" để lại cho trình đọc màn hình và khi rê chuột;
  đang xem bản cũ thì viên chuyển viền vàng như một bộ lọc đang bật.

## Chi tiết Tướng

- `/hero/:heroCode` (và `/hero/:heroCode/:formKey` cho từng dạng của tướng, ADR-024) dùng `HeroDetailLayout`: header
  biến thể `hero` nằm trên ảnh tướng, trong suốt ở đầu trang. Thứ tự các phần trên hai bố cục nằm ở
  `frontend/docs/RESPONSIVE.md`.
- Mã tướng trên URL được đối chiếu với danh sách đã xuất bản; chi tiết đọc từ `GET /api/wiki/v1/heroes/{id}?region=VN&locale=vi-VN`. URL ảnh dùng phiên bản Media mà backend trả về.
- Màn đầu trên wide: ảnh tướng phủ khoảng hai phần ba bên phải, mờ dần vào nền ở mép trái và mép dưới; bên trái đặt thẳng
  trên nền là liên kết "Thư viện Tướng" quay về danh sách (giữ bộ lọc), ảnh nhỏ và tên tướng, nút đổi tướng nhanh, nút
  chuyển dạng khi tướng có nhiều dạng, danh hiệu, vai trò, vị trí, giá và nút Video; dưới đó là Tổng quan. Ảnh dọc
  `PORTRAIT` đứng ở mép phải cột trang thay vì bị kéo giãn. Trên compact ảnh nằm trên cùng dưới header trong suốt, tên và
  các chip ở chân ảnh, nút nguồn ảnh lên góc trên.
- Hiển thị ảnh nền `SPLASH` độ phân giải cao; chỉ dùng `PORTRAIT` dự phòng nếu thiếu hoặc lỗi ảnh nền. Không có nút chuyển loại ảnh và không phóng `HEAD` thành ảnh lớn. Nếu cả hai ảnh lớn đều không dùng được, giao diện hiển thị trạng thái thiếu ảnh.
- Ảnh nhỏ cạnh tên dùng `HEAD` (56px trên wide, 40px trên compact). Thiếu hoặc lỗi ảnh thì dùng chân dung dự phòng, sau
  đó là chữ cái đầu của tên. Tên dài được xuống dòng, không đẩy nút ra ngoài màn hình.
- Nút tròn cạnh tên mở bảng **Đổi tướng nhanh** từ bên trái, rộng tối đa 760px; trên compact nút giữ vùng chạm 44px.
  Bảng dùng chung cache danh sách tướng: tiêu đề và số tướng, ô tìm tên hoặc mã không phân biệt dấu, hai hàng chip Vị trí
  và Vai trò (mỗi hàng cuộn ngang, kéo được bằng chuột mà không bấm nhầm chip), rồi lưới thẻ tướng giống thư viện, tướng
  đang xem được đánh dấu. Chọn một tướng thì bảng đóng và chuyển trang; chọn lại tướng đang xem chỉ đóng bảng. Ô tìm chỉ
  nhận focus sẵn khi bảng mở bằng chuột hoặc bàn phím, để bàn phím cảm ứng không che danh sách. Đường dẫn bộ lọc của
  danh sách được giữ để quay về.
- `hero-appearance.ts` giữ màu riêng theo ảnh của từng tướng đang xuất bản; hiện chỉ màu điểm nhấn (`--hero-accent`) được
  dùng, cho nút đổi tướng nhanh. Tướng chưa có cấu hình dùng màu trung tính. Đây là lựa chọn biên tập tại frontend,
  không phải màu suy ra từ vai trò hoặc lấy bằng canvas trên trình duyệt: CDN hiện không cung cấp CORS để đọc pixel ảnh.
- Khi thay ảnh gốc cần rà soát và cập nhật bảng màu tương ứng; về sau có thể chuyển các màu này thành metadata do backend cung cấp để đi cùng phiên bản ảnh.
- Tổng quan gồm mẹo chơi, điểm đánh giá lấy từ `overviewRatings` theo thang của dữ liệu, chỉ số và cốt truyện (gấp
  lại). Câu giới thiệu của game là lời khuyên cách chơi, nên hiện dưới nhãn "Mẹo chơi" có icon bóng đèn và vạch vàng bên
  trái. Mỗi điểm đánh giá là một ô nhỏ: tên và icon, điểm (ví dụ 3/5), rồi các vạch của game; Độ khó ghi thêm chữ (Rất
  dễ, Dễ, Trung bình, Khó, Rất khó) vì điểm cao không có nghĩa là tốt hơn. Trên wide bốn ô nằm một hàng và tiêu đề Tổng
  quan chỉ còn cho trình đọc màn hình và mục lục, nút góp ý đứng ở góc phải mẹo chơi. Trên compact Tổng quan là một thẻ
  giữa phần thay đổi và Bộ kỹ năng, bốn ô chia hai hàng, giới thiệu dài được rút gọn.
- Dưới màn đầu là phiên bản dữ liệu. Bản không thay đổi tướng ghi rõ điều đó ngay dưới và dẫn tới lần thay đổi gần nhất.
  Bản có thay đổi có khối "Thay đổi ở bản này" phía trên Bộ kỹ năng: một bề mặt có vạch màu theo loại thay đổi, tóm tắt,
  từng thay đổi theo kỹ năng (`ChangeList`), nguồn công bố và so với bản nào; nút "Xem kỹ năng đầy đủ" mở đúng kỹ năng.
  Trên compact khối này gấp thành một dòng, bấm để mở xuống.
- Phần thay đổi chỉ lấy từ ghi chú đã công bố (`GET /heroes/{id}/changes`). Hai bản nội dung của tướng có thể khác nhau cả
  về câu chữ; việc so sánh đó thuộc Admin, trang công khai không hiện. Bản so sánh là bản liền trước cùng ruleset, không
  phải bản được chọn trong phiên bản dữ liệu.
- Bộ kỹ năng là một hàng thẻ kỹ năng, kỹ năng đang chọn có viền vàng và nền vàng nhạt, chi tiết viết đầy đủ bên dưới. Thẻ
  kỹ năng có dấu khi kỹ năng đó đổi ở bản đang xem; menu phiên bản dữ liệu chỉ liệt kê các bản có thay đổi. Mục Lịch sử
  thay đổi liệt kê những bản còn lại thành hàng, mới nhất trước, phần cũ gấp lại; bấm để chuyển sang bản đó.
- Build đề cử (`hero-builds.tsx`, ADR-026) đọc từ `GET /api/wiki/v1/builds?hero=<mã>&region=<thị trường>` và chỉ hiện khi
  đã có build được ghi nhận cho tướng.
- Mục Trang phục nằm dưới bộ kỹ năng, lấy từ `GET /api/wiki/v1/skins?hero=<mã tướng>` theo đúng mốc dữ liệu đang xem, kèm
  liên kết sang thư viện Trang phục. Ảnh lớn giữ tỉ lệ ảnh trang phục trong game, bên dưới ghi tên, bậc và cách nhận. Khi
  đủ chỗ, các trang phục khác xếp lưới bên cạnh ảnh, số cột chọn để lưới kết thúc cùng ảnh và hàng cuối không còn một ảnh
  lẻ; hẹp hơn thì thành một hàng cuộn ngang dưới ảnh. Đổi ảnh bằng nút trái/phải hoặc chọn trong lưới. Bấm ảnh lớn mở
  trình xem dùng chung với thư viện Trang phục, không có liên kết Xem tướng vì người đọc đang ở chính trang đó. Tướng chưa
  có trang phục thì mục này và dòng tương ứng trong mục lục đều ẩn. Dạng của một tướng hiện trang phục chung của tướng và
  trang phục riêng của dạng đó (ADR-024).
- Mục lục trang tướng ("Trên trang này") liệt kê các phần thực sự có: Tổng quan, Chỉ số, Cốt truyện, Thay đổi ở bản này,
  Bộ kỹ năng, Đánh giá, Build đề cử, Trang phục, Video, Lịch sử thay đổi. Từ 1180px trở lên là cột bên phải, dính theo khi cuộn và
  tô sáng phần đang đọc. Dưới 1180px là nút tròn nổi ở góc dưới bên phải, bấm mở drawer từ dưới lên, các dòng theo thứ tự
  trên trang; chọn một dòng thì drawer đóng rồi trang mới cuộn tới phần đó.
- Nút quay về phần thay đổi chỉ hiện khi vừa bấm "Xem kỹ năng đầy đủ" từ một thay đổi, nằm cạnh nút mục lục và tự mất khi đã quay lại. Từ 1180px trở lên không có nút này vì mục lục đã là đường quay về.
- Video kỹ năng hiện ngay trong phần kỹ năng đang đọc, dưới dòng thời gian hồi chiêu và trên phần mô tả; thẻ kỹ năng có video mang dấu tam giác nhỏ. Bấm một video là phát tại chỗ. Trong lúc đang xem, chọn kỹ năng khác sẽ phát video của kỹ năng đó ở đúng chỗ ấy, nên so sánh các kỹ năng chỉ tốn một lần bấm cho mỗi kỹ năng. Nút Xem lớn mở trình xem có danh sách phát; link chia sẻ tới một video kỹ năng sẽ tự chuyển sang đúng kỹ năng đó.
- Tổng quan và kỹ năng đang xem có nút "Đề xuất chỉnh sửa" (xem `header.md`, mục Góp ý trang).

## Chân trang

- `WikiFooter` (`src/components/wiki-footer.tsx`) dùng chung cho mọi trang, nằm trong cùng cột với trang trên nền màu
  thanh: bên trái logo, tên AOV Wiki và một câu giới thiệu; bên phải ba liên kết hỗ trợ: Góp ý trang này (mở
  `FeedbackDialog`), Liên hệ & nguồn ảnh (`/contact`), AOV Stream. Chân trang không lặp lại các mục của Wiki.
- Dòng cuối ghi thuộc về Garena / Liên Quân Mobile và mốc dữ liệu đang xem kèm thị trường.
- Trên compact ba liên kết thành danh sách dưới phần giới thiệu, mỗi liên kết là một vùng bấm cao 40px. Trang có nút mục
  lục nổi (trang tướng dưới 1180px) chừa thêm khoảng trống cuối chân trang để nút không che liên kết.
