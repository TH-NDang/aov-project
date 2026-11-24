# Thiết kế dùng chung cho 3 app

Wiki, Stream và Admin là một họ sản phẩm nên dùng chung màu, phông chữ, bo góc và cách dựng bề mặt. Nguồn duy nhất là
`packages/ui/src/styles/tokens.css`; `globals.css` ánh xạ các token này sang biến của shadcn, còn `wiki.css` và
`stream.css` chỉ đặt tên lại, không khai báo giá trị màu riêng. Hai ngoại lệ: phần phủ lên ảnh (xem bên dưới) và màu
trắng của thẻ, menu Stream ở giao diện sáng, vì bộ màu chung chưa có màu trắng riêng cho Stream.

## Màu

- Mỗi màu dùng `light-dark()`, nên tự theo `color-scheme` mà từng app đang đặt: Wiki luôn tối, Stream và Admin theo lựa
  chọn của người xem hoặc hệ thống. Không viết lại bảng màu cho chế độ tối.
- Màu nhấn là `--aov-accent`: vàng trên Wiki và Admin; Stream dùng xanh tím đậm của lông cú ở giao diện sáng và tím oải
  hương ở giao diện tối; vàng mắt cú chỉ còn trong logo. Mỗi màn hình chỉ nên có một nút chính dùng màu này.
- Màu trạng thái (`--aov-success`, `--aov-danger`, `--aov-warning`, `--aov-info`, `--aov-live`) chỉ mang ý nghĩa trạng
  thái, không dùng để trang trí: xanh lá là tăng sức mạnh hoặc thắng, đỏ là giảm sức mạnh hoặc thua, xanh dương là điều
  chỉnh, cam là làm lại, `--aov-live` là đang phát trực tiếp.
- Giá bằng vàng trong game và đồng vàng đứng cạnh giá dùng `--aov-game-gold`, màu hổ phách của đồng vàng trong game,
  không dùng màu nhấn.
- Các cặp chữ/nền chính đạt tỉ lệ tương phản AA (từ 4.5:1) ở cả hai chế độ, kể cả chữ mờ (`--aov-muted`). Chữ mờ chỉ
  đặt trên nền trang hoặc nền thẻ, không đặt trên nền đã tô màu. Khi đổi màu phải kiểm tra lại.
- Màu cố định chỉ còn ở phần phủ lên ảnh: lớp tối dưới chữ và nút nằm trên ảnh tướng, chữ trên ảnh bìa. Ảnh là nội dung
  nên giữ tông riêng. Màu mạnh trên trang chỉ đến từ ảnh và icon của game.
- Wiki và Stream mỗi app có bộ màu riêng trong `tokens.css`: `--aov-wiki-*` và `--aov-stream-*` (màu logo cú). `wiki.css`
  và `stream.css` gán bộ màu này vào các token chung, nên các thành phần dùng chung tự theo. Admin giữ bảng màu gốc.
- Ba hạng đầu của một bảng dùng `RankBadge` (`@aov/ui/components/rank-badge`) với `--aov-medal-gold`,
  `--aov-medal-silver`, `--aov-medal-bronze` và số `--aov-on-medal`, cùng màu kim loại ở cả hai giao diện. Dòng của ba hạng
  đầu nằm trên dải màu huy chương nhạt dần; đội đứng đầu có dòng cao, logo và tên lớn hơn. Hạng chung như "3–4" và bảng
  chưa đấu trận nào không có huy chương.
- Hạng giải dùng `TierEmblem` (`@aov/ui/components/tier-emblem`) ở Stream và Admin: mỗi hạng một hình dáng (S đội vương
  miện, A có cánh, B khiên, C khiên ngắn, D vòng rỗng) và một màu `--aov-tier-s` đến `--aov-tier-d`, nên vẫn phân biệt được
  khi không thấy màu. Tên hạng viết "Hạng S", không viết "S-Tier".
- Vòng càng gần chức vô địch càng nổi: bán kết viền đậm hơn, chung kết nhánh dùng màu nhấn, chung kết tổng viền và chữ
  `--aov-medal-gold` kèm cúp (`RoundLabel`, `roundWeight`). Theo một đội trên nhánh đấu: đường liền là thắng đi tiếp, đường
  đứt màu đỏ là rơi xuống nhánh thua, đường vàng là hành trình của nhà vô địch.
- Bộ màu Wiki "Đêm dịu": nền than chì gần như trung tính (không ánh xanh), thẻ sáng hơn nền một bậc, dấu nhấn vàng
  champagne dịu, luôn tối; màu mạnh để dành cho ảnh tướng và icon. `wiki.css` gán: nền trang `--aov-bg`, thẻ `--aov-surface`, rê chuột và điều khiển `--aov-raised`, ô chìm
  `--aov-sunken`, đường kẻ `--aov-line` và `--aov-line-strong`, chữ `--aov-text`, `--aov-text-soft`, `--aov-muted`, nhấn
  `--aov-accent` và `--aov-accent-strong`. Bảng nổi (popover, menu, sheet, drawer) lấy `--aov-raised` làm nền, nên mục
  được đánh dấu bên trong lên thêm một bậc (`--aov-wiki-panel-high`).
- Stream đặt tên lại các token chung thành `--hub-*` ở đầu `stream.css` và chạy được ở cả giao diện sáng lẫn tối. Thanh
  trên và chân trang theo giao diện. Logo đội và giải nằm trên ô `--hub-plate`, đổi theo giao diện: nhạt ở giao diện
  sáng, chàm đêm ở giao diện tối. `ThemedLogo` chọn bản logo vẽ cho nền đó.
- Chữ AOV WiKi và AOV Stream trong menu chuyển ứng dụng giữ màu riêng của từng sản phẩm ở mọi app: `--aov-brand-wiki-*`,
  `--aov-brand-stream-*` trong `tokens.css`. Các thành phần dùng chung trong `packages/ui` chỉ đọc token, không gõ màu.
- Biểu đồ một chuỗi số liệu dùng `--chart-1` (lấy từ `--aov-chart`); các chuỗi tiếp theo lấy `--aov-chart-2` đến `--aov-chart-5`. Ở bảng màu gốc, màu này tối hơn màu nhấn vì màu
  nhấn quá sáng cho mảng đặc trên nền tối; Wiki dùng chính màu vàng của mình.

## Chữ

- Phông Be Vietnam Pro (`@fontsource/be-vietnam-pro`, trọng số 400–700), được thiết kế cho dấu tiếng Việt.
- Wiki dùng các vai trò trong `apps/aov-wiki/src/styles/typography.css` thay vì tự chọn cỡ: `--wiki-type-page` (28/36
  đậm, 22/28 trên compact), `--wiki-type-section` (18/24), `--wiki-type-entry` (15/22 đậm vừa), `--wiki-type-category`
  (14/20 đậm vừa), `--wiki-type-body` (15/24), `--wiki-type-prose` (16px, dòng 1.7, cho phần đọc dài),
  `--wiki-type-meta` (13/18). Trên compact tiêu đề mục và tên mục nhỏ đi một chút.
- Stream: 28/36 cho tiêu đề trang (22/28 trên compact), 22/28 cho tiêu đề mục (18/24 trên compact), 17/24 cho tiêu đề
  thẻ ở cột phụ, 14/20 cho nội dung, 15/20 cho tên trong hàng, 13/18 cho chữ phụ, 12/16 cho nhãn. Trên sân khấu của một
  giải hay một trận: tên giải 34/42, tên đội 28/34, tỷ số 76/80 (22/28, 15/20 và 48/56 trên compact).
- Không có chữ nào nhỏ hơn 12px. Số cần thẳng hàng dùng `font-variant-numeric: tabular-nums`.
- Admin giữ thang 12/14/16/24 và các lớp `type-*` theo `AGENTS.md`.

## Hình khối và bề mặt

- Bo góc: 6px cho điều khiển (`--aov-radius-control`), 10px cho thẻ (`--aov-radius-card`), 14px cho ảnh lớn
  (`--aov-radius-media`); chỉ chip và ảnh đại diện mới bo tròn hẳn (`--aov-radius-pill`).
- Không lồng khung trong khung, và không dùng một khung cho mọi chỗ. Cách trình bày từng loại nội dung nằm trong `RESPONSIVE.md`.
- Một mục gồm tiêu đề và nội dung nằm thẳng trên nền trang; chỉ thứ bấm được hoặc nhóm cần
  tách biệt mới là thẻ. Bên trong một thẻ, các phần ngăn nhau bằng khoảng trống hoặc đường kẻ mảnh, không bằng thẻ khác.
- Thẻ dùng màu nền `--aov-surface`, không thêm viền và bóng. Trạng thái rê chuột dùng `--aov-raised`. Thẻ đang chọn có
  viền 1px màu nhấn và nền nhấn rất nhạt. Riêng thẻ trận nhỏ của Stream (`.tn-match`) và ô trận trong nhánh đấu
  (`.tn-node`) giữ viền mảnh vì nằm dày đặc.
- Các hàng của một danh sách ngăn nhau bằng đường 1px `--aov-line`.
- Không dùng góc vàng, khung trang trí, vạch vàng trên đầu, họa tiết hay dải màu phía sau chữ và dữ liệu.
- Thanh trên và trang nằm trong cùng một cột: rộng tối đa `--aov-page-max` (1280px), lề `--aov-gutter` mỗi bên, nên logo
  và nội dung bắt đầu trên cùng một đường. Thanh trên cao `--aov-topbar` (56px), 48px trên compact. Đoạn văn dài có thể
  hẹp hơn, tối đa 72ch.

## Đầu trang và điều khiển

- Mỗi trang danh sách mở bằng tiêu đề, tối đa một dòng chữ mờ bên dưới và tối đa một nút bên phải; không có banner, linh
  vật hay ảnh phía sau tiêu đề. Wiki dùng `CatalogHeading` (`apps/aov-wiki/src/layout/catalog-heading.tsx`), Stream dùng
  `.tn-page-head`.
- Trên Stream, một giải, một trận, một nhà vô địch và đầu thẻ một đội đứng trên sân khấu (`Stage`,
  `components/stage.tsx`): nền đêm ở cả hai giao diện, được chiếu sáng bằng chính logo của ai đứng trên đó, làm nhòe
  thành màu. Không có logo thì ánh sáng lấy màu sinh từ tên. Sân khấu chỉ dành cho thứ người xem tìm đến; hàng, bảng và
  thẻ nhỏ đứng trên nền thẻ thường. Logo chỉ có bản cho nền kia thì mang theo nền của bản đó (ô nhạt ở giao diện tối và trên sân khấu), như Admin.
  `.hub-art` (màu sinh từ tên) còn dùng cho ô chữ cái của giải chưa có logo và ảnh bìa của trang hồ sơ.
- Chip cao 32px, bo tròn. Chip đang chọn: Wiki viền nhấn trên nền nhấn nhạt, Stream tô đặc màu nhấn (`.hub-pills`). Bộ lọc
  chỉ có icon thì ghi thêm tên ở những chỗ đủ rộng.
- Tab là tab gạch chân trên một hàng; trên compact hàng tab cuộn ngang, không xuống dòng.
- Vùng bấm cao tối thiểu 36px, nên 40px trên compact. Ô nhập trên điện thoại dùng chữ 16px. Mọi thứ bấm được giữ viền
  focus nhìn thấy được khi dùng bàn phím.

## Minh họa

Mục điều hướng của Wiki, Admin và Stream, các danh mục trong bảng thuật ngữ Admin và loại trang hồ sơ dùng icon khối đơn
sắc của Game Icons (game-icons.net, giấy phép CC BY 3.0), qua `GameIcon` và `gameIcon(name)` trong
`packages/ui/src/components/game-icons.tsx`. File đó chỉ chép đúng các hình đang dùng, không cài cả bộ; thêm hình thì
chép đường vẽ của nó từ cùng bộ theo tên trên game-icons.net. Mười mục của Wiki: Trang chủ `family-house`, Tướng
`samurai-helmet`, Trang phục `robe`, Trang bị `battle-gear`, Phù hiệu `winged-emblem`, Bảng ngọc `gem-pendant`, Phụ trợ
`magic-swirl`, Chế độ chơi `gamepad`, Ghi chú cập nhật `tied-scroll`, Thuật ngữ `spell-book`; chúng hiện ở sidebar, mục
lục của điện thoại, bảng tìm kiếm và ô mục trên trang chủ qua `WikiIcon`. Admin (`NAV_ICONS` trong
`apps/admin-aov/src/app/aov-nav-icon.tsx`) dùng cùng hình cho các mục trùng với Wiki, các mục riêng của Admin có hình
riêng trong cùng bộ. Ba mục chính của Stream (`stream-shell.tsx`): Bảng tin `newspaper`, Giải đấu `trophy-cup`, Khám phá
`compass`. Loại trang hồ sơ, ở danh bạ Stream và Admin: Hệ thống giải `laurels`, Tổ chức `castle`, Đội `meeple-group`,
Tuyển thủ `swordman`, Ban huấn luyện `teacher`. Hình lấy màu chữ (`currentColor`). Chân trang Wiki, chân trang Stream và
chân sidebar Admin ghi công Game Icons theo giấy phép; giữ các dòng đó khi còn dùng bộ này.

Vị trí, vai trò và độ khó của tướng dùng chung một bộ dấu trong `packages/ui/src/components/hero-marks.tsx` (`HeroMark`,
`HeroLaneIcon`, `HeroRoleIcon`), khung 48×48, lấy màu chữ. Wiki, Admin và Stream đều vẽ bằng bộ này.

Chỉ số và thuật ngữ trong game nằm trong sprite `packages/ui/src/assets/gameplay-art.svg`, dùng qua `gameplayIcons`.
Mười lăm hình là Game Icons (khung 512×512), chọn theo từng thuật ngữ: sát thương và công vật lý `broadsword`, sát
thương và công phép `fireball`, sát thương chuẩn `shield-impact`, giáp `shoulder-armor`, giáp phép `magic-shield`, hồi
máu `healing`, lá chắn `energy-shield`, tốc chạy `wingfoot`, tốc đánh `spinning-blades`, chí mạng `explosion-rays`, làm
chậm `sticky-boot`, choáng `stoned-skull`, giảm hồi chiêu `extra-time`, nội tại `spark-spirit`, thông số theo cấp chiêu
`upgrade`. Các hình còn lại (`heart`, `crit-damage`, `flame`, `coin`, `mana`, `vamp`) do dự án tự vẽ trên khung 64×64.
Tên symbol giữ nguyên, nên chỉ số của tướng, đánh giá tướng và hình đã chọn của thuật ngữ đổi theo. Hình đơn sắc lấy màu chữ xung quanh (`currentColor`), nên muốn đổi màu chỉ cần đặt `color` ở nơi dùng;
đừng vẽ thêm bản có màu. `termIcon(term)` chọn hình cho một thuật ngữ: hình đã chọn lưu dạng `glyph:<tên>` trong trường
`icon`, không chọn thì theo mặc định của thuật ngữ đó.

Loại thay đổi của một phiên bản dùng chung `changeKindIcons` (`packages/ui/src/components/change-kind-icons.tsx`) ở Wiki
và Admin: icon nét của Lucide, riêng "mới" là ngôi sao rơi `falling-star` của Game Icons. Tăng sức mạnh `TrendingUp`,
giảm `TrendingDown`, điều chỉnh `SlidersVertical`, cân bằng `Scale`, làm lại `Hammer`, sửa lỗi `BugOff`, gỡ bỏ `Minus`;
Admin thêm `PencilLine` cho chỉnh sửa và `Database` cho lần nhập dữ liệu. Wiki đặt dấu trong một vòng tròn nền nhạt cùng
màu (`ChangeKindMark` trong `apps/aov-wiki/src/components/change-tag.tsx`): đỏ cho tăng, xanh lá cho giảm, cam cho làm
lại, vàng cho mới, xanh dương cho điều chỉnh, đỏ cho gỡ bỏ. Icon lấy cỡ tròn số điểm ảnh để nét không nhòe. `ChangeTag`
đặt dấu đó trước một chữ ngắn người chơi dùng (Buff, Nerf, Tweak, Fix, Rework, New), `ChangeTally` ghi nhiều loại kèm số
lượng. Màu theo `patchChangeTone` trong `lib/change-kinds.ts`.

Nhóm trang bị trong cửa hàng, khi nhóm chưa có ảnh tải lên, dùng icon nét của Lucide tô theo màu riêng của nhóm (token trạng thái), qua `ItemCategoryArtwork`.

Chỉ số của trang bị (bộ lọc, thẻ và hàng trang bị) dùng một bộ icon nét Lucide riêng, `ItemStatIcon` trong `components/warehouse/item-stat-icons.tsx`, theo nhóm chỉ số của `ITEM_STAT_FILTERS`; màu của mỗi nhóm do trang đặt qua `data-stat`.

Còn trống hình thì thêm symbol vào sprite rồi khai báo trong file `*-icons.tsx` tương ứng, không nhúng SVG rời vào từng trang. Chỉ số trang bị lấy icon từ `ITEM_STATS` trong `lib/item-description.ts`.

Trạng thái trống và không tìm thấy dùng linh vật kèm một câu nói rõ chuyện gì xảy ra và bước tiếp theo: Wiki gắn class
`wiki-mascot-state`, Stream dùng `.hub-state`.

## Admin

Thanh điều hướng nằm bên trái. Để đổi lại bên phải, thêm `side="right"` cho `Sidebar` trong `app-sidebar.tsx` và đặt
`AppSidebar` sau `SidebarInset` trong `app-shell.tsx`.

## Trang đăng nhập

Hai theme Keycloak `aov-public` và `aov-admin` chạy ngoài ứng dụng React nên mỗi theme mang một bản chép của token:
khối `:root` ở đầu `aov-public/login/resources/css/aov-login.css` và `aov-admin/login/resources/css/aov-admin.css`
trong `backend/wiki-service/infra/local/keycloak-themes`, nằm giữa hai dòng chú thích đánh dấu. `pnpm lint` báo lỗi khi bản chép khác `tokens.css`; sau khi đổi token, chạy
`node --experimental-strip-types lint/login-theme-tokens.ts --write` trong `packages/ui`. Trang đăng nhập luôn tối nên
nhận giá trị tối của token. Vài màu riêng của trang (chữ sáng của tiêu đề, nền ô nhập, màu báo lỗi và thành công) vẫn
viết tay vì bộ màu chung chưa có màu tương ứng.

## Phiên đăng nhập của Wiki và Stream

Token vẫn chỉ nằm trong bộ nhớ theo ADR-008. Khi tải lại trang hoặc mở tab mới, ứng dụng hỏi lại Keycloak bằng `prompt=none` trong một iframe ẩn và nhận mã qua `/auth/callback`. Người chưa từng đăng nhập không phát sinh yêu cầu này, nhờ một dấu trong `localStorage` không chứa thông tin xác thực.
