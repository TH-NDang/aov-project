# ADR-032 — Liên kết giữa các bản ghi thi đấu

**Trạng thái:** Chấp nhận (người dùng duyệt hướng làm ngày 19/11/2026)  
**Ngày:** 2026-11-19  
**Bổ sung:** [ADR-015](ADR-015-manual-tournament-recording.md), [ADR-018](ADR-018-competition-pages-community.md)

## Bối cảnh

Lần kiểm tra ngày 19/11/2026 (mã, đặc tả 04 và dữ liệu thật trên VPS, chỉ đọc) cho thấy:

- Các quan hệ chính đã là liên kết thật: đội A/B của trận (7.905/7.905 có id), đội và tuyển thủ của ván, đội hình của
  giải (khóa ngoại), tổ chức và hệ thống giải của kế hoạch giải, giải chính của một phần, thành viên của hồ sơ đội.
- Một số liên kết có id nhưng là "tham chiếu mềm": đội ở thứ hạng chung cuộc, tuyển thủ nhận giải thưởng, giải của
  thành tích trên hồ sơ. Backend không kiểm tra id khi lưu, và xóa đội hay tuyển thủ không thấy các chỗ này.
- Nhiều thông tin chỉ là chữ do lần nhập Liquipedia ngày 06/11/2026 để lại: MVP của 15.431 ván và 946 trận
  ("MVP: …"), bình luận viên của 22 trận ("Bình luận: …"), 679 dòng thay người, đội của 1.887 giải thưởng, đội vô địch
  và á quân của 207 giải.
- Ê-kíp phát sóng và ban huấn luyện có hồ sơ người (PERSON), nhưng chỉ nối với giải qua chữ trong tiêu đề mục lịch sử
  ("Garena Challenger Series Summer 2021 · MAD Team") và URL nguồn. Đặc tả 04 (02/11/2026) chủ động ghi nhân sự
  broadcast vào lịch sử vì khi đó giải chưa có trong ứng dụng; nay giải đã có.
- Đội chưa có chỗ ghi tổ chức chủ quản.
- Admin nhập đội của thứ hạng và người nhận giải thưởng bằng ô chữ. Sửa tên người nhận vẫn giữ id cũ, và lưu bảng
  làm mất id đội khi tên gõ không trùng hệt tên đội.

Người đọc vì vậy không thể đi từ giải sang bình luận viên, từ trận sang MVP hay từ đội sang tổ chức chủ quản.

## Quyết định

1. **Không thêm loại thực thể.** Bình luận viên, MC, phỏng vấn, khách mời phân tích, huấn luyện viên và phân tích đội
   tuyển là hồ sơ PERSON (hoặc PLAYER kiêm vai trò); đơn vị tổ chức và tổ chức chủ quản là hồ sơ ORGANIZATION. Mô hình
   page của ADR-018 giữ nguyên: một người một hồ sơ, vai trò nghề nghiệp nằm trong `personRoles`.
2. **Liên kết mới, mỗi liên kết là một UUID kèm mã vai trò:**
   - giải: `broadcast[] {pageId, role}` (ê-kíp phát sóng của cả giải) và `staff[] {teamId, pageId, role, title}` (ban
     huấn luyện của từng đội ở giải này);
   - trận: `broadcast[] {pageId, role}` (người phát sóng riêng trận đó) và `mvpPlayerId`;
   - ván: `mvpPlayerId`;
   - giải thưởng: thêm `teamId` cạnh `teamName`;
   - mục lịch sử của hồ sơ: thêm `tournamentId`;
   - hồ sơ đội: `organizationId`, tổ chức chủ quản.
   Chữ hiện có (`recipientName`, `teamName`, ghi chú) vẫn giữ để đọc được dữ liệu cũ và hiển thị khi người được nhắc chưa
   có hồ sơ công bố.
3. **Kiểm tra khi lưu.** Đội và tuyển thủ được nhắc ở thứ hạng, giải thưởng, ban huấn luyện và MVP phải là bản ghi có
   thật, không ở thùng rác, như giải chính của một phần. Hồ sơ người phải là PERSON hoặc PLAYER có thật. Id giải trong
   lịch sử và thành tích của hồ sơ phải là một giải có thật (kể cả ở thùng rác, vì đó là việc đã xảy ra). Tổ chức chủ
   quản phải là ORGANIZATION; công bố đội cần tổ chức đã công bố.
4. **Thùng rác thấy các liên kết.** Đội hoặc tuyển thủ đang được thứ hạng, giải thưởng, ban huấn luyện hay MVP của bản
   ghi chưa xóa nhắc tới thì không xóa được, và thông tin xóa liệt kê các chỗ đó. Hồ sơ người đang ở ê-kíp hay ban huấn
   luyện của một giải không xóa được bản nháp; tổ chức đang là chủ quản của đội cũng vậy. Ngoại lệ có chủ đích: lịch sử
   và thành tích trên hồ sơ không chặn xóa giải, vì đó là bằng chứng sự nghiệp và vẫn đọc được bằng chữ.
5. **Bản công bố mang thông tin đã giải quyết.** Bản công bố của giải có thêm `people`: mỗi hồ sơ người được nhắc kèm
   mã, tên, ảnh và trạng thái công bố lúc chụp. Người chưa có hồ sơ công bố vẫn hiện tên (lấy từ bản nháp) nhưng không
   có liên kết; công bố giải không bị chặn vì người chưa công bố. MVP được thêm vào danh sách tuyển thủ của bản công bố
   giải và của ván.
6. **Không mô hình hóa riêng:** thay người (vị trí trong ván đã ghi ai thật sự đấu), nhà tài trợ, thành phố, máy chủ.
   Đội vô địch và á quân ở `result` giữ dạng chữ; thứ hạng 1 và 2 trong `placements` là nơi có liên kết.
7. **Điền ngược dữ liệu cũ bằng script, không bằng migration.** Script trong `research/community-links/` đọc dữ liệu
   bằng SQL chỉ đọc, chỉ đề xuất liên kết khi chữ khớp đúng một bản ghi trong phạm vi chắc chắn (MVP trong đội hình hai
   đội của trận ở giải đó; bình luận viên trùng tên đúng một hồ sơ; ban huấn luyện từ mục lịch sử có cả hồ sơ đội và URL
   nguồn trùng đúng một giải), rồi ghi qua Admin API với version và sổ ghi để hoàn tác. Chạy trên dữ liệu thật cần người
   dùng đồng ý riêng. Phần không khớp chắc chắn hiện trong màn "Liên kết cần xem" của Admin
   (`GET /admin/link-review`) để biên tập viên tự chọn.

## Đánh đổi

- Dùng chung hồ sơ PERSON giữ một người một trang, có lịch sử và quyền đại diện, nhưng mỗi bình luận viên cần một hồ sơ
  trước khi được liên kết. Admin tạo nhanh hồ sơ ngay trong ô chọn, như ô chọn tổ chức.
- Chặn xóa bằng liên kết mới làm việc dọn dữ liệu cần thêm bước (bỏ liên kết trước), đổi lại không còn id trỏ vào bản
  ghi đã xóa mà không ai biết.
- Điền ngược bằng script tách việc triển khai khỏi việc ghi dữ liệu thật và để lại sổ ghi, nhưng phải chạy tay; migration
  sẽ chạy ngay khi triển khai, không có bước duyệt.
- Không bắt hồ sơ người phải công bố trước khi công bố giải, vì 421 hồ sơ người hiện đều là nháp. Hệ quả là bản công bố có
  thể mang tên một người chưa có trang công khai; tên đó vốn đã có trong ghi chú công khai của trận.

## Kiểm chứng

- Test đơn vị và tích hợp của community-service: lưu bị từ chối khi id trỏ bản ghi không có, đã xóa hoặc sai loại hồ sơ;
  xóa đội, tuyển thủ, hồ sơ người và tổ chức bị chặn bởi liên kết mới; bản công bố có `people` và MVP; `link-review`
  liệt kê đúng các dòng còn chữ.
- Test của script điền ngược: chuẩn hóa tên giống `tournament.normalize_reference_search`, tách MVP và bình luận viên
  khỏi ghi chú, chỉ đề xuất khi khớp đúng một.
- Admin và Stream: typecheck, lint và test của từng gói.
