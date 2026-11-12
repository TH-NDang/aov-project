# ADR-026 — Build đề cử theo tướng

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-12

## Bối cảnh

### Trong game

- Màn **Chuẩn bị** của một tướng có nút **Ph.án khác** mở hộp thoại “Hệ thống đề xuất” với ba tab: *Hệ thống đề cử*,
  *Phương án Hot*, *Đề cử Pro*. Mỗi mục của tab Đề cử Pro có tên người chơi, chiến lực, tỷ lệ thắng và một bộ đồ; nút
  **Dùng combo** chép bộ đó vào ô đang chọn của màn Chuẩn bị.
- Một bộ gồm: 6 trang bị theo thứ tự mua, 5 phù hiệu (3 ô nhánh chính bậc I–III, 2 ô phụ), bảng ngọc gồm nhiều loại ngọc
  kèm số lượng (mỗi màu tối đa 10, đủ thì cấp 90) và 1 phụ trợ.
- Dấu thoi xanh dưới ô trang bị luôn đi kèm cùng 12 món (các món Đại địa, Liệt hỏa, Nham thuẫn, Quả cầu băng sương,
  Thương khung kiếm, Xạ nhật cung…) ở mọi bộ: đó là thuộc tính của trang bị, không phải lựa chọn của bộ.
- Ngọc bậc III chỉ có khoảng 11 biểu tượng cho 28 loại (ví dụ ba loại ngọc đỏ “công vật lý” chung một hình kiếm). Màn
  Chuẩn bị chỉ hiện biểu tượng và số lượng, nên không biết chắc loại ngọc; cần mở chi tiết bảng ngọc (nút con mắt).
- Số La Mã dưới hai ô phụ là thứ tự ô, không phải bậc: bộ có `hap-huyet` (bậc 1) vẫn ghi “II” ở ô phụ thứ hai. Luật
  ghép phù hiệu giống luật đã dùng cho giải đấu (`community-service`, `GameRules`): 3 ô chính cùng nhánh đủ bậc 1–3;
  2 ô phụ khác nhánh chính, cùng một nhánh thì bậc 1 và 2, khác nhánh thì cả hai bậc 1.

### Dữ liệu đầu tiên

- Macro `pro-builds` (11/11/2026, 12:02–18:28, tài khoản test, máy chủ Việt Nam) chụp 57 tướng × 3 mục đầu tab Đề cử Pro:
  171 ảnh màn Chuẩn bị 2400 × 1080 sau khi bấm Dùng combo. Ảnh không có tên người chơi, chiến lực, tỷ lệ thắng.
- So chữ ký màu của từng ô trên 171 bộ: bộ đầy đủ còn 152 kiểu và không kiểu nào trùng giữa hai tướng; trang bị theo thứ
  tự 137 kiểu; phù hiệu tối đa 71 kiểu, 19 kiểu dùng ở nhiều tướng; **bảng ngọc chỉ 44 kiểu**, một trang dùng ở 27 bộ.
- 18/57 tướng có hai mục pro giống hệt nhau từng ô. Chưa biết là thật hay macro bấm lại cùng mục; dữ liệu giữ nguyên như
  ảnh và Wiki gộp các bộ trùng.
- 3 trang bị trong ảnh chưa có trong Kho trang bị (112 món); các bộ dùng chúng phải chờ Kho bổ sung.

### Trong dự án

- Chưa có khái niệm build. “build path” ở mục 4.4 của bản đặc tả là công thức ghép trang bị.
- Tiền lệ gần nhất là thống kê đấu hạng (ADR-025): một lần chụp, ảnh dẫn chứng theo SHA-256 nằm ngoài DB, cờ chờ duyệt,
  xác nhận cả lần chụp.
- Một bộ đồ tham chiếu năm module (tướng, trang bị, ngọc, phù hiệu, phụ trợ). Các module này chưa có contract công khai
  để module khác đọc mã, màu ngọc hay nhánh/bậc phù hiệu.

## Quyết định

### Module `build` riêng

Module mới `com.wikiaov.build`, schema `build`. Nó công bố SPI `BuildReferenceProvider` ở gốc module; `hero`, `item`,
`arcana`, `enchantment`, `spell` cài đặt SPI trong `internal/.../infrastructure` của mình, như `VideoSubjectProvider`
(ADR-019). Tham chiếu sang các module đó là UUID logic, không có khóa ngoại; chỉ có khóa ngoại sang `patch`, như mọi
module catalog.

Không đặt trong `hero` như ADR-025: thống kê đấu hạng chỉ chạm tướng, còn build ghép năm module và sẽ còn build do biên
tập viên viết hoặc thống kê “tướng hay dùng trang bị này”.

### Bảng ngọc và phù hiệu dùng chung, trang bị nằm trong từng bộ

- `arcana_page` (trang ngọc) và `enchantment_set` (bộ phù hiệu) là giá trị **bất biến, khóa theo nội dung**: cùng nội
  dung thì cùng một dòng. Nhiều bộ trỏ tới một trang ngọc.
- Trang bị (6 ô theo thứ tự) và phụ trợ nằm trên bộ, vì gần như không lặp. Không lưu dấu thoi xanh theo bộ.
- Bảng ngọc là phần tùy chọn: một bộ đủ khi có 6 trang bị, 5 phù hiệu và phụ trợ. Ngọc chỉ được lưu khi biết chắc từng
  loại; ảnh màn Chuẩn bị đầu tiên không đủ nên lần chụp 11/11/2026 chưa có ngọc.
- Mỗi bộ có `content_key` (SHA-256 của toàn bộ nội dung) để nhận ra cùng một bộ giữa các tướng, các mục trùng và các lần
  chụp sau mà không cần bảng “bộ dùng chung”.
- Sửa một bộ không sửa trang ngọc dùng chung: bộ được trỏ sang trang có đúng nội dung (tạo mới nếu chưa có). Trang
  không còn bộ nào trỏ tới bị xóa cùng giao dịch.

### Lần chụp, duyệt, xác nhận

- `capture` là một lần chụp một tab (`PRO`, `HOT`, `SYSTEM`) ở một thị trường, có thời điểm, múi giờ, lượt chạy macro,
  ghi chú và bản cập nhật đang áp dụng lúc chụp (`patch_variant_id`, tìm qua `GameplayContexts`).
- Mỗi tướng trong lần chụp có kết quả (`COLLECTED`, `NO_BUILDS`, `FAILED`). Mỗi bộ có thứ tự trong danh sách của game,
  ảnh dẫn chứng, cờ chờ duyệt và ghi chú. Vùng từng ô suy ra từ bố cục cố định của màn Chuẩn bị (`layout = PREPARE`),
  nên không lưu vùng cho từng ô.
- Tên người chơi, chiến lực, tỷ lệ thắng là cột tùy chọn; lần chụp đầu để trống.
- Bộ đọc thiếu hoặc khớp yếu được nhập với `needs_review`. Biên tập viên sửa nội dung hoặc xác nhận. Xác nhận cả lần chụp
  khi không còn bộ chờ duyệt; đánh dấu chờ duyệt lại một bộ thì bỏ xác nhận. Xóa lần chụp xóa mọi bộ của nó.
- Nhập qua API từ `build-manifest.json` do script đọc ảnh tạo ra. Ảnh nằm ở `resources/raw/builds/<ngày>/`, không commit;
  Admin dev đọc ảnh qua middleware `/__build-captures`.

### Quyền

Xem trong Admin cần `catalog:read`; nhập, sửa, xóa cần `hero:write`; xác nhận (làm bộ hiện trên Wiki) cần `hero:publish`.

### Wiki

API công khai `GET /builds?hero=<mã>&region=VN` chỉ đọc lần chụp **đã xác nhận** mới nhất có tướng đó cho mỗi tab. Các bộ
trùng nội dung được gộp, kèm số mục pro dùng bộ đó. Trang tướng có phần “Build đề cử” ghi rõ nguồn, ngày chụp, máy chủ
và bản cập nhật. Tên người chơi không hiện.

## Đánh đổi

- Dữ liệu là ảnh tĩnh của game tại một thời điểm; build pro thay đổi liên tục nên cần chụp lại sau mỗi bản cân bằng.
- Trang ngọc dùng chung cần quy tắc tạo/dọn khi sửa; đổi lại đếm “trang ngọc phổ biến” và tái dùng trang ngọc chỉ là
  một phép nhóm.
- Bố cục cố định chỉ đúng với màn Chuẩn bị hiện tại. Đổi giao diện game thì thêm giá trị `layout` mới.
- Ảnh dẫn chứng chỉ xem được ở máy có `resources/`; DB giữ tên tệp, mã băm và kích thước.
- Bộ không có ngọc vẫn hiện trên Wiki, ghi rõ chưa có bảng ngọc. Muốn có ngọc phải chụp thêm màn chi tiết bảng ngọc.
- Nếu sau này cần dấu thoi xanh (nhiều khả năng là trang bị có kỹ năng kích hoạt), đó là dữ liệu của Kho trang bị.

## Kiểm chứng

- Kiểm thử tích hợp: nhập, trang ngọc/bộ phù hiệu dùng chung giữa các bộ, mã lạ, luật phù hiệu và ngọc, sửa một bộ không
  đổi bộ khác, dọn trang không còn dùng, xác nhận bị chặn khi còn bộ chờ duyệt, xung đột version, xóa, API công khai chỉ
  trả lần chụp đã xác nhận và gộp bộ trùng.
- Dữ liệu 11/11/2026: 57 tướng, 171 bộ; bộ đủ có đúng 6 trang bị, 5 phù hiệu theo luật, 1 phụ trợ; bộ có trang bị chưa
  có trong Kho được nhập ở trạng thái chờ duyệt.
