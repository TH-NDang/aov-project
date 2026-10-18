# ADR-009 — Import tướng chạy nền bền vững

## Quyết định

Lưu tác vụ import đã xác nhận trong PostgreSQL, xử lý bằng worker trong wiki-service. Không thêm dịch vụ hay hệ thống hàng đợi bên ngoài.

- Trình duyệt đọc JSON/CSV, ánh xạ các trường được phép, xem trước và chuẩn bị ảnh qua Media. Chỉ sau khi `POST /admin/heroes/import/jobs` trả về thành công mới có thể đóng web an toàn.
- Mỗi yêu cầu có UUID do client tạo. Gửi lại UUID với cùng nội dung trả lại tác vụ cũ; khác nội dung báo xung đột. Không lưu token hoặc mật khẩu.
- Tác vụ thuộc issuer + subject lấy từ phiên đã xác thực. Chỉ chủ sở hữu có `hero:write` được đọc tiến trình.
- Worker xử lý từng dòng trong giao dịch riêng, khóa tác vụ bằng `FOR UPDATE SKIP LOCKED`. Dữ liệu tướng và tiến trình commit cùng nhau. Backend dừng giữa giao dịch thì PostgreSQL rollback; lần chạy sau tiếp tục từ số dòng đã commit.
- Lỗi nghiệp vụ của một dòng được lưu riêng sau rollback, rồi tiếp tục dòng kế tiếp. Lỗi cơ sở dữ liệu tạm thời được thử lại. Không tự động thử lại dòng đã báo lỗi cho người dùng.
- Quyền thực hiện được chấp nhận tại thời điểm gửi tác vụ. Worker dùng ngữ cảnh nội bộ chỉ có `hero:write` và `catalog:read`, ghi audit theo người gửi và khôi phục SecurityContext sau mỗi lần chạy. Thu hồi quyền hoặc đăng xuất không hủy lệnh đã được chấp nhận. Không có quyền xuất bản tự động.

## Giới hạn

Thông báo hoàn tất có cờ `notification_dismissed` trên chính tác vụ (V016), đồng bộ theo chủ issuer + subject trên mọi trình duyệt. Chỉ chủ có `hero:write` được đóng; thao tác PUT idempotent, không đóng tác vụ đang chạy và không xóa lịch sử. Trình duyệt dùng cờ backend làm nguồn xác nhận, không tự chuyển dấu đóng cũ trong localStorage thành thao tác server.

Mỗi tác vụ tối đa 200 tướng, nội dung tối đa 5 MB UTF-8. File gốc và bản nháp ánh xạ chưa gửi vẫn chỉ nằm trong trình duyệt. Upload ảnh chưa hoàn tất không chạy tiếp sau khi đóng web. Lịch sử hiện chưa tự xóa; trang hiển thị các tác vụ đang chạy và 20 tác vụ hoàn tất gần nhất. Chưa có chức năng hủy tác vụ.

Worker không gọi storage hay HTTP trong giao dịch. Nó chỉ áp dụng dữ liệu đã chuẩn bị, tham chiếu UUID của ảnh đã hoàn tất upload. Cấu hình `wiki.hero-import.worker-enabled=false` tắt worker khi kiểm thử; mặc định bật, chu kỳ nghỉ giữa các lượt là 1 giây.

## Bổ sung: checkpoint upload

Theo yêu cầu khôi phục khi đóng web, bổ sung hero.upload_session (V015) cho bước chuẩn bị ảnh. Backend lưu manifest và checkpoint, không nhận bytes. Trình duyệt chọn lại gói ảnh nếu thiếu, xác thực SHA-256 và tiếp tục từng ảnh. Mã lượt upload được lưu trước khi gửi bytes; complete idempotent giúp phục hồi khi mất phản hồi. Job dùng UUID của phiên nên gửi lại không nhập trùng. Version kiểm soát các cập nhật đồng thời; Web Locks ngăn cùng phiên chạy ở hai tab cùng origin. Không lưu credentials hoặc presigned URL. Các lượt cũ chưa có checkpoint không khôi phục được.
