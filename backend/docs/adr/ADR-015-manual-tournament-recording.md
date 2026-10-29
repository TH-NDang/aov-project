# ADR-015 — Nhập liệu giải đấu và quan sát theo từng ván

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-10-26

## Bối cảnh

Giải đấu bắt đầu được nhập tay từ video và ảnh phát sóng. Mỗi đội cấm bốn, chọn năm tướng; mỗi
người chơi có vị trí, tên tuyển thủ, đội và một phụ trợ. Một số đài không hiển thị phù hiệu/bảng
ngọc. Trang bị có sáu ô nhưng thay đổi trong ván do mua, bán, ghép hoặc đổi vị trí. Một giải có
thể thi đấu qua nhiều mùa/patch; ngày tổ chức giải không đủ để xác định phiên bản của từng ván.

Bộ đặc tả 01 đã đặt giải đấu trong deployable `community-service`; quyết định này triển khai
ranh giới đó, không thêm một dịch vụ cho từng nhóm dữ liệu game.

## Quyết định

- Tạo `backend/community-service`, Java 21/Spring Boot/JPA, database `community` và tài khoản
  riêng. Có thể dùng chung PostgreSQL instance local với wiki; không đọc bảng/entity/repository
  của wiki và không dùng khóa ngoại xuyên database. API có tiền tố `/api/community/v1`.
- Giai đoạn đầu chỉ triển khai nhập liệu và xuất bản giải đấu. Livestream, bình luận, trò chuyện,
  đồng bộ từ nền tảng ngoài và thu nhận dữ liệu tự động chưa thuộc phạm vi này.
- Tách các danh tính giải, đội, tuyển thủ, loạt đấu và ván đấu. Danh tính wiki tham chiếu bằng UUID,
  không dùng tên đã dịch làm khóa. Tên/ảnh và revision của dữ liệu đã sử dụng được đóng băng cùng
  bản công khai; đổi tên đội/tuyển thủ hoặc sửa wiki không viết lại chứng cứ của ván đã xuất bản.
- Mỗi ván sở hữu thị trường, mùa/patch và ngôn ngữ dữ liệu. Mặc định từ giải/loạt chỉ là tiện ích
  nhập; không buộc mọi ván cùng một patch. Chọn riêng mùa được resolver wiki tìm patch công khai
  phù hợp mới nhất của mùa. Khi xuất bản phải lưu UUID patch đã giải quyết, không giải quyết lại
  “mới nhất” mỗi lần người xem mở trang.
- Ván chưa xác định mốc được ghi `unknown=true`; danh mục hiện tại chỉ là dữ liệu quan sát để
  chọn tham chiếu, không phải kết luận các đối tượng đã tồn tại trong một mùa cũ. Dữ liệu nền chưa
  rõ patch chỉ được kèm khi người nhập bật `includeUnscoped`, có nhãn trong bản đã xuất bản.
- Lưu nháp thiếu dữ liệu; kiểm tra đầy đủ khi xuất bản. Bản nháp và bản công khai tách biệt:
  chỉnh nháp sau xuất bản không được lộ lên Stream. Dùng optimistic version để tránh ghi đè
  thay đổi đồng thời. Chỉ public các bản đã xuất bản.
- Phù hiệu/bảng ngọc có trạng thái quan sát riêng: `UNKNOWN` chưa biết, `NOT_SHOWN` nguồn không
  hiển thị, `KNOWN` đã ghi nhận. Không dùng mảng rỗng để suy ra người chơi không mang chúng.
- Trang bị lưu các ảnh chụp trạng thái theo giây trong ván, với sáu ô cố định và thông tin ô trống
  hay chưa quan sát được. Các giao dịch mua/bán/ghép/chuyển ô chỉ ghi như sự kiện khi có chứng
  cứ rõ; không tự suy ra mua/bán từ hai ảnh chụp khác nhau. Cho phép ghi trang bị cấp thấp từ đầu
  và lưu nhiều mốc trong cùng ván, thay vì chỉ có một bộ “đồ cuối”.
- Dữ liệu tham chiếu game đi qua HTTP public API wiki với timeout/cache có giới hạn. Không giữ
  transaction database mở trong lúc gọi wiki. Snapshot công khai chỉ lưu metadata của đối tượng
  thực sự dùng; không sao chép toàn bộ catalog vào mỗi ván.
- Dùng cùng realm Keycloak và BFF đăng nhập hiện có; service mới kiểm tra chữ ký, issuer và
  audience `community-service`. Quyền client riêng là `tournament:read`, `tournament:write`,
  `tournament:publish`. Token không có audience mới bị từ chối, dù có quyền ở wiki.
- `community-editor` có quyền đọc/ghi giải đấu và `catalog:read` tối thiểu để đăng nhập admin;
  `community-publisher` thêm quyền xuất bản; `community-admin` kế thừa. `wiki-admin` kế thừa
  `community-admin` trong môi trường local. Không cấp quyền ghi wiki cho người chỉ biên tập giải.

### Đội hình đăng ký và danh tính tuyển thủ

Tuyển thủ có tên thi đấu, tên khác và ảnh tùy chọn; không lưu một “đội hiện tại” trên danh tính chung. Quan hệ
`roster_membership` gắn giải, đội và tuyển thủ bằng UUID, kèm vị trí có thể chưa rõ, số áo, trạng thái đăng ký,
khoảng ngày và nguồn/mức xác minh. Một quan hệ chỉ đại diện thông tin đăng ký của giải đó, không được suy ra
đội hình ở mọi ván hoặc ghi đè quan hệ tại giải khác. Những trường chưa có bằng chứng giữ chưa rõ.

Quan hệ này được quản trị bằng quyền giải đấu và chưa có danh bạ public. Dữ liệu ván vẫn ghi quan sát thực tế,
được xuất bản bằng snapshot riêng như trước; cập nhật ảnh/tên hay quan hệ đăng ký không sửa snapshot cũ.

## Vận hành và kiểm chứng

Local dùng wiki ở 8080, Keycloak ở 8081, community ở 8082 và Stream ở 5174. Script tạo database
phải idempotent, không xóa volume hoặc đổi password/owner của database đã có. Realm JSON dùng
cho lần import mới; script đồng bộ có phạm vi hẹp dùng cho realm đã tồn tại. Sau đổi quyền,
người dùng đăng nhập lại/làm mới phiên để nhận token mới.

Kiểm thử phải bao phủ quyền/audience, nháp không lộ public, optimistic locking, điều kiện cấm/chọn,
khả dụng của danh mục tại mốc, sáu ô trang bị, dữ liệu không hiển thị và việc đóng băng mùa/patch.
CI riêng chạy Maven verify cho service mới; không tuyên bố chạy integration test nếu Docker không
thực sự chạy. Không thêm Redis/broker hay dịch vụ ngoài cho đợt nhập tay này.

## Dọn dữ liệu biên tập và khôi phục

Đội, tuyển thủ, giải, loạt trận, đội hình đăng ký và ván nháp có thao tác xóa có thể khôi phục.
Xóa chỉ ghi thời điểm/người thao tác, tăng phiên bản và đưa bản ghi vào thùng rác; mã vẫn được giữ
để tránh tạo hai danh tính cho cùng dữ liệu. Danh sách mặc định và danh mục gợi ý chỉ lấy bản đang
hoạt động. Chi tiết quản trị vẫn đọc được bản đã xóa để kiểm tra hoặc khôi phục.

Trước khi xác nhận, UI lấy phiên bản và thống kê các liên kết đang sử dụng. Backend kiểm tra lại
trong transaction khi xóa, trả lỗi xung đột kèm loại/số liên kết nếu dữ liệu đã đổi hoặc còn được
tham chiếu. Không xóa dây chuyền: sửa dữ liệu sai; gỡ liên kết nhập nhầm trước khi xóa hồ sơ trùng.
Tuyển thủ rời đội được ghi vào quan hệ đội hình theo giải, không xóa danh tính tuyển thủ.

Ván từng xuất bản tiếp tục dùng thao tác thu hồi và sửa bản nháp; lịch sử xuất bản không bị xóa
hoặc viết lại. Các bản ghi còn được ván hoặc lịch sử công khai tham chiếu được bảo vệ. Khôi phục
kiểm tra lại các danh tính cha cần thiết. Ảnh trên Media/R2 có vòng đời riêng; xóa hồ sơ không
đồng nghĩa xóa ảnh đang có thể được nhiều nơi sử dụng.

Các thao tác ghi dùng cùng một khóa transaction phạm vi đồ thị tham chiếu giải đấu trong PostgreSQL,
để việc tạo liên kết không chạy lọt giữa kiểm tra sử dụng và xóa. Khóa này chỉ bao quanh công việc
database nhập tay; không giữ khóa trong lúc gọi Wiki, upload ảnh hay chờ dịch vụ ngoài.

## Dòng thời gian ván gắn video chính thức

Bổ sung 2026-10-28. Mỗi ván có `timeline` trong nội dung nháp: các mốc hạ gục (người hạ, người bị hạ, hỗ trợ theo
vị trí), mục tiêu lớn, ghi chú khoảnh khắc và các đoạn tạm dừng kỹ thuật của buổi phát. Dữ liệu dùng chung khóa phiên
bản lạc quan với phần còn lại của ván và được đóng băng trong snapshot khi xuất bản; sửa sau đó chỉ vào bản nháp.

Video chỉ được tham chiếu bằng link YouTube chính thức và giây bắt đầu ván; thời điểm trận được quy đổi sang video ở
client dựa trên các đoạn tạm dừng. Không lưu, cắt hay phát lại video trên hạ tầng dự án.

Giao dịch trang bị tiếp tục nằm trong `equipmentEvents` của tuyển thủ, không nhân đôi vào `timeline`. Mốc không có
bằng chứng rõ (ví dụ chưa thấy người hạ gục) giữ trống thay vì suy đoán. Vì dữ liệu nằm trong cột `jsonb` hiện có,
không cần migration; ván cũ đọc thành dòng thời gian rỗng.

## Giai đoạn cấm chọn và luật chọn tướng trong loạt

Bổ sung 2026-10-28. Mỗi ván có `draft`: giây video bắt đầu cấm chọn, các lượt cấm/chọn theo thứ tự (đội, tướng, giây
video tùy chọn) và giây video chốt đội hình. Lượt chọn thuộc về đội chứ không thuộc tuyển thủ vì sau khi chọn, các
tuyển thủ cùng đội còn hoán đổi tướng; đường và tuyển thủ chỉ được gán sau mốc chốt. Mốc dùng giây video thay vì
giây trước lúc vào trận để có thể ghi ngay khi đang cấm chọn và không bị kéo lệch khi chỉnh lại mốc vào trận.

Cấm/chọn cuối cùng trong `sides` vẫn là dữ liệu dùng cho xuất bản và thống kê; khi có lượt, dịch vụ kiểm tra cấm/chọn
cuối cùng phải lấy từ các lượt đó. Khi lưu, dịch vụ áp luật của loạt BO: ngoài ván cuối cùng có thể, một đội không chọn
lại tướng mình đã chọn ở ván khác của loạt. Không cần migration; ván cũ đọc thành giai đoạn cấm chọn rỗng.

