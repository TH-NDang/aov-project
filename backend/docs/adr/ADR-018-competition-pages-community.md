# ADR-018 — Hồ sơ công khai, đại diện và quản lý mùa giải

**Trạng thái:** Chấp nhận theo yêu cầu triển khai ngày 01/11/2026.

## Phạm vi

Mở rộng giai đoạn nhập tay của ADR-015 thành quản lý mùa giải, hồ sơ tổ chức/đội/tuyển thủ và cộng đồng.
Người dùng cho phép thiết kế lại giao diện và luồng trong môi trường dev. Không thêm deployable hoặc
đọc chéo database; giữ đăng nhập dùng chung và hồ sơ cá nhân theo ADR-008.

## Quyết định

- Page công khai độc lập tài khoản đăng nhập. Page có loại ORGANIZATION, TEAM hoặc PLAYER; liên kết
  danh tính thi đấu bằng UUID ổn định. Tạo page không tạo tài khoản hoặc tự cấp quyền đại diện.
- Nội dung biên tập có bản nháp và bản xuất bản riêng. Chỉ bản xuất bản xuất hiện công khai; đổi người
  quản lý không thay ID, lịch sử hoặc người theo dõi. Hồ sơ chưa được nhận vẫn có thông tin có nguồn.
- Tài khoản thật nhận quyền đại diện qua yêu cầu được quản trị viên kiểm tra. Bằng chứng yêu cầu riêng
  tư; không suy ra quyền từ tên, đội hình, quan hệ tài trợ hoặc credit ảnh. Claim và độ tin cậy thông tin
  là hai trạng thái độc lập. Quyền OWNER, EDITOR, MODERATOR giới hạn theo page.
- Bài viết/bình luận lưu danh tính công khai và người thao tác riêng; hành động thay mặt page phải kiểm
  tra quyền tại thời điểm ghi. Có theo dõi, thông báo, báo cáo và kiểm duyệt. Thu hồi quyền không xóa page.
- Thành tích, lịch sử thi đấu và đội hình được biên tập có nguồn; quyền truyền thông của page không cấp
  quyền sửa kết quả giải. Dữ liệu ván đã xuất bản tiếp tục đóng băng theo ADR-015.
- Kế hoạch mùa giải quản lý đội tham dự độc lập các trận, giai đoạn có cấu trúc, luật tính điểm, lịch và
  nguồn suất đấu (đội, hạt giống, thắng/thua trận trước). Hỗ trợ lịch chưa xác định đội và lưu nháp từng bước.
- Mẫu AOG gồm vòng tròn hai lượt BO5, top 6, playoffs BO7 nhánh thắng/thua; chọn đối thủ của hạt giống 1
  là thao tác xác nhận. Không suy đoán luật đối đầu hoặc kết quả chưa kiểm chứng.
- Lịch sử thành viên theo thời gian độc lập đội hình đăng ký từng giải. Đổi tên/đội không viết lại snapshot.
- Public ở aov-stream; công cụ biên tập và duyệt ở admin-aov. Đăng nhập cộng đồng dùng Code + PKCE của
  client công khai aov-stream; người dùng thường không được cấp quyền quản trị để tham gia cộng đồng.

## Kiểm chứng

Kiểm thử PostgreSQL cho cách ly nháp/public, phiên bản, claim, quyền theo page, tác giả, thu hồi quyền,
kiểm duyệt và đội tham dự độc lập lịch. Kiểm thử luật xếp hạng, lịch vòng tròn, đường đi nhánh đấu và
nguồn suất chưa xác định. Kiểm tra kiểu dữ liệu, typography, build và các luồng UI trên trình duyệt.
