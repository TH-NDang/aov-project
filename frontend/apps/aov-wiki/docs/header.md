# Header wiki

- Tham khảo bố cục: https://wiki.hoyolab.com/pc/hsr/home (xem mục "Bố cục theo HoYoWiki")
- Phạm vi: header, logo, theme tối cố định và responsive. Nội dung trang chưa triển khai.
- Tìm kiếm và tài khoản chưa nối dữ liệu; giao diện ghi rõ trạng thái sắp ra mắt.
- Logo: `public/images/mole-logo.png`, tạo bằng công cụ imagegen tích hợp, nền trong suốt.
- Đã kiểm tra trên trình duyệt ở chiều rộng 320, 390, 768 và 1440 px; không tràn ngang. Popup tài khoản đóng bằng Escape.

## Prompt tạo logo

```text
Use case: logo-brand. Create a single original compact mascot logo for a Vietnamese game knowledge wiki: a curious mole digging through a little mound of earth and uncovering a small ancient golden fragment, expressing rediscovery of buried knowledge. Friendly clever mole with pointed snout, tiny eyes and large digging paws; strong readable silhouette, refined flat illustration, clean bold contours, minimal details legible at 48px. Warm earth brown, cream and muted gold, suitable on a dark charcoal website header. Centered square composition tightly framing mascot. Transparent background. No text, no letters, no watermark, no surrounding badge. Save the generated asset and return its local file path.
```

## Logo phiên bản 2

Logo hiện tại: `public/images/mole-logo-v2.png`, tạo bằng imagegen tích hợp. Chỉ giữ đầu chuột chũi trên nền xanh trầm; khung bo góc và viền được triển khai bằng CSS. Wordmark nghiêng, AOV đậm màu kem, WIKI vàng đất, điểm gạch xanh ngắn; bỏ tagline.

Prompt:

```text
Create a minimalist original app icon for AOV Wiki. Only one subject: a friendly curious mole HEAD, with a long broad cream snout, tiny dark eyes, rounded brown head and tiny pink nose. No body, paws, dirt, objects, treasure, lettering or decorative sparkles. Bold flat graphic silhouette with very few large color shapes, legible at 40px. Front three-quarter view, head fills 80% of square. Warm cream and cocoa brown mole against solid muted teal background (#346366), no texture or gradients. Square edge-to-edge background; website will apply a rounded square crop and border. Clean distinctive mascot mark, not another brand's character.
```

## Logo phiên bản 3

Tạo bằng imagegen tích hợp; file `public/images/mole-logo-v3.png`. Nền hổ phách, viền vàng ấm, biểu cảm tò mò và nét đậm giúp nhận diện ở kích thước nhỏ.

Prompt:

```text
Design one polished original mascot app icon for AOV Wiki. A charming curious MOLE HEAD only, three-quarter view, distinctive pointed cream muzzle and small rosy nose, two tiny lively dark eyes looking upward, subtle asymmetric smile, three sculpted tufts on the top of its cocoa brown head. Strong bold dark cocoa outlines, clean graphic shapes, sophisticated playful game-wiki branding, not generic clipart. Head fills 85 percent of square, readable at 42 pixels. Warm ochre amber background, softly lighter in center, NO teal or blue. Warm cream face, rich dark brown head, restrained golden rim highlight. Give the mole a memorable inquisitive expression without adding props. No body, no paws, no soil, no treasure, no objects, no text, no sparkles. Edge-to-edge square background, rounded border will be applied in CSS. Crisp professional 2D mascot icon.
```

## Logo phiên bản 4

Chỉnh bằng imagegen tích hợp từ phiên bản 3. File hiện tại: `public/images/mole-logo-v4.png`. Chuột chũi ló từ góc dưới trái, nhìn trực diện người dùng; giữ nền hổ phách và khung CSS.

Prompt:

```text
Edit this mole mascot app icon. Preserve the original brown/cream mole identity, charming polished 2D illustration, warm amber background and warm lighting. Change pose and composition: mole peeks into the square from the BOTTOM LEFT CORNER, its neck and lower head cropped by bottom and left edges, head slightly tilted, face turned FRONT toward the viewer, BOTH eyes making direct eye contact with the user, pink nose aimed toward camera, curious friendly subtle smile. Head occupies lower-left two thirds of image, leave clear amber negative space above and at upper right. It should feel like the mole is peeking out from below the app icon to greet the viewer. Keep large legible facial features for a 46px icon. No paws, soil, artifacts, text, extra objects, badges or inset borders. Square edge-to-edge amber background; rounded crop is applied by the website.
```

## Bố cục theo HoYoWiki (bản hiện tại)

Bám theo thanh điều hướng của https://wiki.hoyolab.com/pc/hsr/home (giống bản Genshin):

- Cao 48px, nền `#000000a6` + blur, viền dưới trắng 8%, padding ngang 24px.
- Trái: logo 28px, wordmark AOVWiKi 20px (không có vạch ngăn) + **nút thả xuống** ngay cạnh (tương đương bộ chọn game, không hiện tên mục trên header). Danh sách (`SECTIONS` trong `wiki-header.tsx`): AOV WiKi (logo + mô tả nhỏ bên dưới) và Stream (ô icon giữ chỗ, đánh dấu "Sắp ra mắt"). Thêm icon Stream bằng cách đặt `image` cho mục đó.
- Giữa: ô tìm kiếm cao 28px, tối đa 540px, bo 23px, căn giữa màn hình bằng lưới 3 cột (`minmax(max-content, 1fr) | minmax(0, 540px) | minmax(max-content, 1fr)`).
- Phải: chọn ngôn ngữ (viền 25%, bo 8px), avatar (không có chuông thông báo) — đều 28px, cách nhau 24px.
- Dropdown/popover dùng chung hằng `PANEL_SURFACE` trong `wiki-header.tsx` (nền tối trong mờ, bo 12px).
- Responsive: ≤1100px ẩn chữ "Sắp ra mắt"; ≤860px ô tìm kiếm thành nút kính lúp; ≤640px chuyển sang bố cục điện thoại (xem dưới). Đã kiểm tra ở 320, 375, 1024, 1440px — không tràn ngang, không lỗi console.

### Cách viết style

Header viết hoàn toàn bằng class Tailwind trong `wiki-header.tsx`, giống `admin-aov`. `src/wiki.css` chỉ còn:

- import `@aov/ui/styles.css`, biến màu theme của wiki;
- `@theme inline` đăng ký token thành utility: `bg-header`, `border-header-line`, `text-header-text`, `text-header-muted`, `text-gold`, `bg-amber-accent` (gạch dưới chữ AOV, cùng tông nền logo), `font-wordmark`;
- vài style nền trong `@layer base` (`#root`, font, focus ring, giảm chuyển động).

Lưu ý khi sửa:

- Bo góc ghi bằng px (`rounded-[8px]`…) vì `rounded-md/lg/xl` đi theo token `--radius` của shadcn (10px), không phải mặc định của Tailwind.
- Không đưa `font-wordmark`/`font-[...]` cùng `font-black` qua `cn()`: tailwind-merge coi họ font và độ đậm là xung đột và xoá mất một class. Tương tự, `leading-*` đặt trước `text-[size]` trong `cn()` sẽ bị xoá.

## Điện thoại (≤640px)

Theo bản mobile của HoYoWiki (https://wiki.hoyolab.com/m/hsr/home):

- Cao 44px, lề ngang 15px. Ban đầu trong suốt trên ảnh nền; trong 100px cuộn đầu tiên nền đặc `#202329` và viền dưới hiện dần (`useScrollProgressVar` ghi biến CSS `--header-solid` thẳng lên thẻ header, không render lại React).
- Trái: nút tròn 28px viền trắng 25% về **Trang chủ** (`/`), như nút home của HoYoWiki mobile. Mũi tên chọn khu vực cạnh AOVWiKi bị ẩn trên điện thoại.
- Giữa: logo 24px + chữ AOVWiKi 18px, căn giữa tuyệt đối.
- Phải: nút tròn tìm kiếm và nút "⋯", cách nhau 12px.
- Nút "⋯" mở tấm trượt từ dưới lên (`MoreMenu`, Drawer của `@aov/ui`), theo thứ tự: danh sách khu vực (AOV WiKi / Stream — cùng dữ liệu `SECTIONS` và component `SectionItemBody` với dropdown desktop), khối tài khoản (sắp ra mắt), dòng Ngôn ngữ. Nút tài khoản và ngôn ngữ bị ẩn khỏi header trên điện thoại.
