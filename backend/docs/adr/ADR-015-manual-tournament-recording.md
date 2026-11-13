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

## Thao tác ngay trên thanh thời gian khi ghi

Bổ sung 2026-11-12, theo góp ý của người dùng khi ghi Đấu Trường Danh Vọng Mùa Đông 2026: màn ghi khó biết bấm vào
đâu, thao tác nhanh phải nằm ngay trên thanh, trình phát không tắt được phụ đề. Chỉ đổi giao diện Admin; hợp đồng API
và dữ liệu giữ nguyên.

- Ba dải của thanh có nhãn theo ván đang xem: đội xanh, "Mục tiêu" (mục tiêu lớn và khoảnh khắc), đội đỏ. Một dòng
  gợi ý nói rõ bấm, bấm đúp và kéo làm gì ở chế độ hiện tại.
- Chỉ khi người dùng có quyền ghi và đang bật chế độ ghi, thanh mới nhận thao tác sửa. Ngoài chế độ ghi, thanh chỉ
  tua và chọn mốc như trước.
- Ghi tại chỗ: mỗi dải có nút "+" ghi sự kiện tại vị trí video hiện tại; bấm đúp vào một dải ghi tại đúng vị trí
  bấm. Dải của đội mở ô ghi hạ gục, dải giữa mở ô ghi mục tiêu, giây và đội được điền sẵn. Vị trí phải nằm trong một
  ván đã vào trận.
- Kéo mốc của ván đang xem để đổi giây. Sự kiện hạ gục, mục tiêu, khoảnh khắc giữ trong khoảng của ván. Lượt cấm chọn
  giữ giữa lượt trước và lượt sau, trong giai đoạn cấm chọn, đúng các điều kiện dịch vụ đang kiểm tra. Mốc gộp nhiều
  sự kiện và giao dịch trang bị không kéo được.
- Khi kéo, video tua theo vị trí đang kéo để người ghi căn mốc bằng chính khung hình, không phải đoán theo số giây.
  Trình phát được gọi tua vài lần mỗi giây là nhiều nhất; thả xong video đứng ở giây mới, hủy kéo thì quay về vị trí
  cũ. Dời bằng Alt + mũi tên cũng tua theo. Thanh không tự cuộn trong lúc đang kéo. Tua theo không tự phát video:
  video đang dừng thì vẫn dừng; video chưa phát lần nào (YouTube không vẽ khung hình nếu bị dừng ngay) được cho
  chạy tắt tiếng tới khung hình đầu tiên rồi dừng tại đó.
- Thanh chi tiết hiện một khoảng video tính bằng phút hoặc giờ, không còn hệ số phóng 1×–32×. Một buổi phát dài cả
  chục giờ trong khi một ván chỉ vài chục phút, nên khi chưa ai chọn, thanh tự lấy khoảng tròn nhỏ nhất chứa trọn
  ván đang xem cùng vùng cấm chọn của nó (5, 10, 15, 20, 30, 45 phút, 1, 1,5, 2, 4, 8 giờ, hoặc cả video) và đặt ván vào giữa;
  sang ván khác thì thanh theo ván đó. Chưa có ván nào thì hiện khoảng một phần tư video dài. Nút thu, phóng đi
  từng nấc của dãy trên và từ đó thanh giữ khoảng người dùng chọn; "Vừa ván" đưa về khoảng tự chọn, "Toàn video"
  hiện cả video.
- Phóng và thu thanh bằng cử chỉ (bổ sung cùng ngày): giữ Ctrl rồi lăn chuột, chụm hai ngón trên bàn rê, hoặc chụm
  hai ngón trên màn hình cảm ứng. Điểm nằm dưới con trỏ hay giữa hai ngón giữ nguyên chỗ, nên phóng vào đâu thì
  thanh mở ra ở đó. Khoảng hiển thị lúc này đổi liên tục, từ 1 phút tới cả video; hai nút thu, phóng vẫn đi theo
  nấc tròn. Lăn chuột không giữ Ctrl vẫn cuộn trang, vuốt một ngón vẫn cuộn thanh và chạm vẫn là tua.
- Trên điện thoại (bổ sung cùng ngày, sau khi người dùng xem trang ở màn 393 px): đầu trang trận không còn chữ đè
  lên tỷ số (bỏ dãy chấm số ván thắng vì tỷ số đã nói điều đó); hàng công cụ giữ tên từng nút và cuộn ngang thay cho
  các biểu tượng trần; bỏ nút "Phím tắt"; dòng gợi ý của thanh rút còn một dòng nói bằng cử chỉ chạm; ba nút phạm vi
  nằm trên một dòng. Các bảng ghi mở từ dưới lên chỉ cao tới khoảng 62% màn hình để video ghim phía trên vẫn nhìn
  thấy trong lúc ghi. Bảng ngọc hiện từng màu qua ba tab kèm số viên, thay vì ba danh sách nối dài.
- Vùng cấm chọn kết thúc tại mốc chốt đội hình: phần gạch chéo đi từ mốc bắt đầu tới mốc chốt, vì sau khi chốt không
  còn lượt cấm hay chọn nào. Từ mốc chốt tới cờ vào trận là khoảng chờ vào trận, vẽ nhạt và không gạch chéo. Ván
  chưa có mốc chốt thì vùng vẫn kéo tới cờ vào trận (hoặc tới vị trí ước lượng khi chưa vào trận) như trước.
- Mép vùng cấm chọn kéo được (bổ sung cùng ngày, thay cho quyết định ban đầu là chỉ chỉnh trong bảng): mốc bắt đầu
  cấm chọn ở mép trái, mốc chốt đội hình, và cờ vào trận ở mép phải. Giới hạn theo đúng điều kiện dịch vụ kiểm tra:
  bắt đầu cấm chọn không sau lượt đầu, mốc chốt và cờ vào trận, và không lấn vào ván trước; mốc chốt nằm giữa lượt
  cuối và cờ vào trận; cờ vào trận không trước mốc cấm chọn cuối cùng và ván không đè lên ván sau. Sự kiện của ván
  lưu theo đồng hồ ván, nên kéo cờ vào trận dời toàn bộ sự kiện của ván trên video; thông báo sau khi thả nói rõ
  điều đó và có "Hoàn tác". "Video & kết thúc ván" và "Cấm chọn" vẫn đặt được các mốc này bằng vị trí video.
- Mốc "video hiện" của từng đội có trên thanh: lúc video hiện phụ trợ, phù hiệu, bảng ngọc và từng mốc trang bị.
  Mỗi mốc gom các tuyển thủ cùng đội có cùng giây, nằm ở mép dải của đội đó (đội xanh phía trên, đội đỏ phía dưới),
  bấm để tua tới. Kéo mốc đổi giây cho cả nhóm. Mốc trang bị của một tuyển thủ phải theo thứ tự thời gian, nên mốc
  chỉ kéo được giữa mốc trang bị trước và sau của các tuyển thủ trong nhóm.
- Mỗi lần kéo lưu ngay vào bản nháp của ván, hiện giây cũ → giây mới kèm nút "Hoàn tác" trong vài giây. Kéo chưa quá
  vài điểm ảnh vẫn tính là bấm, để không đổi giây do lỡ tay.
- Kết thúc ván không còn bảng riêng. Mốc kết thúc trước đây nhập được ở cả "Video & đồng bộ" lẫn "Kết thúc ván";
  nay bảng video đi từ đầu tới cuối ván: link, mốc vào trận, tạm dừng, rồi khối "Kết thúc ván" gồm đội thắng và mốc
  kết thúc (hoặc thời lượng khi ván chưa có vị trí trong video), lưu bằng một nút và chỉ gửi phần đã đổi. Ván chưa có
  mốc kết thúc được điền sẵn vị trí video hiện tại. Bước "Kết quả" trong bảng tiến độ mở thẳng khối này.
- Trang "Dữ liệu ván" riêng bị bỏ. Trang đó là một biểu mẫu thứ hai cho cấm, chọn, tuyển thủ, phụ trợ, đội thắng,
  thời lượng và video, tức những gì trang trận đã ghi ở "Cấm chọn", "Phụ trợ & ngọc" và bảng video. Phần chỉ có ở đó
  được chuyển về trang trận:
  - bảng "Thông tin ván": thị trường, mùa và patch dùng để đọc danh mục của ván, số ván, ghi chú; lưu bằng một nút,
    chỉ gửi phần đã đổi. Cũng tại đây: gỡ bản công khai của ván (có xác nhận) và xóa ván. Xuất bản vẫn là bước xác
    nhận trong "Tiến độ";
  - trang bị theo mốc và ghi chú của từng tuyển thủ nằm trong bảng "Phụ trợ, ngọc, trang bị", bên cạnh phù hiệu và
    bảng ngọc của tuyển thủ đang chọn.
  Đội của mỗi bên luôn là hai đội của trận; đổi bên xanh/đỏ bằng "Đổi bên" trong "Cấm chọn". Đường dẫn cũ
  `?view=data&game=` mở trang trận tại ván đó với bảng "Thông tin ván".
- Phụ đề được tắt hoặc bật bên trong khung của YouTube, không phải từ trang này. Thử ngày 12/11/2026 trên video của
  giải: gọi API của trình phát (`unloadModule`, đặt track rỗng) và tham số `cc_load_policy` đều không đổi gì; dòng
  chữ còn hiện cả khi YouTube báo đã tắt phụ đề, tức có thể do tiện ích phụ đề trên trình duyệt của người xem chèn
  vào, và nút của tiện ích đó nằm trong hàng nút của YouTube. Vì Admin ẩn hàng nút này, trình phát có nút "Phụ đề"
  để hiện tạm nó: người dùng tắt bằng nút CC hoặc nút của tiện ích, rồi bấm lại để ẩn. Trình phát được tạo lại tại
  đúng giây đang xem, giữ trạng thái phát hoặc dừng.


## Nhập phù hiệu, bảng ngọc và hàng tuyển thủ khi ghi

Bổ sung 2026-11-12, theo góp ý của người dùng khi ghi ván 1 trận Black Mamba – BOX: thêm ngọc và phù hiệu khó thao
tác, có lúc thêm rồi không xóa được, và hàng tuyển thủ ở bảng dưới nên cho xem và sửa ngay tại chỗ. Chỉ đổi giao
diện Admin; hợp đồng API, luật kiểm tra của dịch vụ và dữ liệu giữ nguyên.

Nguyên nhân của "thêm rồi không xóa được", đã tái hiện trên trận chung kết tổng:

- Mỗi thao tác trong bảng gửi cả bản chụp tuyển thủ lấy từ lần vẽ trước. Thao tác thứ hai bấm khi lần lưu thứ nhất
  chưa xong sẽ đè mất thao tác thứ nhất: xóa dòng 3 rồi xóa dòng 1 thì dòng 3 quay lại.
- Bảng chỉ vẽ lại sau khi dịch vụ trả lời, nên giữa hai lần lưu người dùng nhìn dữ liệu cũ.
- Nút "Thêm phù hiệu" tạo một dòng trống cấp I. Dòng trống thứ hai trùng cấp chính nên dịch vụ từ chối, nhưng thông
  báo nằm ở thanh công cụ, bị chính bảng đang mở che mất.

Quyết định:

- Mỗi thay đổi trong bảng là một phép biến đổi trên nội dung mới nhất của ván, vẫn đi qua hàng lưu theo phiên bản
  của ván. Bảng hiện kết quả ngay; khi dịch vụ từ chối, bảng quay về bản đã lưu và nêu lý do ngay trong bảng.
- Phù hiệu và bảng ngọc chọn bằng ô có hình, không còn dòng trống với ô tìm, ô màu, ô cấp và ô số:
  - Bảng ngọc có ba cột Đỏ, Tím, Xanh, mỗi cột đếm số viên trên 10. Mỗi loại ngọc là một ô gồm hình và tên chỉ số,
    đúng chữ video hiện (tên trong danh mục bỏ phần màu và cấp). Chỉ có ngọc cấp III (sửa ngày 2026-11-13: bảng
    ngọc của tuyển thủ chỉ gồm ngọc cấp III nên bỏ nút chọn cấp); ngọc cấp thấp đã ghi từ trước vẫn hiện riêng và bỏ
    được. Bấm một ô lấy hết số viên còn trống của màu đó, tức 10 viên ở lần bấm đầu. Màu đang đủ 10 viên của
    một loại thì bấm loại khác là đổi loại. Màu đã chia cho nhiều loại và đủ 10 viên thì phải giảm một loại trước.
    Nút − và + chỉnh từng viên; giảm về 0 là bỏ loại đó.
  - Phù hiệu chọn nhánh chính trước, rồi mỗi cấp I, II, III một ô. Bấm ô khác cùng cấp là đổi, bấm ô đang chọn là
    bỏ. Chọn ô ở nhánh khác khi nhánh chính đã có phù hiệu thì hỏi xác nhận, vì các ô chính cũ sẽ bị bỏ. Nhánh phụ
    là hai ô cấp I hoặc II của nhánh khác; bảng tự giữ đúng hai cách ghép dịch vụ chấp nhận (cấp I và II của cùng
    một nhánh, hoặc cấp I của hai nhánh), ô mới thay ô không còn ghép được.
- Mức quan sát không còn chọn tay. Chưa ghi gì là "chưa ghi", ghi một phần là "một phần", đủ 30 viên chia 10/10/10
  hoặc đủ ba ô chính và hai ô phụ là "đã rõ". "Nguồn không hiển thị" là một nút bật riêng; bật khi đã có dữ liệu thì
  hỏi xác nhận vì dữ liệu đó bị bỏ.
- Ghi chú của bảng ngọc, phù hiệu và tuyển thủ lưu khi rời ô, không lưu theo từng phím.
- Mục nhập tay từ trước (chỉ có tên, chưa nối danh mục) vẫn hiện trong phần đã chọn và bỏ được.
- Hàng tuyển thủ ở bảng dưới: tên tuyển thủ ở dòng trên; dòng dưới lần lượt là biểu tượng đường (rê chuột hiện tên
  đường), phụ trợ, phù hiệu chính và một vòng ba màu cho bảng ngọc. Rê vào phù hiệu hiện đủ ba ô chính và hai ô phụ,
  ô chưa ghi hiện dấu "?". Rê vào vòng ngọc hiện từng màu với loại ngọc và số viên. Tên tướng không lặp lại vì ảnh
  tướng đã mở thẻ tướng.
- Khi đang ghi, bấm vào phụ trợ, phù hiệu hoặc vòng ngọc của một tuyển thủ mở bảng "Phụ trợ, ngọc, trang bị" đúng
  tuyển thủ và đúng phần đó. Đây là lối tắt vào cùng một bảng, không phải ô nhập thứ hai.
- Hai bảng đội hiện đối xứng khi nằm cạnh nhau (làm thử theo đề nghị của người dùng, cùng ngày): bảng đội đỏ soi
  gương bảng đội xanh. Ảnh tướng nằm ở hai mép ngoài; tên và hàng biểu tượng canh về phía ảnh; KDA và trang bị nằm
  phía trong; ở đầu bảng, hai con số hạ gục đứng sát nhau ở giữa. Thứ tự soi gương cả trong hàng biểu tượng và sáu ô
  trang bị, nên ô gần ảnh tướng nhất của hai đội là cùng một ô. Khi hai bảng xếp chồng trên màn hẹp, cả hai giữ
  cùng một chiều như cũ.

## Ghi tuyển thủ và trang bị từ hàng tuyển thủ

Bổ sung 2026-11-13, theo góp ý của người dùng: trang trận còn nhiều dòng "Chưa ghi tuyển thủ" mà không biết sửa ở
đâu, và phần thêm trang bị khó tìm. Chỉ đổi giao diện Admin; hợp đồng API, luật kiểm tra và dữ liệu giữ nguyên.

Nguyên nhân các dòng trống: khi nhập lịch sử từ Liquipedia, mỗi giải chỉ đọc được đội hình của đội đầu tiên, nên ghế
của các đội còn lại không tìm được tuyển thủ theo vị trí và để trống. Đội hình đăng ký được bổ sung sau, nhưng các ván
đã nhập không tự điền lại. Ô chọn tuyển thủ trước đây chỉ nằm trong bảng "Cấm chọn", ở phần đội hình.

Quyết định:

- Khi đang ghi, ghế chưa có tuyển thủ hiện nút "Ghi tuyển thủ" ở chỗ tên. Bấm mở bảng của tuyển thủ (đổi tên thành
  "Tuyển thủ, ngọc, trang bị") đúng ghế đó. Đầu phần của mỗi ghế là ô chọn tuyển thủ trong đội hình đăng ký của đội ở
  giải: người cùng vị trí lên đầu, đội hình chính trước dự bị, người đã rời ở cuối và có ghi chú. Đội chưa có đội
  hình thì bảng nói rõ cần thêm ở bước "Đội & đội hình".
- Mỗi đội có nút "Điền tuyển thủ theo đội hình" khi còn ghế trống mà đội hình có người đúng vị trí. Nút chỉ điền ghế
  trống, chọn người đội hình chính trước dự bị, không điền người đã rời và không xếp một người vào hai ghế. Nút
  trong bảng "Cấm chọn" dùng cùng luật. Ván có người vào thay vẫn phải sửa tay ghế đó, vì dữ liệu chưa ghi ai thay ai
  ở ván nào.
- Cạnh sáu ô trang bị của mỗi hàng có nút ghi trang bị, mở bảng đúng tuyển thủ ở phần "Trang bị theo mốc". Khi video
  đã đồng bộ, ô thời gian của mốc mới lấy sẵn thời điểm đang xem và có nút lấy lại thời điểm đó.
