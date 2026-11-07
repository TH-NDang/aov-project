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
