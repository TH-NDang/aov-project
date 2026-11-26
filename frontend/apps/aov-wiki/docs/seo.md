# SEO và xem trước liên kết

Lý do chọn cách làm này nằm ở [ADR-022](../../../../backend/docs/adr/ADR-022-wiki-static-prerender.md).

## Tạo trang tĩnh

Chạy trong `frontend/apps/aov-wiki`:

```sh
# 1. Build, không cần API
VITE_WIKI_URL=https://wiki.example.com pnpm build

# 2. Ghi trang tĩnh, sitemap.xml và robots.txt vào dist/ từ API công khai
VITE_WIKI_URL=https://wiki.example.com WIKI_API_TARGET=https://api-noi-bo pnpm prerender
```

- `VITE_WIKI_URL`: origin công khai, không có đường dẫn. Hai bước phải dùng cùng một giá trị. Thiếu biến này thì bản
  build chặn crawler và gắn `noindex`, còn `pnpm prerender` từ chối chạy.
- `WIKI_API_TARGET`: gốc của wiki-service, mặc định `http://localhost:8080`.
- Bước 2 chạy lại được mà không cần build lại. Nội dung mới xuất bản chỉ có trang tĩnh sau lần chạy kế tiếp.

Xem thử cục bộ theo đúng cách tra file của môi trường thật:

```sh
pnpm preview
curl http://localhost:5173/hero/airi
```

## Thêm một trang công khai

1. Thêm hàm dựng meta trong `src/lib/seo/page-meta.ts`.
2. Gọi `usePageHead(...)` trong trang. Truyền `null` khi dữ liệu đang tải; truyền `notFoundMeta(...)` khi không tìm thấy.
   Các trang danh sách trong thư viện đã được `libraryPageMeta` xử lý theo địa chỉ.
3. Thêm trang vào `buildStaticPages` trong `src/lib/seo/static-pages.ts`.
4. Nếu trang có thư mục gốc mới, thêm thư mục đó vào `OWNED_DIRECTORIES` trong `scripts/prerender.mts` để nội dung bị gỡ
   xuất bản được dọn đi.

Không dùng thẻ `<title>` hoặc `<meta>` trong JSX: chúng sẽ nằm song song với các thẻ do trang tĩnh ghi sẵn.

## Địa chỉ

- Canonical không bao giờ có query string. `locale`, `region`, `season`, `patch` và các bộ lọc chỉ đổi cách xem.
- Kho trang bị dùng `/warehouse/<tab>` và `/warehouse/<tab>/<code>`. Liên kết cũ dạng `?tab=&item=` được chuyển hướng.
- Tướng nhiều dạng (ADR-024, ví dụ Flowborn) dùng `/hero/<tướng>` cho dạng mặc định và `/hero/<tướng>/<khóa dạng>` cho
  các dạng khác; mỗi dạng có trang tĩnh và canonical riêng. Mã và UUID cũ của dạng (`/hero/flowborn-ad`,
  `/hero/<uuid dạng>`) là trang không vào sitemap, canonical trỏ về địa chỉ mới, ứng dụng chuyển hướng `replace`.
  Đổi dạng giữ vị trí cuộn và kỹ năng đang mở.
- Liên kết nội bộ không ghi `region` và `locale` khi chúng trùng giá trị Wiki tự chọn (`implied` trong
  `context/wiki-context.tsx`), nên địa chỉ crawler gặp trùng với canonical.
- Mỗi mục trong kho là một liên kết `<a>` tới `/warehouse/<tab>/<code>`. Bấm chuột trái mở bảng chi tiết tại chỗ;
  mở tab mới hoặc crawler đi tới trang riêng của mục. Trang mục lấy tên mục làm `h1`.

## Tiêu đề, dữ liệu có cấu trúc và ảnh xem trước

- Tiêu đề nói tên game: "Liên Quân" (tiếng Anh "Arena of Valor"). Trang tướng có bản lên đồ đã công bố thì ghi
  "lên đồ, bảng ngọc, kỹ năng"; trang và `pnpm prerender` cùng đọc `/builds` để biết.
- `headTags` ghi một khối JSON-LD: `WebSite` và `Organization` ở mọi trang, `BreadcrumbList` khi meta có `breadcrumbs`,
  `Article` khi meta có `published` (bản cập nhật). Thêm `breadcrumbs` khi dựng meta cho trang chi tiết mới.
- Trang tĩnh của tướng có mô tả mọi kỹ năng và bản lên đồ đầu tiên của từng nguồn, kèm liên kết tới trang bị.
- Ảnh xem trước mặc định là `public/images/og-default.jpg` (1200×630). Trang có ảnh riêng thì dùng ảnh đó.
- Sitemap ghi `image:image` cho ảnh của trang, và `lastmod` của trang danh sách theo mục mới nhất trong đó.

## Stream

Stream không có trang tĩnh. Mỗi trang gọi `<StreamHead title description noindex>` (`components/stream-head.tsx`);
trang tài khoản, quản lý, lời mời, đăng nhập và địa chỉ không có trang đều `noindex`. Canonical lấy origin từ
`VITE_WIKI_URL` cộng đường dẫn gốc của bản build (`/stream/`); thiếu biến này thì mọi trang `noindex`.
