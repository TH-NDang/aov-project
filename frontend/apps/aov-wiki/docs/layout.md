# Bố cục thân trang

## Khung trang

- Mọi trang có thanh đầu trang `WikiHeader` (xem `header.md`) và chân trang `WikiFooter`. Các trang danh sách và tham
  khảo (`/hero`, `/skins`, `/warehouse/*`, `/modes/*`, `/updates/*`, `/terms/*`) dùng `WikiLibraryLayout` trong
  `src/layout/wiki-library-layout.tsx`; chi tiết tướng dùng `HeroDetailLayout` trong cùng file. Trang chủ, Liên hệ, Tài
  khoản và trang không tìm thấy tự đặt header của mình.
- Trang nằm trong cột `--aov-page-max` (1280px), lề `--wiki-gutter` mỗi bên, cùng cột với thanh đầu trang nên logo và
  nội dung bắt đầu trên cùng một đường. Không có cột mục lục bên trái: các mục nằm trên thanh đầu trang, hoặc trong tấm
  mục lục trên compact.
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

Dưới 900px trang dùng bố cục compact, từ 900px dùng bố cục wide. Hai bố cục là các component riêng, chọn bằng `usePageLayout`; nguyên tắc nằm ở `frontend/docs/RESPONSIVE.md`. Trên compact, đầu trang là một hàng gồm nút về trang chủ hoặc quay lại, tên trang, tìm kiếm, mục lục và nút "⋯". Không có thanh điều hướng ở đáy màn hình.

## Trang chủ

- Thứ tự giống nhau ở hai bố cục (`src/features/home/wiki-home.tsx`): mở đầu có ô tìm kiếm → các mục của Wiki → thay đổi
  của bản đang áp dụng → các bản cập nhật trong mùa và các vai trò. Hai bố cục chỉ khác tỉ lệ.
- Mở đầu (`HomeIntro`): dòng nhỏ "AOV Wiki · Liên Quân Mobile", tiêu đề, ô tìm lớn (`WikiSearch size="hero"`, xem
  `header.md`) và một dòng về bản đang áp dụng (ngày, tên bản, số tướng thay đổi) dẫn tới ghi chú của bản đó. Phía sau là
  ảnh tướng của ngày (`home-banners.ts`: mỗi ngày một trong ba ảnh, tên tướng ghi ở góc), phủ nửa phải và mờ dần vào
  nền ở mép trái và mép dưới. Ảnh không tự chuyển trong lúc đọc. Trên compact ảnh nằm trên cùng, header trong suốt đè lên.
- Các mục (`HomeSections`, dùng `WikiSectionTiles` trong `src/components/wiki-section-tiles.tsx`): chín ô Tướng, Trang
  phục, Trang bị, Phù hiệu, Bảng ngọc, Phụ trợ, Chế độ chơi, Cập nhật, Thuật ngữ, lấy từ `src/lib/wiki-sections.ts`. Sáu
  ô đầu ghi số mục đã xuất bản, đọc từ tổng của một trang một dòng ở từng API danh mục (số tướng lấy từ danh sách tướng);
  ba ô sau ghi một dòng mô tả. Từ 1180px chín ô nằm một hàng; 900–1179px thành 3 × 3, icon cạnh tên; compact 3 × 3, icon
  trên tên, bỏ dòng phụ. Trang không tìm thấy dùng cùng bộ ô này.
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

- `/hero` mở bằng `CatalogHeading` "Thư viện Tướng" với phiên bản dữ liệu bên phải. Trên wide, dưới tiêu đề là ô tìm và
  hai nhóm chip Vị trí, Vai trò, mỗi chip có icon và tên. Trên compact, ô tìm và nút Lọc dính dưới đầu trang; bộ lọc Vị
  trí và Vai trò nằm trong drawer dưới, có ghi tên từng lựa chọn và số tướng tìm được; phiên bản dữ liệu là một dòng dưới
  ô tìm.
- Tiếp theo là hàng thay đổi ở bản đang xem (`PatchChangesRow` trong `src/components/patch-changes-row.tsx`): các tướng
  có thay đổi, chia theo loại, dẫn tới ghi chú đầy đủ. Rồi đến lưới tướng, tiêu đề "Tất cả tướng" hoặc "Kết quả" kèm số
  tướng; khi đang lọc có nút Xóa bộ lọc.
- Danh sách lấy các tướng đã xuất bản từ API public `GET /api/wiki/v1/heroes?region=VN&locale=vi-VN&size=100&page=0`. Nếu có nhiều trang, chương trình đọc tiếp trước khi lọc; số lượng kết quả được tính từ dữ liệu thực tế, không cố định theo một bộ mẫu. Mỗi mục có thể kèm trường `portrait` để dùng ảnh `PORTRAIT` ngay từ API danh sách, không cần tải chi tiết từng tướng chỉ để lấy ảnh.
- TanStack Query giữ dữ liệu danh sách và chi tiết ở trạng thái mới trong 60 giây, dùng chung danh sách khi chuyển giữa thư viện và chi tiết. Khi lỗi có nút thử lại; khi chưa có dữ liệu hoặc không khớp bộ lọc có trạng thái riêng, không thay bằng tướng mẫu.
- Hai nhóm bộ lọc phân biệt rõ: **Vị trí** gồm Đường Caesar, Rừng, Đường giữa, Đường Rồng, Hỗ trợ; **Vai trò** gồm Đỡ
  đòn, Đấu sĩ, Sát thủ, Pháp sư, Xạ thủ, Trợ thủ (`hero-classifications.ts`). Mỗi lựa chọn có icon và tên. Vai trò và vị
  trí lấy từ dữ liệu tướng đã xuất bản (`roles`, `positions`), không suy luận vị trí từ vai trò.
- Trạng thái lọc lưu trên URL: `q` là tên hoặc mã tướng, `role` và `position` là các giá trị phân cách bằng dấu phẩy, ví dụ `/hero?q=amily&role=WARRIOR&position=TOP,JUNGLE`. Trong cùng nhóm chỉ cần khớp một lựa chọn; giữa tìm kiếm, vai trò và vị trí phải đồng thời khớp. Tìm kiếm không phân biệt chữ hoa, chữ thường hoặc dấu tiếng Việt, gồm cả `đ`/`d`.
- Thẻ tướng (`hero-card.tsx`) ưu tiên ảnh `PORTRAIT` thật, dùng `HEAD` nếu thiếu hoặc lỗi chân dung, rồi mới dùng chỗ giữ
  chỗ. Ảnh dọc tỉ lệ 4:5 trên nền thẻ, không viền; tên, vai trò và vị trí nằm dưới ảnh: vai trò ghi chữ khi thẻ đủ rộng,
  chỉ còn icon khi hẹp; vị trí luôn là icon. Lưới 7 cột, 6 cột dưới 1100px, 5 cột trên compact, 4 cột dưới 720px, 3 cột
  dưới 480px. Toàn bộ thẻ mở chi tiết và giữ đường dẫn bộ lọc để quay về; nguồn ảnh mở từ nút nhỏ trên thẻ.
- 11 icon vị trí/vai trò trong `public/icons/hero/` là SVG có nền trong suốt. `HeroGlyph` hiển thị bằng CSS mask và `currentColor`, nên có thể đổi màu bằng CSS mà không tạo thêm bản ảnh. Các PNG nguồn trong `resources/` vẫn được giữ nguyên.

## Trạng thái chờ của thư viện

- Trong lúc tải mã trang hoặc dữ liệu, header, đầu trang, thanh công cụ và khung nội dung vẫn có bố cục tương ứng. Skeleton danh sách dùng cùng khung ảnh, thân thẻ và lưới responsive với thẻ thật; trang chi tiết giữ vùng ảnh lớn, ảnh đại diện và dòng tên trước khi dữ liệu sẵn sàng.
- `WikiImage` dùng chung cho ảnh thẻ, bảng đổi tướng, ảnh đại diện và ảnh lớn. Kích thước được giữ bởi khung trước khi ảnh tải; chỉ hiện ảnh sau khi tải và giải mã xong, chuyển nhẹ trong 180ms. Các ảnh thẻ vẫn tải lười theo vùng nhìn thấy, không chờ toàn bộ danh sách mới hiện nội dung.
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
- Thẻ món hiện chỉ số thật bằng icon và số. Dữ liệu trang bị đang để chỉ số ở dạng chữ trong mô tả (`+60 Công vật lý`, `Hơi thở rồng: ...`), nên `packages/ui/src/lib/item-description.ts` tách mô tả thành chỉ số, nội tại và lời dẫn khi hiển thị, không đổi dữ liệu đã lưu. Chỉ số có cấu trúc (`content.stats`) được ưu tiên nếu có; dòng không nhận dạng được vẫn hiện nguyên văn thành hiệu ứng.
- Chip chỉ số lọc theo thứ người đọc cần mua (`stats`, ví dụ `stats=physical,crit`): chọn nhiều chip nghĩa là món phải
  có đủ các chỉ số đó, mỗi chip có số món sẽ còn lại và chip không còn kết quả được ẩn. Trên wide chip nằm thành một hàng
  riêng dưới thanh công cụ, trên compact nằm trong nút Lọc. Sơ đồ làm mờ món không khớp nhưng giữ bố cục, Danh sách ẩn
  hẳn.
- Phù hiệu có màu/icon từng hệ, đường nối liên tục từ biểu tượng hệ qua I–III. Bảng ngọc lọc theo màu; mỗi bậc chia cột
  theo màu (hoặc theo nhóm chỉ số khi đã chọn một màu), bậc cao nhất mở sẵn, các bậc dưới thu gọn. Phụ trợ dùng ảnh tròn,
  xếp lớp ảnh khi có nhiều trạng thái; mục cũ thu gọn.
- Trên wide, danh mục rộng hết cột trang cho tới khi mở một mục; khi đó chi tiết đứng thành cột bên phải (320–380px) cho
  cả bốn phần, để đọc món này sang món khác không phải mở rồi đóng. Trên compact, chọn mục mở tấm chi tiết từ bên phải,
  hoặc từ dưới lên khi màn hình từ 640px trở xuống, không rời danh mục. Chi tiết có nút và phím ← → sang mục trước/sau
  theo đúng thứ tự đang hiển thị; chuyển mục không tạo thêm lịch sử trình duyệt.
- Chi tiết là một luồng đọc liền, không chia tab. Đầu trang có nhóm, cấp và giá; trang bị có tóm tắt, chỉ số, hiệu ứng (đánh dấu nội tại duy nhất), cây ghép nhiều tầng kèm tổng giá nguyên liệu và phí ghép, món nâng cấp thành và món cùng kiểu. Phù hiệu có thêm các lựa chọn cùng cấp trong hệ; phụ trợ nhiều trạng thái cho chọn từng trạng thái. Mô tả dùng parser `EntityRichText` dùng chung, không chèn HTML thô. Danh mục tham chiếu chỉ tải khi mở chi tiết và dùng API công khai; liên kết tham chiếu vào đúng tab của kho.
- Món cùng kiểu là gợi ý tự tính, không phải do biên tập chọn. Chỉ xét món cùng cấp, bỏ qua nguyên liệu và món nâng cấp vì đã có mục riêng. Điểm cao nhất là chung tên nội tại (trong game cùng tên là cùng cơ chế) hoặc cùng dòng công dụng, sau đó là nội tại có cùng hiệu ứng dù khác tên (giảm hồi máu, lá chắn, làm chậm, sát thương theo % máu…), rồi cùng nhóm shop và từng chỉ số chung. Nội tại xuất hiện ở quá nhiều món không được tính là dấu hiệu riêng. Món khác loại sát thương (vật lý và phép) hoặc món vai trò (phụ trợ, đi rừng) so với món thường bị trừ điểm, nên chỉ hiện khi có lý do mạnh. Mỗi món ghi rõ điểm chung để người đọc tự đánh giá.
- Phần lớn mục kho chưa từng có ghi chú thay đổi, nên khối Thay đổi theo phiên bản chỉ hiện khi có nội dung. Trạng thái dữ liệu nền chưa rõ patch là một dòng nhỏ ở cuối chi tiết.
- Admin dùng chung phần đọc này (chỉ số, hiệu ứng, cây ghép) trong trình sửa, kèm bút sửa từng phần. Sơ đồ admin có cùng chip lọc chỉ số, nút Mở chi tiết khi đang chọn một món và nhấp đúp để mở. Món chưa có chỉ số có cấu trúc được đánh dấu là đang đọc từ mô tả; phần sửa chỉ số có nút điền các chỉ số đọc được và gợi ý sẵn mã chỉ số.
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
- Thay đổi của tướng dùng chung `ChangeList` (`src/features/updates/change-list.tsx`) cho trang này và trang tướng. Mỗi
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
  "Cả mùa …"; không có thì chỉ là chữ. Đang xem bản cũ thì có nút "Về bản hiện tại".

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
- Tổng quan gồm điểm đánh giá lấy từ `overviewRatings` theo thang của dữ liệu, chỉ số và cốt truyện (gấp lại). Trên
  compact Tổng quan là một thẻ giữa phần thay đổi và Bộ kỹ năng, giới thiệu dài được rút gọn.
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
  Bộ kỹ năng, Build đề cử, Trang phục, Video, Lịch sử thay đổi. Từ 1180px trở lên là cột bên phải, dính theo khi cuộn và
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
