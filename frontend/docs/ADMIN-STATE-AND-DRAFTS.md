# State và bản nháp nhập liệu trong Admin

## Mục tiêu

Người dùng có thể chuyển trang, đổi tab nội dung, đóng cửa sổ xem nhanh rồi mở lại mà vẫn giữ phần đang nhập. Bản nháp đã ghi xuống thiết bị có thể khôi phục sau F5 hoặc mở lại trình duyệt, trong cùng origin và tài khoản. Nội dung chưa hợp lệ vẫn được giữ; việc lưu nháp trên thiết bị không xuất bản hoặc gọi API ghi nội dung game.

## Phân chia trách nhiệm

| Loại dữ liệu | Cơ chế |
|---|---|
| Dữ liệu đã lưu ở backend | TanStack Query, query key và invalidation hiện có |
| Giá trị nhập của form tạo mới | React Hook Form; Zod kiểm tra cấu trúc nháp khi khôi phục |
| Editor tướng, bản dịch, hồ sơ và ngày tháng có control riêng | Controlled inputs, dùng chung `useLocalDraft` |
| Nháp trong phiên, dùng lại giữa nhiều lần mount | Zustand vanilla store |
| Nháp qua tải lại trang | IndexedDB qua `idb` |
| Tab, bộ lọc, mùa/patch và ngôn ngữ | URL search params hiện có |
| Page đang mở, scroll | Cơ chế giữ page bằng React Activity hiện có |
| Upload/import đang dở | Checkpoint và job backend hiện có, tách khỏi nháp form |

Cache API và bản nháp là hai vùng riêng. Sửa ô nhập không ghi vào Query cache. Query refetch chỉ cập nhật bản backend; lớp đối chiếu ba phía xác định phần nào cần giữ từ nháp.

## Các form đã áp dụng

- Biên tập sáu phần tướng; ghi chú thay đổi riêng cho từng phần.
- Biên dịch tướng, kỹ năng và trang phục; giữ đồng thời nhiều locale.
- Tạo tướng, gồm mã, tên, ngôn ngữ và mốc mùa/patch đã chọn.
- Tạo mùa, patch dùng chung, thị trường và ruleset; gán ruleset cho thị trường.
- Lịch mùa và lịch phát hành patch: giữ ngày nhập dở, lựa chọn có giờ, chuỗi giờ và nguồn theo từng thị trường. Lưu lịch một thị trường giữ nguyên nháp của các thị trường còn lại.
- Hồ sơ của mình và form chỉnh hồ sơ người dùng khác.

Giao diện quản lý mùa và patch dùng `SharedPatchSetup`, lịch theo thị trường trong `MarketSchedule` (dựng trên `ScheduleForm`) và nút phát hành `PatchReleaseForm`. Import file/folder/ZIP tiếp tục dùng phiên upload/backend job chuyên biệt. Nháp form không lưu dữ liệu đăng nhập, file bytes hoặc tiến trình upload.

Phạm vi áp dụng là các form liệt kê ở trên. Form khác chưa dùng `useLocalDraft`/`useDraftForm` giữ cơ chế hiện có; hướng dẫn mở rộng nằm ở cuối tài liệu.

## Luồng giữ và lưu dữ liệu

1. Ô nhập cập nhật giao diện và kho nháp trong bộ nhớ ngay.
2. Sau khoảng 500 ms kể từ lần nhập cuối, repository ghi IndexedDB. Việc ghi tiếp tục độc lập với effect của page đang bị Activity ẩn.
3. Chuyển page/modal dùng lại nháp từ bộ nhớ. Sau reload, UI chờ đọc IndexedDB và kiểm tra schema trước khi cho chỉnh sửa.
4. Bấm nút lưu hiện có mới gửi dữ liệu đến backend. Nội dung chưa hợp lệ vẫn ở nháp, còn API tiếp tục kiểm tra như trước.
5. Backend trả thành công mới dọn nháp tương ứng. Lỗi backend giữ toàn bộ nội dung nhập; lỗi dọn IndexedDB không biến lần ghi backend đã thành công thành lỗi nghiệp vụ.

Tướng có một working copy theo revision, chứa cả sáu phần và các hàng bản dịch theo locale. Lưu một phần chỉ làm sạch phần đó, giữ các phần/locale còn đang sửa. Ghi chú thay đổi cũng được giữ theo phần. Nút hủy chỉnh sửa một nhóm chỉ khôi phục nhóm đang chọn; nút bỏ nháp thiết bị cần xác nhận và dùng lại dữ liệu backend.

Chuyển trang nội bộ được phép khi nháp đã được giữ trong store. Các thao tác đang gửi request vẫn giữ khóa `busy` hiện có. Khi đóng/tải lại trình duyệt lúc còn ghi IndexedDB hoặc lưu nháp thất bại, `beforeunload` đưa ra cảnh báo. Khi tab trình duyệt chuyển sang nền, hệ thống thử đẩy các lượt ghi đang chờ sớm hơn. Trình duyệt có thể bỏ qua cảnh báo hoặc kết thúc tiến trình đột ngột; nội dung chỉ khôi phục được đến lần ghi thiết bị thành công gần nhất.

## Cảnh báo nguồn và nhập nhanh thông số kỹ năng

Danh sách **Tướng → Bộ lọc** mở popup lọc cảnh báo chưa đối chiếu, đường và vai trò. Có thể chọn nhiều
giá trị trong một nhóm; các nhóm kết hợp với nhau. Bộ lọc lưu trên URL, giữ khi mở/đóng tướng và lọc trên
backend trước khi phân trang. Vai trò lấy từ hồ sơ; đường lấy từ nguồn đã nhập, không suy diễn khi thiếu dữ liệu.

Trong bản nháp tướng, mở **Cảnh báo → Xử lý cảnh báo** hoặc **Chỉnh sửa Kỹ năng → Đối chiếu cảnh báo**.
Danh sách đối chiếu mở trong drawer, không đẩy nội dung kỹ năng xuống. Sau khi bổ sung và kiểm tra nội dung,
chọn **Đánh dấu đã đối chiếu**, đóng drawer rồi **Lưu phần này**. Có thể **Mở lại cảnh báo**
trong cùng trình sửa. Thao tác chỉ sửa working copy của phần Kỹ năng cho đến khi lưu; hủy phần này khôi phục cả
trạng thái đối chiếu. Bản đã xuất bản và tài khoản không có quyền sửa không có thao tác ghi.

Ghi chú nguồn được giữ nguyên; cờ được xử lý có `reviewResolution: "RESOLVED"`. Các bản sao tương ứng trong
`reviewFlags`, `review_flags` và `heroReviewFlags` được cập nhật cùng nhau. Mở lại bỏ dấu này, giữ nguyên trạng thái
thu thập nguồn ban đầu. Danh sách cảnh báo đang chờ không tính các cờ đã đối chiếu.

Trong **Sửa bảng**, ô **Tổng quan** của dòng có nhiều cấp cho nhập công thức, ví dụ `315 (+40/cấp chiêu)`,
`11 (-0,4/cấp chiêu)` hoặc `15% (+3%/cấp chiêu)`. Client hiển thị các giá trị suy ra trong popup cạnh ô nhập,
không tăng chiều cao dòng bảng; **Điền các cấp** hoặc Enter
áp dụng vào các ô cấp của dòng. Công thức sai không thay dữ liệu đang có. Bản xem trước công thức là tạm thời;
cần áp dụng trước khi đổi màn hình. Sau khi áp dụng, các ô cấp dùng working copy và nút **Lưu phần này** như các
chỉnh sửa khác. Chỉ điền nhanh khi các cột liên tiếp từ Cấp 1; không suy đoán cấp tướng hoặc chỉ số chiến đấu.

Các dòng nguồn vốn chỉ có một công thức tiếp tục giữ công thức và suy ra bảng trên client khi hiển thị.

## Chỉ số có số và phần trăm

Giáp, Giáp phép, Xuyên giáp và Xuyên giáp phép được game hiển thị dạng `150 | 20%`. Trình sửa chỉ số dùng một ô
**Số và phần trăm trong game** cho các chỉ số này: gõ hoặc dán đúng như game hiện, bên dưới đọc lại “số 150, phần trăm
20%”. Khoảng trắng và dấu `%` có thể thiếu (`150|20`), dấu thập phân là chấm hoặc phẩy. Chỉ gõ số thì phần trăm là chưa
ghi, không hiểu thành `0%`. Giá trị sai hiện lý do ngay dưới ô và **Lưu phần này** không gửi đi.

Phần trăm do người nhập đọc từ game, không tính từ số: `137 | 0%`, `150 | 20%` và `171 | 0%` cùng xuất hiện trong ảnh.
So sánh phiên bản, thay đổi của nháp và Wiki đều hiện cả cụm như game. Phần trăm thay đổi mà số giữ nguyên vẫn hiện
trong so sánh, nhưng không tạo dòng thay đổi patch vì dòng STAT chỉ ghi số.

## Bỏ qua tự nhận diện trong một đoạn văn bản

Trong các ô mô tả và nội dung dùng trình sửa rich text, bôi đen đoạn cần giữ dưới dạng chữ thường rồi bấm
**Bỏ qua** (biểu tượng ngắt liên kết) trên thanh công cụ. Ví dụ chỉ chọn `chiêu 1` trong câu “trúng chiêu 1 lâu hơn”.
Các tên tướng, kỹ năng và thuật ngữ ở vị trí khác tiếp tục được nhận diện bình thường. Đoạn được bỏ qua có viền
nét đứt trong ô sửa, còn kết quả hiển thị giữ nguyên chữ. Chọn lại đoạn đó và bấm **Bỏ qua** để bật nhận diện lại.

Trạng thái được lưu ngay trong nội dung bằng định dạng `<noauto>…</noauto>` đã được bộ đọc hỗ trợ; áp dụng cùng
luồng nháp, lưu, hoàn tác và làm lại. Chỉ tắt nhận diện tự động; tham chiếu đã được tác giả chèn bằng nút `@`
vẫn giữ nguyên. Không thay đổi từ điển hoặc ảnh hưởng các đoạn khác có cùng chữ.

Hai trường hợp về số chiêu được xử lý sẵn, không cần bấm **Bỏ qua**:

- Số chiêu đứng ngay trước `giây` là lượng thời gian: “giảm hồi tất cả chiêu 3 giây” không phải chiêu 3.
- Dạng khác của một chiêu viết được theo ba cách `chiêu 2 giai đoạn 2`, `chiêu 2 biến thể 2`, `chiêu 2 dạng 2`, kể cả khi có tên
  tướng đi kèm và khi tìm bằng `@`. Tướng chỉ có một mục cho chiêu đó (ví dụ Aoi) thì chỉ `chiêu 2` là tham chiếu, phần sau giữ
  nguyên là chữ thường. Tướng có nhiều dạng mà chỉ viết `chiêu 2` thì không nối, vì không rõ là dạng nào.

## Đối chiếu khi backend thay đổi

Nháp lưu ba thông tin: giá trị backend lúc bắt đầu (`base`), giá trị đang nhập (`value`) và version backend. Khi đọc lại dữ liệu hiện tại:

- Trường không sửa trong nháp nhận giá trị mới từ backend.
- Trường chỉ sửa ở một phía được giữ từ phía đã sửa.
- Trường bị sửa khác nhau ở cả hai phía được đánh dấu xung đột; dữ liệu nháp vẫn hiển thị và việc lưu bị khóa.
- Người dùng chọn giữ nháp để tiếp tục trên baseline mới, hoặc bỏ nháp để dùng backend. Đây là thao tác rõ ràng, không tự ghi đè.

Mảng kỹ năng, trang phục, chỉ số và bản dịch được ánh xạ bằng `skillKey`, `skinKey`, `statKey`, `locale`; effect dùng `effectType` khi duy nhất. Thứ tự dòng khác nhau không làm nhầm bản dịch. Nếu mã trùng hoặc không có định danh phù hợp, đối chiếu mảng như một giá trị và yêu cầu rà soát khi hai phía cùng thay đổi.

Ví dụ: đang dịch tên tiếng Anh trong khi người khác sửa mô tả tiếng Việt, cả hai thay đổi được giữ. Nếu cùng sửa tên tiếng Anh khác nhau, UI báo xung đột. API tướng/hồ sơ tiếp tục dùng optimistic version; cơ chế nháp không thay thế kiểm tra version trên backend.

## Trạng thái hiển thị

- **Đang khôi phục bản nháp…**: đang đọc thiết bị, form tạm khóa.
- **Đang lưu nháp…**: đã có trong bộ nhớ, chưa xác nhận ghi thiết bị.
- **Nháp trên thiết bị — Chưa lưu vào backend**: IndexedDB đã ghi thành công.
- **Nháp trong phiên này** kèm lỗi: vẫn còn trong bộ nhớ, có thể thử lưu lại hoặc lưu backend.
- **Đã lưu nội dung vào bản nháp / Đã lưu hồ sơ**: thông báo của thao tác lưu backend, tách với nháp thiết bị.

## Cấu trúc và phạm vi lưu

Database IndexedDB: `aov-admin-drafts`, version 1, object store `drafts`, key path `key`.

Key được tạo bằng JSON array `[1, issuer, subject, form]`. Ví dụ form `hero:<heroId>:<revisionId>`, `season:create`, `schedule:<endpoint>` hoặc `profile:me`. Ngôn ngữ nằm trong các hàng bản dịch của working copy; lịch ngày được tách bằng thị trường và loại ngày.

Mỗi record có `schemaVersion`, `key`, `baseVersion`, `base`, `value`, `updatedAt`. Chỉ nhận cấu trúc dữ liệu thuần; kiểm tra schema khi đọc lại. Số chưa nhập/NaN được bảo toàn trong IndexedDB và khác `null`/0. Không ghi File, Blob, token, cookie hoặc presigned URL vào nháp. Avatar đã upload chỉ giữ asset ID; URL hiển thị được phân giải lại bằng API có quyền phù hợp.

Các lượt ghi/xóa của một key được xếp hàng; kết quả ghi cũ không được đánh dấu nháp mới là đã lưu. Ghi đọc chậm không thay thế nội dung vừa nhập. Save/xóa nháp kiểm tra record đang xử lý để tránh xóa lượt chỉnh sửa mới hơn.

Nháp tồn tại đến khi lưu sạch, bỏ nháp hoặc dữ liệu website bị xóa. Đăng xuất không xóa nháp thiết bị; tài khoản khác dùng key khác. Không có đồng bộ nháp giữa thiết bị hoặc giữa hai origin như `localhost` và IP LAN. Hai tab trình duyệt độc lập chưa có cơ chế cộng tác/khóa nháp thời gian thực; tránh biên tập cùng một nháp ở nhiều tab trình duyệt. Việc ghi backend vẫn được bảo vệ bằng version khi API hỗ trợ.

IndexedDB phụ thuộc quota và chính sách giữ dữ liệu của trình duyệt. Không thay backend bằng kho trình duyệt để lưu dữ liệu lâu dài hoặc cộng tác nhiều người.

## Mở rộng sang form khác

- Dùng `useDraftForm({ form, initialValue, schema, baseVersion })` cho form React Hook Form.
- Dùng `useLocalDraft` cho controlled editor. Gọi `update` ngay khi nhập; không chỉ dựa vào cleanup khi unmount.
- Dùng khóa ổn định theo thực thể/revision; không dùng một khóa chung cho nhiều tài khoản hoặc nhiều bản dữ liệu.
- Render `DraftStatus` ngoài fieldset khóa bởi xung đột để nút giữ/bỏ nháp vẫn thao tác được.
- Tạm khóa input đến khi `ready`; giữ chuỗi nhập thô của ngày/giờ chưa hợp lệ.
- Chỉ `discard` sau khi backend xác nhận thành công. Khi lưu từng phần, dùng `rebase` với kết quả backend và giữ phần còn lại chưa lưu.
- Chỉ đưa các trường cho phép chỉnh vào nháp; không truyền toàn bộ session hoặc response chứa thông tin xác thực.

## Kiểm tra

Trong `frontend`:

```powershell
pnpm --filter @aov/admin-aov test:drafts
pnpm --filter @aov/admin-aov test:publishing
pnpm --filter @aov/admin-aov typecheck
pnpm --filter @aov/admin-aov build
```

Test dùng IndexedDB giả lập hoặc fetch fixture, không ghi dữ liệu backend đang chạy. Các trường hợp gồm đóng/mở form, reload nháp, dữ liệu chưa hợp lệ, cô lập tài khoản/revision, đổi locale, xung đột, ghi/xóa đua nhau và lỗi lưu thiết bị/backend.
