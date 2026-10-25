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

Cơ chế giữ nội dung nhập khi chuyển trang và khôi phục sau tải lại trong Admin được mô tả tại [State và bản nháp nhập liệu](docs/ADMIN-STATE-AND-DRAFTS.md).

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
| Tướng | `/publishing`, `/publishing/:heroId` | — | Danh mục backend, bản nháp, kỹ năng, bản dịch, lịch sử và so sánh theo mùa/patch |
| Trang phục của tướng | `/publishing/:heroId?tab=skins` | — | Quản lý trong phiên bản của từng tướng; không còn trang danh sách riêng |
| Portrait | `/portraits` | `Xem-portrait.html`, `Quan-ly-portrait.html` | Tab có đếm số, gợi ý ghép kèm % khớp, xem trước các bước sẽ thực hiện, Lưu & ảnh tiếp (Ctrl+Enter / Ctrl+Shift+Enter) |
| Head & cover, Bậc trang phục | `/media/*` | `Xem-head-cover.html`, `Xem-bac-trang-phuc.html` | Lọc theo loại, lightbox chuyển ảnh bằng ← → |
| Trang bị | `/items` | `Xem-trang-bi.html`, `Bien-tap-trang-bi.html` | Bảng, bố cục shop kéo-thả (chuột, cảm ứng, bàn phím), sửa công thức có kiểm tra vòng lặp, cây công thức, hoàn tác Ctrl+Z, lưu theo lô, chặn rời trang khi chưa lưu |
| Phù hiệu | `/enchantments` | `Xem-phu-hieu.html` | Lưới theo cấp/cột, đánh dấu vị trí lệch web, nối dòng mô tả bị ngắt, xem dòng Excel gốc |
| Bảng ngọc, Giải đấu, Livestream | `/arcana`, `/tournaments`, `/streams` | — | Trạng thái trống và phạm vi dự kiến |

Thêm: tìm kiếm toàn cục Ctrl+K (không phân biệt dấu), giao diện sáng/tối, bố cục danh sách + panel chi tiết kéo giãn được (màn hình hẹp dùng drawer), trạng thái lọc nằm trên URL.

### Dữ liệu

Danh mục tướng, phiên bản, bản dịch, trang phục của từng tướng và media đã upload đọc từ backend `wiki-service`. Các đường dẫn cũ `/heroes`, `/heroes/:slug`, `/skins` và `/reference/skins` chuyển về `/publishing`; mã tướng trong tài nguyên không được xem là UUID backend.

Các công cụ ảnh và danh mục trang bị/phù hiệu hiện vẫn dùng adapter tài nguyên: Vite (dev/preview) phục vụ `resources/Lien-Quan-v3` tại `/__resources/`, lớp `src/lib/api/mock-api.ts` đọc JSON và lưu chỉnh sửa cục bộ trong trình duyệt. Những chỉnh sửa đó không ghi vào `resources/` hay tự đồng bộ sang danh mục tướng backend. Tìm kiếm toàn cục chuyển truy vấn tướng sang `/publishing`, không đưa ra trang chi tiết tài nguyên cũ.

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

## Hero: backend → admin → wiki

Admin có khu vực `/publishing` kết nối wiki-service và `/publishing-media` quản lý ảnh backend.
Hướng dẫn cấu hình và nhập từ `resources` nằm trong [README admin](apps/admin-aov/README.md#biên-tập-hero-với-backend).
Công cụ tài nguyên cũ tiếp tục hoạt động độc lập, không tự đồng bộ thay đổi mock lên backend.

Wiki đang triển khai lại trang chủ: header, ảnh nền, câu chào, banner tự chuyển và cập nhật mùa hiện tại từ API public `/api/wiki/v1/seasons/current/updates` (TanStack Query). Bên dưới có 5 ô danh mục; chưa triển khai điều hướng và nội dung danh mục trong đợt này.
Trang wiki chưa khôi phục phần tra cứu Hero; dữ liệu và chức năng biên tập trong admin/backend vẫn giữ nguyên.
Cả hai frontend cần reverse proxy `/api/wiki` và `/media` khi deploy production.
