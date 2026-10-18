# ADR-010 — Chuẩn hóa mã tướng, trang phục và tên ảnh

Trạng thái: Chấp nhận theo yêu cầu đổi cả khóa dữ liệu và file tài nguyên ngày 18/10/2026.

## Quyết định

- Mã tướng dùng tên quốc tế đã đối chiếu: `wukong`, `diaochan`, `zanis`, `lu-bu`, `riktor`,
  `jinnar`. Tên hiển thị của từng ngôn ngữ được giữ nguyên; không tự tạo một bản dịch đã hoàn thiện.
- Khóa trang phục theo `<hero-code>-<ten-trang-phuc-khong-dau>-<so>`, bắt đầu 1. Nhiều trang phục
  có cùng tên chuẩn hóa được đánh số riêng, không gộp danh tính chỉ vì tên hoặc bytes ảnh trùng.
- File ảnh có tên chuẩn hóa, vai trò head/portrait/cover và số thứ tự. Mỗi file nguồn cũ có một
  đường dẫn mới riêng; giữ mọi biến thể và so sánh SHA-256 trước/sau. Ảnh dùng chung giữa tướng và
  trang phục mặc định vẫn là cùng một file/asset, không tạo bản sao chỉ để đổi tên theo từng chỗ dùng.
- Nhãn bậc/chủ đề có mã `<ten>-<thi-truong>-<so>`, ví dụ `ss-plus-vn-1`. Dấu `+` chuyển thành
  token `plus`, không làm mất khác biệt với SS. Mã không phụ thuộc ngôn ngữ giao diện; `vn` chỉ
  thị trường nguồn của bộ ảnh. Các bản dịch sau dùng lại cùng UUID nhãn.
- Tạo nhãn từ admin chỉ nhập tên và thị trường. Backend cấp số trong transaction, khóa namespace
  bằng JPA để hai lần tạo đồng thời không nhận cùng mã. API cũ có thể tiếp tục gửi code tường minh.

## Chuyển đổi dữ liệu đang có

Đây là migration định danh có phạm vi hữu hạn, không phải chức năng sửa tùy ý khóa của bản đã
xuất bản. Flyway lưu alias mã tướng, khóa trang phục và mã nhãn cũ. Đổi đồng bộ các khóa ngoại
trong mọi snapshot, bản dịch và ứng viên ảnh; UUID, revision, thứ tự gameplay, nội dung và ảnh
chính không đổi. Các trigger bảo vệ bản đã xuất bản chỉ tạm ngừng trong transaction migration,
được bật lại trước khi hoàn tất. Kiểm thử xác minh trigger vẫn chặn sửa/xóa sau chuyển đổi.

Import và thao tác ghi section giải alias trước khi đối chiếu/giữ ảnh, nên JSON cũ không tạo thêm
tướng/trang phục/nhãn trùng. Không sửa dữ liệu nguồn thô, ghi chú provenance, audit hay payload job
cũ để giả vờ chúng từng có mã mới. Các khóa đó được phân giải khi áp dụng. Tên file trong metadata
Media và nhãn ứng viên được đổi theo asset UUID; object key `assets/` và bytes trong storage giữ
bất biến theo ADR-006. Không upload lại ảnh chỉ vì đổi tên.

`research/character-images/canonical-identifiers.json` là bảng ánh xạ được lưu cùng mã triển khai.
Script đổi file có bước lập kế hoạch, kiểm tra phạm vi đường dẫn, xung đột và hash; dùng hai pha
để tránh ghi đè khi tên mới trùng tên nguồn khác. Các tham chiếu tài nguyên được đổi cùng file.

## Nguồn đối chiếu tên quốc tế

- [Wukong](https://www.arenaofvalor.com/webplat/info/news_version3/26190/29738/29927/29932/30324/30368/30401/m18175/201708/621136.shtml)
- [Diaochan và Lu Bu](https://www.arenaofvalor.com/webplat/info/news_version3/26190/26191/26192/27180/m16480/201707/618446.shtml)
- [Zanis](https://www.arenaofvalor.com/webplat/info/news_version3/26190/26191/27231/27232/m16887/201701/548857.shtml)
- [Riktor và Jinnar](https://www.arenaofvalor.com/webplat/info/news_version3/26190/33375/33738/33739/m19427/201903/799854.shtml)
