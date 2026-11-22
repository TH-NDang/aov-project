# Header wiki

- Phạm vi: thanh đầu trang dùng chung cho mọi trang của Wiki (`WikiHeader` trong `src/components/wiki-header.tsx`, style
  trong `wiki-header.css`), ô tìm kiếm chung (`src/components/wiki-search.tsx`), chuyển ứng dụng, thị trường dữ liệu và
  tài khoản. Wiki luôn dùng theme tối.
- Hai bố cục chọn bằng `usePageLayout`: thanh rộng từ 900px, một hàng compact dưới 900px. Nguyên tắc chung nằm ở
  `frontend/docs/RESPONSIVE.md`.
- Thanh đầu trang không chứa các mục của Wiki. Trên wide, các mục nằm ở trang chủ (các ô mục) và ở sidebar bên trái
  của mọi trang danh sách và tham khảo (xem `layout.md`); trên compact nằm trong tấm mục lục mở từ header. Không có
  thanh điều hướng cố định ở đáy màn hình.
- Logo hiện tại: `public/images/mole-logo-v4.png`, tạo bằng công cụ imagegen tích hợp. Header, chân trang, favicon và
  trạng thái trống dùng bản 160px `public/images/mole-logo-v4-160.png`. Các phiên bản trước và prompt được lưu lại bên
  dưới để tham khảo.

## Thanh rộng (từ 900px)

- Cao 56px (`--wiki-header-height`), dính ở đầu trang, nền màu thanh gần đặc (`--header-bg`) có blur, vạch vàng mờ ở
  dưới (`--header-line`). Nội dung thanh nằm trong cùng cột với trang: rộng tối đa `--aov-page-max`, lề `--wiki-gutter`,
  nên logo thẳng hàng với mép nội dung.
- Trái: logo chuột chũi 32px dẫn về trang chủ; chữ AOV WiKi kèm mũi tên mảnh (không có ô nền riêng) là nút mở menu
  chuyển ứng dụng. Menu (`SECTIONS` trong `wiki-header.tsx`, kiểu chung `public-app-brand.css` của `@aov/ui`, Stream
  dùng cùng kiểu) có tiêu đề nhỏ "Chọn ứng dụng" rồi mỗi ứng dụng một hàng cao 56px: logo 36px, tên "AOV Wiki" hoặc
  "AOV Stream" dạng chữ thường, một dòng mô tả cắt bằng dấu ba chấm. Ứng dụng đang dùng có nền vàng nhạt và dấu tích;
  ứng dụng kia có mũi tên, sáng lên khi rê chuột. Chọn Stream mở frontend Stream trong cùng tab.
- Giữa: ô tìm kiếm chung, cao 36px, rộng tối đa 420px, nằm giữa phần logo và phần tiện ích, hiện ở mọi bề rộng.
- Phải: nút thị trường dữ liệu (cờ và mã thị trường, mở bảng chọn thị trường) và tài khoản.
- Ô tìm kiếm, nút thị trường và nút tài khoản cùng một kiểu: không viền, bo tròn, nền mờ `--aov-text` 6% (9% khi rê
  chuột). Ô tìm kiếm có viền vàng khi đang gõ.
- Trang tướng (`variant="hero"`): thanh nằm trên ảnh tướng, trong suốt ở đầu trang; trong 100px cuộn đầu tiên nền, vạch
  dưới và độ blur tăng dần. `useScrollProgressVar` ghi `--header-solid` thẳng lên thẻ header, không cập nhật state hay
  render lại React theo mỗi lần cuộn. Trong lúc thanh còn trong, ô tìm kiếm và các nút có nền riêng để đọc được trên ảnh.

## Tìm kiếm chung

- `WikiSearch` là ô tìm duy nhất của Wiki: trên thanh đầu trang (`size="bar"`), ô lớn ở trang không tìm thấy
  (`size="hero"`), và hàng tìm kiếm của header compact (`size="sheet"`).
- Gõ chữ thì danh sách gợi ý mở dưới ô: tối đa 8 tên đã xuất bản thuộc tướng, trang bị, phù hiệu, bảng ngọc, phụ trợ và
  thuật ngữ, mỗi tên có hình và loại. Tên trùng khớp đứng trước, rồi tên bắt đầu bằng từ khóa, rồi tên chứa từ khóa; tìm
  không phân biệt dấu và tính cả tên khác. Tên lấy từ `GET /reference-catalog` theo thị trường, ngôn ngữ và mốc dữ liệu
  đang xem, chỉ tải khi bắt đầu gõ.
- Cuối danh sách là "Lọc danh sách": Tướng, Trang phục, Trang bị, Thuật ngữ, mỗi mục mở danh sách đó với từ khóa trong
  `q`, cho trang phục và cho những tên ngoài 8 gợi ý.
- Phím ↑ ↓ đi qua các tên rồi các danh sách, Enter mở mục đang đánh dấu, Escape xóa từ khóa rồi mới đóng. Chưa tải được
  danh sách tên thì báo rõ và thử lại khi gõ tiếp.
- Ô nhập trên điện thoại dùng chữ 16px để iPhone không tự phóng to trang.

## Compact (dưới 900px)

Một hàng cao 48px (`WikiHeaderCompact`):

- Trái: trang chủ để trống (`home`); Liên hệ, Tài khoản, trang không tìm thấy và các trang danh sách có nút ngôi nhà về
  trang chủ; trang tướng có nút quay lại danh sách tướng, giữ nguyên bộ lọc đang dùng.
- Giữa: chữ AOV WiKi (không có ảnh logo) ở trang chủ, Liên hệ, Tài khoản và trang không tìm thấy; trang chi tiết tướng
  để trống vì tên tướng đã lớn ngay trên ảnh bên dưới, rồi hiện nút ảnh, tên tướng và dấu đổi tướng khi tên đã cuộn
  khuất (prop `centre`); các trang khác ghi tên trang, bỏ chữ "Thư viện" ở đầu. Đây là `h1` của trang, trừ trang một chế độ và trang một bản cập nhật: hai
  trang này tự có `h1` mang tên riêng, nên header chỉ ghi tên mục (`pageTitleIsHeading`). Kho trang bị ghi chung "Kho
  trang bị", bốn phần là dãy tab dính ngay dưới header.
- Phải: tìm kiếm, mục lục và "⋯". Bấm tìm kiếm thì cả hàng thành nút quay lại và ô nhập bo tròn, và bên dưới header mở
  một màn tìm kiếm phủ kín trang: chưa gõ thì có lưới "Đi nhanh tới" chín mục và một dòng gợi ý cách tìm; gõ chữ thì
  danh sách gợi ý chiếm cả màn, mỗi hàng cao 52px.
- Mục lục (`LibraryContents` trong `src/components/library-contents.tsx`, cùng danh sách `LibraryNavigation` với sidebar
  của bố cục wide) mở tấm trượt từ phải, rộng tối đa 320px, liệt
  kê mọi mục theo bốn nhóm Sổ tay nhân vật, Kho trang bị, Lối chơi, Tham khảo (`LibraryNavigation` trong
  `src/components/library-navigation.tsx`). Mục đang xem được đánh dấu; chọn một mục thì tấm đóng.
- Nền: trên wide các trang danh sách có nền đặc. Trên điện thoại, mọi trang thư viện trừ trang một chế độ (`clear`) để
  thanh trong suốt, trên phần trưng bày hoặc trên chính trang, rồi phủ kính mờ dần (nền tối 58% và blur, vẫn thấy trang
  bên dưới) trong 100px cuộn đầu tiên; thanh công cụ ghim ngay dưới (Tướng, Trang phục) dùng cùng lớp kính. Trang chủ, trang tướng, trang một chế độ và các trang không thuộc thư viện bắt
  đầu trong suốt rồi đặc dần trong 100px cuộn đầu tiên; ảnh mở đầu của trang chủ và trang tướng nằm ngay dưới header.
  Ở biến thể `hero` (trang tướng, trang một chế độ) mỗi nút có đĩa nền mờ riêng.
- Nút cao 40px, vòng nền hiện khi rê chuột hoặc khi tấm của nút đang mở.

### Menu "⋯"

- Mở drawer dưới (`MoreMenu`) dùng chung `PublicPreferencesDrawer` với Stream: hàng tài khoản ở đầu
  (`PublicAccountSummary`, không mở popup tài khoản lồng nhau), hai ô Wiki/Stream, rồi nhóm cài đặt ngôn ngữ, múi giờ,
  định dạng ngày, tiền tệ và thị trường dữ liệu.
- Logo ứng dụng 32px; hàng cài đặt cao 48px. Nội dung cuộn khi màn hình thấp, giữ khoảng đệm theo vùng an toàn phía dưới.
- Mọi drawer dưới trên điện thoại (`PublicDrawer` trong `@aov/ui`, dùng chung với Stream) cao vừa nội dung, tối đa 85%
  màn hình, nên phía trên luôn còn một dải trang phủ mờ; chạm vào đó, nhấn Escape, hoặc kéo drawer xuống từ bất kỳ đâu
  (khi nội dung đã cuộn lên đầu) đều đóng. Không có nút X hiện ra; một nút đóng ẩn chỉ dành cho trình đọc màn hình.
  Thanh nắm 40×4px ở đầu, tiêu đề 16px căn trái, góc trên bo 18px. Nền phía sau giữ nguyên kích thước; hiệu ứng mở
  240ms và tắt khi người dùng bật giảm chuyển động.

## Cách viết style

Header dùng class riêng trong `wiki-header.css`; mọi màu lấy từ token (`--aov-*`, `--header-bg`, `--header-line`), bo
góc lấy từ `--aov-radius-control` và `--aov-radius-card`. `src/wiki.css` giữ:

- import `@aov/ui/styles.css` và các file trong `src/styles/` (vai trò chữ, chuyển động, ô nhập và nút dùng chung);
- bảng màu Wiki gán vào các token chung (xem `frontend/docs/DESIGN-TOKENS.md`), cùng `--wiki-gutter`,
  `--wiki-header-height` (56px, 48px dưới 900px), `--header-bg` và `--header-line`;
- `@theme inline` cho `--font-sans` và `--container-page`;
- vài style nền trong `@layer base` (`#root`, nền trang, focus ring, giảm chuyển động).

Lưu ý khi sửa: `rounded-md/lg/xl` của Tailwind đi theo token `--radius` của shadcn (10px), không phải thang bo góc của
Wiki, nên chỗ nào dùng class Tailwind thì ghi bo góc bằng token hoặc px.

## Góp ý trang

- `FeedbackDialog` (`src/components/feedback-dialog.tsx`) mở từ nút "Góp ý trang này" ở chân trang của mọi trang. Trang
  tướng (Tổng quan, kỹ năng đang xem) và trình xem trang phục có nút "Đề xuất chỉnh sửa" cho đúng phần đó, kèm nội dung
  đang hiển thị để đối chiếu.
- Góp ý được gửi qua `POST /api/wiki/v1/media/contact-requests` (`src/lib/contact-request.ts`) cùng tên,
  email, đường dẫn trang và mốc dữ liệu đang xem; tối đa 4.000 ký tự. Gửi xong hiện mã tiếp nhận.
- Nút **Lưu nháp** chỉ lưu nội dung chữ, đường dẫn trang và thời gian trên thiết bị qua `localStorage`.
- Ảnh đính kèm (tối đa 3 ảnh PNG/JPG, 5 MB mỗi ảnh) chỉ để đối chiếu trên thiết bị, không được gửi hay lưu cùng bản
  nháp. Thoát trang hoặc tải lại sẽ mất các ảnh này.

## Chuyển giữa Wiki và Stream

- Thanh rộng dùng menu cạnh logo; compact dùng hai ô Wiki/Stream trong menu "⋯". Stream có menu tương ứng cạnh logo cú
  để quay về Wiki.
- Chữ logo và các dòng ứng dụng dùng chung `PublicAppWordmark`/`PublicAppOptionBody` từ `@aov/ui`: AOV nét dày nghiêng, gạch nhấn vát, tên sản phẩm chữ hoa giãn nhẹ. Wiki dùng màu kem/hổ phách của chuột chũi; Stream dùng kem/tím chàm và điểm vàng của cú. Menu Wiki dùng nền tối; menu Stream theo giao diện sáng/tối của trang.
- Cấu hình `VITE_STREAM_URL` trong môi trường của `apps/aov-wiki` để đặt địa chỉ Stream. Nếu bỏ trống, dùng cùng giao thức và hostname với Wiki, cổng `5174`, hỗ trợ cả truy cập qua IP trong mạng LAN.
- Khi triển khai, đặt URL công khai đầy đủ trước khi build, ví dụ `VITE_STREAM_URL=https://stream.example.com`; khởi động lại dev server khi thay biến môi trường. Chiều ngược lại dùng `VITE_WIKI_URL` trong `apps/aov-stream`.
- Liên kết sang Stream không mang theo bộ lọc mùa/patch của Wiki. Các liên kết nội bộ Wiki vẫn giữ ngữ cảnh tra cứu.

## Tài khoản

`PublicAccountMenu` dùng chung với Stream, hỗ trợ hover trên desktop và nhấn/bàn phím; popup gom ngôn ngữ, múi giờ, định
dạng ngày, tiền tệ và đăng nhập. Compact dùng `PublicAccountSummary` ngay trong menu “⋯”, không mở popup tài khoản lồng
nhau. Wiki không có thiết lập giao diện. Ngôn ngữ dùng `WikiContext`, giữ thị trường/bộ lọc hiện tại.
Đăng nhập qua trang AOV riêng tại máy chủ xác thực, public client `aov-wiki` với Code + PKCE S256.
Callback `/auth/callback` đọc tên qua `/api/wiki/v1/users/me` rồi trở lại URL trước đăng nhập.
Khi đã đăng nhập, popup tài khoản (desktop) và hàng tài khoản trong menu “⋯” (compact) có liên kết
**Cài đặt tài khoản** tới `/account`: đổi mật khẩu bằng mã gửi email, xem/đăng xuất thiết bị và bật/tắt xác thực
hai bước (ADR-028). Phần giao diện dùng chung `PublicAccountSecurity` của `@aov/ui`; bật/tắt 2FA chuyển sang trang
Keycloak theme AOV bằng `kc_action` rồi quay lại `/account`.
Cấu hình `VITE_AUTH_ISSUER`, `VITE_AUTH_CLIENT_ID` trước khi build; xem
[cài đặt theme](../../../../backend/wiki-service/infra/local/keycloak-themes/README.md).

## Logo và prompt tạo logo

Phần này giữ lại prompt của các phiên bản logo để tham khảo khi cần vẽ lại. Logo đang dùng là phiên bản 4.

### Phiên bản 1

```text
Use case: logo-brand. Create a single original compact mascot logo for a Vietnamese game knowledge wiki: a curious mole digging through a little mound of earth and uncovering a small ancient golden fragment, expressing rediscovery of buried knowledge. Friendly clever mole with pointed snout, tiny eyes and large digging paws; strong readable silhouette, refined flat illustration, clean bold contours, minimal details legible at 48px. Warm earth brown, cream and muted gold, suitable on a dark charcoal website header. Centered square composition tightly framing mascot. Transparent background. No text, no letters, no watermark, no surrounding badge. Save the generated asset and return its local file path.
```

### Phiên bản 2

File `public/images/mole-logo-v2.png` (không còn trong repo), tạo bằng imagegen tích hợp. Chỉ giữ đầu chuột chũi trên
nền xanh trầm; khung bo góc và viền làm bằng CSS. Wordmark nghiêng, AOV đậm màu kem, WIKI vàng đất, điểm gạch xanh
ngắn; bỏ tagline.

Prompt:

```text
Create a minimalist original app icon for AOV Wiki. Only one subject: a friendly curious mole HEAD, with a long broad cream snout, tiny dark eyes, rounded brown head and tiny pink nose. No body, paws, dirt, objects, treasure, lettering or decorative sparkles. Bold flat graphic silhouette with very few large color shapes, legible at 40px. Front three-quarter view, head fills 80% of square. Warm cream and cocoa brown mole against solid muted teal background (#346366), no texture or gradients. Square edge-to-edge background; website will apply a rounded square crop and border. Clean distinctive mascot mark, not another brand's character.
```

### Phiên bản 3

Tạo bằng imagegen tích hợp; file `public/images/mole-logo-v3.png` (không còn trong repo). Nền hổ phách, viền vàng ấm,
biểu cảm tò mò và nét đậm giúp nhận diện ở kích thước nhỏ.

Prompt:

```text
Design one polished original mascot app icon for AOV Wiki. A charming curious MOLE HEAD only, three-quarter view, distinctive pointed cream muzzle and small rosy nose, two tiny lively dark eyes looking upward, subtle asymmetric smile, three sculpted tufts on the top of its cocoa brown head. Strong bold dark cocoa outlines, clean graphic shapes, sophisticated playful game-wiki branding, not generic clipart. Head fills 85 percent of square, readable at 42 pixels. Warm ochre amber background, softly lighter in center, NO teal or blue. Warm cream face, rich dark brown head, restrained golden rim highlight. Give the mole a memorable inquisitive expression without adding props. No body, no paws, no soil, no treasure, no objects, no text, no sparkles. Edge-to-edge square background, rounded border will be applied in CSS. Crisp professional 2D mascot icon.
```

### Phiên bản 4 (đang dùng)

Chỉnh bằng imagegen tích hợp từ phiên bản 3. File `public/images/mole-logo-v4.png`, bản 160px
`public/images/mole-logo-v4-160.png`. Chuột chũi ló từ góc dưới trái, nhìn trực diện người dùng; giữ nền hổ phách. Trên
thanh đầu trang logo có viền vàng mảnh và bo 6px bằng CSS.

Prompt:

```text
Edit this mole mascot app icon. Preserve the original brown/cream mole identity, charming polished 2D illustration, warm amber background and warm lighting. Change pose and composition: mole peeks into the square from the BOTTOM LEFT CORNER, its neck and lower head cropped by bottom and left edges, head slightly tilted, face turned FRONT toward the viewer, BOTH eyes making direct eye contact with the user, pink nose aimed toward camera, curious friendly subtle smile. Head occupies lower-left two thirds of image, leave clear amber negative space above and at upper right. It should feel like the mole is peeking out from below the app icon to greet the viewer. Keep large legible facial features for a 46px icon. No paws, soil, artifacts, text, extra objects, badges or inset borders. Square edge-to-edge amber background; rounded crop is applied by the website.
```
