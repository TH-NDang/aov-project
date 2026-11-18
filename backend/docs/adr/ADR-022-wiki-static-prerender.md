# ADR-022 — Prerender tĩnh cho Wiki công khai

**Trạng thái:** Chấp nhận ngày 07/11/2026, trước khi Wiki lên môi trường thật.

## Bối cảnh

Wiki (`frontend/apps/aov-wiki`) là ứng dụng Vite + `react-router` chạy hoàn toàn ở trình duyệt. Công cụ không chạy
JavaScript nhận về trang rỗng; không có sitemap, robots, Open Graph hay mô tả riêng từng trang. Wiki sống chủ yếu nhờ
tìm kiếm, nên phải giải quyết việc này trước khi ra mắt. Chưa có tên miền thật, nên địa chỉ công khai phải là cấu
hình lúc build.

Dữ liệu đo trên môi trường dev (07/11/2026): 130 tướng, chỉ 33 tướng đã xuất bản; toàn bộ nội dung đã xuất bản là
tiếng Việt kể cả khi gọi `locale=en-US` (`actualLocale` đều là `vi-VN`); chỉ thị trường VN đang mở; khoảng 240 mục
kho trang bị, 326 trang phục, 17 thuật ngữ. Các trang đọc `localStorage`, `window` và ngôn ngữ đã lưu ngay khi render.

## Các phương án

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **A. Bước prerender nhận dữ liệu từ API công khai**, ghi HTML tĩnh sau `vite build` | Không thêm service chạy thường trực; không đụng cách app render; API hỏng thì trang cũ vẫn phục vụ | Nội dung trễ đến lần chạy kế; body tĩnh là bản rút gọn, không phải giao diện đầy đủ | **Chọn** |
| B. Service nhỏ chèn meta theo từng request | Luôn mới, trả được 404 thật, đọc được query string | Thêm tiến trình phải vận hành, giám sát và có thể làm sập mọi trang; gọi API theo từng request của crawler | Giữ làm hướng mở rộng |
| C. React Router framework mode (SSR hoặc prerender) | HTML đầy đủ, chuẩn của thư viện | Phải viết lại route thành route module và loader, đưa React Query qua hydrate; mọi chỗ đọc trình duyệt khi render phải an toàn với server; ngôn ngữ trong `localStorage` gây lệch hydrate. Rủi ro lớn cho hành vi hiện có | Không chọn |
| D. Headless browser chụp HTML lúc build | Không sửa app, HTML đầy đủ | Cần Chromium ở nơi chạy; vài trăm trang rất chậm và dễ hỏng; HTML nặng, người dùng vẫn phải render lại | Không chọn |
| E. Dịch vụ prerender bên ngoài | Không phải tự làm | Trả phí, phụ thuộc bên thứ ba; dynamic rendering chỉ còn là giải pháp tình thế theo khuyến nghị của Google | Không chọn |

## Quyết định

Chọn **A**. Không thêm service chạy thường trực.

- **Hai bước tách biệt.** `pnpm build` không cần mạng hay API, tạo `dist/`, `200.html` và `robots.txt`.
  `pnpm prerender` đọc API công khai rồi ghi `dist/<đường dẫn>/index.html`, `sitemap.xml`, `robots.txt`. Bước này chạy
  lại được bất cứ lúc nào, không cần build lại, vì mẫu lấy từ `200.html` và không bị ghi đè.
- **Chỉ dữ liệu đã xuất bản.** Script chỉ gọi API công khai, không kèm thông tin đăng nhập, nên bản nháp không thể lọt
  vào; mục kho trang bị còn được lọc thêm theo `revision.state`. Mỗi lần chạy xóa các thư mục do script sở hữu rồi ghi
  lại, nên nội dung bị gỡ xuất bản mất trang ở lần chạy kế.
- **Lỗi không làm hỏng trang đang có.** Toàn bộ dữ liệu được đọc và dựng trong bộ nhớ trước khi chạm vào đĩa. API lỗi
  hoặc trả về không có tướng nào thì script báo lỗi và giữ nguyên trang cũ.
- **Địa chỉ công khai là cấu hình build:** dùng lại `VITE_WIKI_URL`, biến mà Stream và Admin đã dùng để trỏ tới Wiki,
  nên không phải khai báo thêm. Chỉ nhận origin http(s), không có đường dẫn. Thiếu biến này thì `robots.txt` chặn toàn bộ
  và mọi trang có `noindex`, để bản dev hay staging không vào chỉ mục với canonical sai. `pnpm prerender` từ chối chạy
  khi thiếu.
- **Một bộ dựng meta dùng chung.** `src/lib/seo` dựng tiêu đề, mô tả, canonical và Open Graph cho cả trang tĩnh lẫn
  trình duyệt. Trang tĩnh do React thay thế khi app khởi động; `createRoot` không hydrate nên không có rủi ro lệch.
- **Người dùng có JavaScript không thấy body tĩnh.** Style mặc định ẩn `[data-prerendered]`, chỉ `<noscript>` mới hiện.
  Crawler không chạy JS vẫn đọc được HTML; trải nghiệm tải trang của người dùng không đổi.

### Địa chỉ kho trang bị chuyển từ query sang path

File tĩnh không thể khác nhau theo query string, nên `/warehouse?tab=items&item=<id>` không thể có xem trước riêng.
Chuyển sang `/warehouse/<tab>` và `/warehouse/<tab>/<code>`. Đây là thay đổi duy nhất người dùng nhìn thấy, và chỉ
nhìn thấy ở thanh địa chỉ:

- Liên kết cũ vẫn hoạt động: `/warehouse?tab=…&item=…` chuyển hướng phía client và giữ nguyên các tham số còn lại.
- Liên kết theo UUID (rich text, ghi chú cập nhật) có trang tĩnh riêng với canonical trỏ về `code`, và trình duyệt tự
  đổi địa chỉ sang `code`.
- Chọn mục, lọc, đổi phiên bản, nút Back và vị trí cuộn giữ nguyên hành vi cũ.

### Ngôn ngữ và thị trường

Trang tĩnh, canonical và sitemap chỉ dành cho VN + `vi-VN`. `?locale=`, `?region=`, `?season=`, `?patch=` chỉ đổi cách
xem cùng một trang, nên canonical luôn bỏ query. Người dùng vẫn chọn ngôn ngữ như cũ; ngôn ngữ đã lưu vẫn được áp dụng.
Không dùng `hreflang`, vì nội dung tiếng Anh hiện chỉ là bản dự phòng tiếng Việt, đánh chỉ mục sẽ thành trùng lặp.
Xem xét lại khi có nội dung tiếng Anh thật; khi đó cần URL riêng cho từng ngôn ngữ.

### Yêu cầu với nơi phục vụ tĩnh

Tra theo thứ tự: file đúng đường dẫn, `<đường dẫn>/index.html`, rồi `/200.html`. Reverse proxy là Caddy (đặc tả 01 mục
3.4):

```caddyfile
root * /srv/wiki
try_files {path} {path}/index.html /200.html
file_server
```

**Bắt buộc phải theo thứ tự này.** Cách phục vụ SPA thông thường (viết lại mọi địa chỉ về `index.html`) sẽ trả về tiêu đề
và canonical của trang chủ cho mọi trang, tức là mất toàn bộ tác dụng của prerender mà không có lỗi nào báo ra. Không có
chuyển hướng thêm dấu `/`, nên địa chỉ phục vụ trùng với canonical.

`200.html` là khung app có `noindex`, dùng cho địa chỉ chưa có trang tĩnh; app vẫn chạy bình thường và tự gỡ `noindex` khi
nội dung tồn tại.

Wiki nằm ở gốc origin nên `robots.txt` của Wiki áp dụng cho cả origin: chặn `/admin/`, `/idp/`, `/auth/`; để mở `/stream/`.
Không chặn `/api/`, vì Google cần gọi API để render trang.

## Vận hành

- Triển khai: `pnpm build`, sau đó `pnpm prerender` với `VITE_WIKI_URL` và `WIKI_API_TARGET` trỏ tới API thật. Image
  proxy được build khi chưa có API, nên `prerender` phải chạy lúc triển khai chứ không phải lúc build image, và ghi vào
  thư mục mà proxy phục vụ.
- Làm mới: chạy `pnpm prerender` như một **job một lần** theo lịch hoặc sau khi xuất bản, ghi vào thư mục mà máy chủ tĩnh
  đang phục vụ. Đây không phải service thường trực. Tần suất do người vận hành quyết định; nội dung mới trễ tối đa bằng
  một chu kỳ, trong thời gian đó người dùng vẫn đọc được qua app.
- Trong Docker Compose, việc này do service một lần `wiki-prerender` làm (`scripts/prerender-job.mts`), chạy mỗi lần `up` sau khi
  `wiki-service` healthy và chạy tay bằng `docker compose run --rm wiki-prerender`. Xem `infra/README.md`.
- Dùng chung thư mục qua named volume: Docker chỉ chép nội dung image vào volume khi tạo volume lần đầu, nên sau khi build
  lại, proxy vẫn phục vụ bundle cũ. Mỗi lần chạy, job phải chạy `prerender` trên `dist` của chính image trước, thành công
  mới thay **toàn bộ** nội dung volume bằng `dist` đó. Làm theo thứ tự này thì API lỗi không chạm vào volume, site tiếp tục
  chạy bản cũ cho tới khi job thành công. Chỉ chép đè thì trang vừa gỡ xuất bản vẫn còn trong volume.
- File mới được chép trước, file cũ xóa sau, và mỗi file thay bằng thao tác đổi tên, nên trong lúc thay, trang nào người đọc nhận được
  cũng còn đủ bundle nó trỏ tới. *Từ 18/11/2026, bundle của bản đang chạy được giữ thêm một lần phát hành cho tab đang mở, và Stream,
  Admin cũng được đưa ra theo cách này: xem ADR-021, bổ sung 18/11/2026.*
- Hệ thống mới chưa xuất bản tướng nào, hoặc chưa có patch nên API trả `PATCH_CONTEXT_UNAVAILABLE`: job vẫn đưa bundle hiện tại ra và
  thoát thành công để `up --wait` qua. Site đã có trang tướng mà API trả về như vậy thì bị coi là lỗi, trang cũ được giữ.

## Hệ quả và giới hạn

- Giữa hai lần chạy, trang mới xuất bản có `noindex` và không nằm trong sitemap; trang vừa gỡ vẫn còn HTML cũ.
- Địa chỉ không tồn tại trả HTTP 200 kèm `noindex` thay vì 404 thật; phía ứng dụng vẫn hiện thông báo không tìm thấy.
- Icon trang bị phần lớn chỉ 100×100, nhỏ hơn mức tối thiểu 200×200 của Facebook, nên có thể không hiện ảnh trên đó.
  Ảnh vẫn lấy đúng từ artwork của mục theo yêu cầu; tạo ảnh xem trước riêng là việc tách biệt.
- Body tĩnh của ghi chú cập nhật chỉ có tiêu đề và tóm tắt, chưa có danh sách thay đổi. Crawler có chạy JS vẫn thấy đầy đủ.

## Khi nào xem xét lại

Chuyển sang phương án B nếu độ trễ của job trở thành vấn đề thật, nếu cần 404 thật, hoặc số trang làm thời gian chạy
vượt chu kỳ làm mới. Bộ dựng meta trong `src/lib/seo` dùng lại được nguyên vẹn cho service đó.

## Kiểm chứng

`tests/seo-meta.test.ts` và `tests/seo-prerender.test.ts` kiểm tra meta, escape, sitemap, robots và chạy script thật với
API giả (kể cả API lỗi, API rỗng, chưa có patch, gỡ xuất bản), cùng job thay nội dung volume. Trên dữ liệu dev: tải trang không chạy JS trả đúng tiêu đề, mô tả, ảnh;
sitemap có đúng 33 tướng đã xuất bản và không có tướng nào trong 97 tướng chỉ có nháp, đối chiếu trực tiếp với database.

Đã thử quy tắc `try_files` ở trên bằng Caddy thật với thư mục `dist` thật, kể cả khối Wiki của nhánh triển khai (thêm
`/index.html` ở cuối, không ảnh hưởng vì build luôn tạo `200.html`). Các test của prerender cũng chạy đạt trên Node 22,
phiên bản của image proxy; riêng điểm vào của script (đọc biến môi trường qua Vite) mới chạy trên Node 26.

Đã chạy job trong chồng Docker Compose đầy đủ (07/11/2026). Hệ thống trống: `up --wait` thành công và site chạy không có trang riêng.
Trỏ job sang API dev: 586 trang, sitemap 307 địa chỉ, trang tướng trả đúng tiêu đề qua proxy, địa chỉ không tồn tại có `noindex`. API
không kết nối được: job thoát mã lỗi, trang cũ vẫn phục vụ. Khởi động lại proxy không mất trang.

Chưa kiểm chứng được khi chưa có tên miền thật: công cụ debug của Facebook, Zalo, X; Google Search Console; canonical và
sitemap trên địa chỉ thật; HTTPS.
