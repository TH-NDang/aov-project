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

Các form legacy tạo patch/variant/release trong `PatchSetup` chế độ `all`/`patch` chưa chuyển sang cơ chế này; giao diện quản lý hiện dùng `SharedPatchSetup`, `SeasonScheduleForm` và `PatchReleaseForm`. Import file/folder/ZIP tiếp tục dùng phiên upload/backend job chuyên biệt. Nháp form không lưu dữ liệu đăng nhập, file bytes hoặc tiến trình upload.

Phạm vi áp dụng là các form liệt kê ở trên. Form khác chưa dùng `useLocalDraft`/`useDraftForm` giữ cơ chế hiện có; hướng dẫn mở rộng nằm ở cuối tài liệu.

## Luồng giữ và lưu dữ liệu

1. Ô nhập cập nhật giao diện và kho nháp trong bộ nhớ ngay.
2. Sau khoảng 500 ms kể từ lần nhập cuối, repository ghi IndexedDB. Việc ghi tiếp tục độc lập với effect của page đang bị Activity ẩn.
3. Chuyển page/modal dùng lại nháp từ bộ nhớ. Sau reload, UI chờ đọc IndexedDB và kiểm tra schema trước khi cho chỉnh sửa.
4. Bấm nút lưu hiện có mới gửi dữ liệu đến backend. Nội dung chưa hợp lệ vẫn ở nháp, còn API tiếp tục kiểm tra như trước.
5. Backend trả thành công mới dọn nháp tương ứng. Lỗi backend giữ toàn bộ nội dung nhập; lỗi dọn IndexedDB không biến lần ghi backend đã thành công thành lỗi nghiệp vụ.

Tướng có một working copy theo revision, chứa cả sáu phần và các hàng bản dịch theo locale. Lưu một phần chỉ làm sạch phần đó, giữ các phần/locale còn đang sửa. Ghi chú thay đổi cũng được giữ theo phần. Nút hủy chỉnh sửa một nhóm chỉ khôi phục nhóm đang chọn; nút bỏ nháp thiết bị cần xác nhận và dùng lại dữ liệu backend.

Chuyển trang nội bộ được phép khi nháp đã được giữ trong store. Các thao tác đang gửi request vẫn giữ khóa `busy` hiện có. Khi đóng/tải lại trình duyệt lúc còn ghi IndexedDB hoặc lưu nháp thất bại, `beforeunload` đưa ra cảnh báo. Khi tab trình duyệt chuyển sang nền, hệ thống thử đẩy các lượt ghi đang chờ sớm hơn. Trình duyệt có thể bỏ qua cảnh báo hoặc kết thúc tiến trình đột ngột; nội dung chỉ khôi phục được đến lần ghi thiết bị thành công gần nhất.

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
