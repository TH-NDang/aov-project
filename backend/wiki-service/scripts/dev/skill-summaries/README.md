# Nhập tóm tắt kỹ năng

Thư mục này giữ các bản tóm tắt kỹ năng đã soạn sẵn và script đưa chúng vào wiki-service. Quy tắc viết và ý nghĩa của
trường `summary` nằm ở `backend/docs/01-BAN-DAC-TA-DU-AN.md`, mục "Tóm tắt dễ hiểu của kỹ năng".

| Tệp | Nội dung |
|---|---|
| `skill-summaries.vi-VN.json` | Tóm tắt tiếng Việt theo tướng và `skillKey`, kèm dấu vân tay của mô tả gốc lúc soạn |
| `apply-skill-summaries.mjs` | Thêm tóm tắt vào từng tướng qua API quản trị |
| `description-fingerprint.mjs` | Cách tính dấu vân tay của mô tả, dùng chung khi soạn và khi nhập |

## Điều kiện

1. Nhánh có trường `summary` đã được ghép và wiki-service đang chạy mã đó: migration V073 thêm cột, và backend cũ từ
   chối trường lạ nên sẽ trả 400 nếu chưa cập nhật.
2. Node.js 22 trở lên.
3. Một access token của tài khoản quản trị có `catalog:read` và `hero:write` (thêm `hero:publish` nếu muốn công bố).
   Cách lấy: mở Admin đã đăng nhập, mở công cụ nhà phát triển của trình duyệt, tab Network, chọn một request tới
   `/api/wiki/v1/admin/...` và chép giá trị sau chữ `Bearer` trong header `Authorization`. Token có thời hạn ngắn, nên
   lấy ngay trước khi chạy. Nếu token hết hạn giữa chừng (các tướng còn lại báo `FAILED` với mã 401), lấy token mới và
   chạy lại kèm `--into-open-drafts`: tướng đã xong được giữ nguyên, tướng còn lại được làm tiếp.

## Cách chạy

Script mặc định chỉ **xem trước**, không ghi gì:

```powershell
$env:WIKI_ADMIN_TOKEN = "<token>"
node backend/wiki-service/scripts/dev/skill-summaries/apply-skill-summaries.mjs
```

Thử trên một tướng rồi mới chạy tất cả:

```powershell
node backend/wiki-service/scripts/dev/skill-summaries/apply-skill-summaries.mjs --hero nakroth --apply
node backend/wiki-service/scripts/dev/skill-summaries/apply-skill-summaries.mjs --apply
```

`--apply` tạo cho mỗi tướng **một bản nháp** từ phiên bản đang công bố (lý do "Sửa nội dung", giữ nguyên patch áp dụng)
và ghi tóm tắt vào bản nháp đó. Wiki chưa đổi gì cho tới khi bản nháp được công bố: biên tập viên xem lại trong Admin
rồi bấm công bố, hoặc chạy thêm `--publish`.

| Tùy chọn | Ý nghĩa |
|---|---|
| `--api <url>` | Gốc API, mặc định `http://localhost:8080/api/wiki/v1` |
| `--hero <mã>` | Chỉ làm tướng này; lặp lại để chọn nhiều tướng |
| `--apply` | Ghi bản nháp |
| `--publish` | Công bố luôn bản nháp vừa ghi. Tướng có tóm tắt đang chờ duyệt (`review` trong tệp) vẫn để ở bản nháp |
| `--publish-flagged` | Công bố cả tướng có tóm tắt chờ duyệt |
| `--into-open-drafts` | Tướng đang có bản nháp dở thì thêm vào bản nháp đó thay vì bỏ qua |
| `--overwrite` | Ghi đè tóm tắt đã có |
| `--ignore-description-changes` | Vẫn gắn tóm tắt dù mô tả đã đổi từ lúc soạn |
| `--report <tệp>` | Ghi kết quả từng tướng ra JSON |

## Script tự giữ an toàn thế nào

- Tóm tắt đã có trên tướng được giữ nguyên, trừ khi dùng `--overwrite`. Chạy lại script không tạo thêm thay đổi.
- Mỗi tóm tắt mang dấu vân tay của mô tả mà nó được viết từ đó. Nếu mô tả trên server đã khác (ví dụ sau một bản cập
  nhật), tóm tắt đó bị bỏ qua và được liệt kê ở dòng `description changed` để soạn lại.
- Tướng đang có bản nháp dở bị bỏ qua và được liệt kê, để không trộn vào việc người khác đang làm. Mỗi tướng chỉ có một
  bản nháp mở cho mỗi bộ quy tắc, nên nhập tóm tắt và nhập bản dịch cho cùng một tướng phải làm lần lượt.
- Tóm tắt chỉ được thêm vào phiên bản đang hiện ở thị trường đã chọn. Khi người đọc xem lại một bản cập nhật cũ hơn,
  phần kỹ năng lấy từ phiên bản cũ nên chưa có tóm tắt.
- Kết quả mỗi tướng: `WOULD_ADD` (xem trước), `DRAFTED`, `PUBLISHED`, `UNCHANGED`, `SKIPPED`, `FAILED`.

Bản tiếng Anh chưa có trong thư mục này. Khi có, đặt tệp cùng cấu trúc với `"locale": "en-US"` và chạy với `--file`.
