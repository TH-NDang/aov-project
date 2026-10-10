# AOV frontend

Monorepo React + TypeScript + Vite, pnpm workspace và Turborepo. Các component shadcn/ui (style new-york) được cài trong packages/ui. `admin-aov` đã có giao diện quản trị (xem mục bên dưới); `aov-wiki` và `aov-stream` vẫn chỉ hiển thị Hello.

## Cấu trúc

```text
apps/
  aov-wiki/       # localhost:5173
  aov-stream/     # localhost:5174
  admin-aov/      # localhost:5175
packages/
  ui/            # Cấu hình shadcn/ui dùng chung
  typescript-config/
docs/
```

## Chạy

Node.js >=22.12, pnpm 11.28.4. Chạy trong thư mục frontend:

```sh
pnpm install
pnpm dev
# Chạy riêng:
pnpm dev:wiki
pnpm dev:stream
pnpm dev:admin
# Kiểm tra:
pnpm typecheck
pnpm build
```

Khi cần thêm UI:

```sh
pnpm dlx shadcn@latest add button --cwd packages/ui
```

## Dùng UI chung

```tsx
import { Button } from "@aov/ui/components/button"
import { useIsMobile } from "@aov/ui/hooks/use-mobile"
```

Component nằm ở `packages/ui/src/components`, hook ở `packages/ui/src/hooks`. Registry new-york-v4 hiện không cung cấp `questionnaire` và `toast`; sử dụng `sonner` cho thông báo.

Khi dùng tooltip hoặc sidebar, bọc vùng giao diện bằng `TooltipProvider` từ `@aov/ui/components/tooltip`.

`cn` trong `@aov/ui/lib/utils` re-export từ package `cn` (cùng bộ merge class mà các component shadcn dùng), nên app không đóng gói thêm `tailwind-merge`.

### Thanh cuộn dùng chung

`@aov/ui/styles.css` áp sẵn thanh cuộn mảnh, màu trung tính cho mọi vùng cuộn của các app (`packages/ui/src/styles/scrollbar.css`), không cần thêm class. Theme tối đặt `color-scheme: dark` nên thanh cuộn gốc của trình duyệt cũng tối theo.

Mọi rule nằm trong `@layer base`, nên ghi đè từ phía app chứ không sửa file chung:

| Phạm vi | Cách làm |
|---|---|
| Cả app | Khai báo lại token trong CSS của app (ngoài `@layer`), ví dụ `:root { --scrollbar-thumb: color-mix(in oklab, var(--primary) 50%, transparent); }` |
| Một vùng và các phần tử bên trong | Đặt token ngay trên phần tử: `[--scrollbar-thumb:var(--color-primary)]`, `[--scrollbar-width:none]` |
| Một phần tử | Utility có sẵn của Tailwind: `scrollbar-none`, `scrollbar-auto`, `scrollbar-thumb-*`, `scrollbar-track-*`, `scrollbar-gutter-stable`; hoặc `scrollbar-native` để dùng lại thanh cuộn gốc |

Token: `--scrollbar-width` (`auto`, `thin` hoặc `none`), `--scrollbar-thumb`, `--scrollbar-track`, `--scrollbar-thumb-hover` (chỉ component `ScrollArea` dùng, vì thanh cuộn gốc không có trạng thái hover).

Lưu ý:

- Style dùng `scrollbar-color`/`scrollbar-width` chuẩn. Trình duyệt chưa hỗ trợ (Safari cũ) giữ nguyên thanh cuộn gốc.
- Muốn ẩn thanh cuộn mà vẫn cuộn được thì dùng `scrollbar-none`. Đừng dùng `::-webkit-scrollbar`: Chrome bỏ qua pseudo-element này khi phần tử đã có `scrollbar-color` hoặc `scrollbar-width`.
- Thư viện tự ẩn thanh cuộn (Radix ScrollArea/Select, Base UI) dùng CSS ngoài layer nên vẫn thắng style chung.
- Iframe nhúng từ trang khác (player stream…) giữ thanh cuộn của trang đó.

## admin-aov

Trang quản trị cho biên tập viên, style mặc định của shadcn/ui, menu điều hướng đặt ở **bên phải** (`<Sidebar side="right" collapsible="icon">`, phím tắt Ctrl+B). Các màn hình nâng cấp từ bản mô phỏng HTML trong `resources/Lien-Quan-v3/preview`:

| Trang | Đường dẫn | Từ mô phỏng | Phần nâng cao |
|---|---|---|---|
| Bảng điều khiển | `/` | `index.html` | Thẻ số liệu, độ phủ dữ liệu, danh sách việc cần xử lý dẫn tới đúng bộ lọc, biểu đồ trang bị theo nhóm, nhật ký thao tác |
| Tướng | `/heroes`, `/heroes/:id` | — | Bảng lọc/sắp xếp; trang chi tiết có tab Thông tin, Kỹ năng (bảng dạng tướng), Trang phục, Ảnh |
| Trang phục | `/skins` | — | Bảng toàn bộ trang phục, lọc theo bậc/portrait/head & cover; sửa tên, bậc, chọn ảnh chính |
| Portrait | `/portraits` | `Xem-portrait.html`, `Quan-ly-portrait.html` | Tab có đếm số, gợi ý ghép kèm % khớp, xem trước các bước sẽ thực hiện, Lưu & ảnh tiếp (Ctrl+Enter / Ctrl+Shift+Enter) |
| Head & cover, Bậc trang phục | `/media/*` | `Xem-head-cover.html`, `Xem-bac-trang-phuc.html` | Lọc theo loại, lightbox chuyển ảnh bằng ← → |
| Trang bị | `/items` | `Xem-trang-bi.html`, `Bien-tap-trang-bi.html` | Bảng, bố cục shop kéo-thả (chuột, cảm ứng, bàn phím), sửa công thức có kiểm tra vòng lặp, cây công thức, hoàn tác Ctrl+Z, lưu theo lô, chặn rời trang khi chưa lưu |
| Phù hiệu | `/enchantments` | `Xem-phu-hieu.html` | Lưới theo cấp/cột, đánh dấu vị trí lệch web, nối dòng mô tả bị ngắt, xem dòng Excel gốc |
| Bảng ngọc, Giải đấu, Livestream | `/arcana`, `/tournaments`, `/streams` | — | Trạng thái trống và phạm vi dự kiến |

Thêm: tìm kiếm toàn cục Ctrl+K (không phân biệt dấu), giao diện sáng/tối, bố cục danh sách + panel chi tiết kéo giãn được (màn hình hẹp dùng drawer), trạng thái lọc nằm trên URL.

### Dữ liệu

Chưa có admin API của `wiki-service`, nên app chạy với **dữ liệu mẫu**: Vite (dev/preview) phục vụ `resources/Lien-Quan-v3` tại `/__resources/` và lớp `src/lib/api/mock-api.ts` đọc các file JSON trong đó. Thay đổi được lưu trong localStorage của trình duyệt (chỉ phần bị sửa), có version cho từng bản ghi để báo xung đột như đặc tả 01/9.1, và có thể bỏ toàn bộ từ menu người dùng. Không có gì được ghi vào `resources/`.

Giao diện chỉ phụ thuộc interface `AdminApi` (`src/lib/api/client.ts`); khi `/api/wiki/v1/admin/**` sẵn sàng, chỉ cần thêm adapter gọi HTTP thay cho adapter mẫu. Lỗi dùng `ApiError` theo ProblemDetail và luôn rẽ nhánh theo `code`.

Ảnh trong `resources/` lưu bằng Git LFS. Muốn xem ảnh thật khi chạy admin:

```sh
git lfs pull --include "resources/Lien-Quan-v3/assets/**,resources/Lien-Quan-v3/temp/**"
```

Thiếu ảnh thì giao diện hiển thị ô thay thế, không lỗi.

### Cấu trúc `apps/admin-aov/src`

```text
app/          router, providers, theme, layout (sidebar phải, header, command menu)
components/   data-table, master-detail, media-image, image-lightbox, picker dùng chung
features/     dashboard, heroes, skins, portraits, media, items, enchantments, placeholders
lib/api/      types, AdminApi, adapter dữ liệu mẫu, ApiError
lib/domain/   quy tắc nghiệp vụ: kiểm tra danh mục trang bị, chuyển portrait
```
