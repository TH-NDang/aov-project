# Quản lý thi đấu và page cộng đồng

Phần mở rộng đặc tả 01/02/03 theo ADR-018, được người dùng chấp nhận ngày 01/11/2026.
Áp dụng cho community-service; không thay hợp đồng Wiki hay snapshot ván của ADR-015.

## Luồng sử dụng

Admin có sáu bước: tổng quan → đội & đội hình → thể thức → lịch & kết quả → chung cuộc → công bố
(xem "Không gian giải đấu trong Admin" bên dưới). Đội tham dự độc lập trận đấu. Page tổ chức, đội, tuyển thủ có thể được tạo trước. Tạo page TEAM/PLAYER
không có entityId sẽ tạo danh tính thi đấu tương ứng; một danh tính chỉ gắn một page cùng loại.

Trong bước thông tin giải, biên tập viên chọn hoặc tạo nhanh hồ sơ ORGANIZATION ngay tại chỗ.
Tạo nhanh lưu nháp hồ sơ và chọn vào bản nháp giải, không chuyển khỏi màn hình hay tự công bố.
Tên tổ chức không nhập riêng: khi có organizerPageId, backend xác minh loại hồ sơ và lấy tên/logo
từ hồ sơ tổ chức. Snapshot giải có organizer {id,code,name,logoUrl,published}. Lưu/đọc nháp dùng
thông tin nháp mới nhất; công bố dùng thông tin đã công bố của tổ chức và chặn nếu tổ chức còn nháp.
Thay đổi tổ chức không viết lại snapshot giải cũ. organizer dạng chữ được giữ để đọc dữ liệu trước
đây chưa liên kết; giao diện mới dùng lựa chọn hồ sơ thay cho ô nhập tên tự do.

Mẫu AOG: vòng tròn hai lượt BO5 (9 đội = 72 trận, 18 vòng, mỗi vòng một đội nghỉ); playoffs 6 đội BO7,
8 trận nhánh thắng/thua và chung kết tổng. Hạt giống 1 chọn gặp hạt giống 3 hoặc 4. Mẫu là điểm bắt đầu
biên tập: nguồn điều lệ, tiêu chí phụ và nhánh xuống của đội 5/6 phải được đối chiếu trước công bố.
Không coi mẫu là chứng nhận điều lệ chính thức.

Suất đấu có loại TEAM, SEED, WINNER, LOSER, TBD. Tham chiếu thắng/thua chỉ trỏ về trận đứng trước;
không tạo đội giả. Materialize tạo loạt trận thật cho cặp đã xác định và không tạo trùng khi gọi lại.
Đổi lịch/tên/giai đoạn kế hoạch đồng bộ loạt trận đã liên kết. Khi kết quả trước đó làm lệch cặp ở
vòng sau, chặn mở trận/công bố và yêu cầu biên tập viên kiểm tra, không tự sửa kết quả đã nhập.

Xếp hạng theo điểm thắng/thua rồi áp dụng lần lượt HEAD_TO_HEAD, GAME_DIFF, GAME_WINS đã cấu hình.
Đối đầu chỉ áp dụng khi đủ các lượt giữa nhóm đang bằng điểm. Vẫn bằng nhau thì cùng hạng; không
dùng tên hay UUID phân thắng thua. Chỉ xác nhận suất đi tiếp khi đủ toàn bộ cặp/lượt và cả nhóm đồng
hạng nằm trong số suất cho phép. Bảng chưa đủ trận luôn có nhãn tạm tính.

Giải có bản nháp và snapshot công bố chứa thông tin giải, kế hoạch, đội, tuyển thủ, đội hình, loạt trận,
suất đã giải quyết và bảng xếp hạng. Sửa nháp không đổi snapshot. Công bố cần ít nhất hai đội, một
giai đoạn và URL nguồn; đội hình, lịch và kết quả có thể bổ sung sau. Lưu/công bố/thu hồi có revision.

### Không gian giải đấu trong Admin (12/11/2026)

Người dùng chọn Đấu Trường Danh Vọng Mùa Đông 2026 làm giải đầu tiên ghi chi tiết và duyệt bố cục mới ngày
12/11/2026. Thay đổi chỉ ở giao diện Admin; không thêm endpoint hay migration.

| Bước | Nội dung |
|---|---|
| Tổng quan | Thông tin giải, tổ chức, hệ thống giải, địa điểm; việc nên làm tiếp và tiến độ ghi nhận |
| Đội & đội hình | Gộp hai bước "đội tham dự" và "đội hình": mỗi đội một khối có logo, trạng thái tham dự và đội hình ở giải này vẽ ra ngay (năm vị trí chính thức có ảnh và tên tuyển thủ, rồi dự bị, người đã rời); sửa đội hình mở bảng riêng. Biểu tượng bút ở dòng đội mở bảng sửa bản ghi đội và bản ghi các tuyển thủ trong đội hình của giải (18/11/2026), là nơi duy nhất sửa các bản ghi này từ khi màn Registry cũ bị bỏ |
| Thể thức | Mỗi giai đoạn một thẻ tóm tắt; chọn thẻ mới mở phần sửa |
| Lịch & kết quả | Tab theo giai đoạn. Vòng tròn: trận gom theo vòng hoặc theo ngày, bảng xếp hạng nằm cạnh. Loại trực tiếp và nhánh thắng/thua: sơ đồ nhánh dựng từ suất WINNER/LOSER |
| Chung cuộc | Thứ hạng chung cuộc, tiền thưởng và giải thưởng của giải (`placements`, `awards`, `links`) |
| Công bố | Mục bắt buộc và mục nên bổ sung, nội dung sẽ công bố, thay đổi chưa công bố |

Đường dẫn `?step=` nhận tên bước `overview`, `teams`, `format`, `schedule`, `final`, `publish`; số 0–5 của
bố cục cũ vẫn đọc được (1 và 2 cùng mở "Đội & đội hình").

Chống sửa nhầm: dữ liệu hiển thị ở dạng chỉ đọc; ô nhập chỉ mở sau thao tác "Sửa" hoặc "Nhập" và có Lưu/Hủy.
Ghi đè một giá trị đã có (tỷ số, hạt giống) và mọi thao tác xóa phải xác nhận, hộp xác nhận nêu giá trị cũ → mới.
Trang công khai chỉ đổi khi công bố.

Tỷ số của loạt trận đã liên kết nhập ngay trong bước "Lịch & kết quả", cùng nguồn kết quả, mức xác minh và link
video của trận (`sourceUrl` của loạt trận, xem "Dữ liệu giải lịch sử"). Quy tắc tỷ số theo BO giữ nguyên. Tỷ số
không tự suy ra từ đội thắng các ván. Trận chưa có loạt trận thật hiển thị suất chờ ("Thắng …", "Thua …") và chỉ
nhập được kết quả sau khi materialize.

Giải đang diễn ra dùng cùng màn hình: công bố sớm rồi công bố lại sau mỗi ngày đấu. Khi giải đã công bố, Admin so
bản nháp với snapshot công khai và liệt kê "thay đổi chưa công bố" (tỷ số mới hoặc đổi, lịch đổi, trận thêm/bớt,
đội tham dự, thể thức, thông tin giải); nút cập nhật bản công bố có ở đầu trang của mọi bước. Mỗi lần công bố
vẫn chụp toàn bộ giải, không công bố riêng từng trận. Bảng xếp hạng chưa đủ trận giữ nhãn tạm tính.

Bước "Công bố" tách mục bắt buộc (nguồn kiểm chứng, ít nhất hai đội, ít nhất một giai đoạn, tổ chức đã công bố
nếu có liên kết) khỏi mục nên bổ sung (đội hình, lịch, giờ đấu, kết quả khớp suất, kết quả đủ, thứ hạng chung
cuộc). Mục nên bổ sung không chặn công bố.

### Luật và phiên bản của giai đoạn (23/11/2026)

Người dùng chọn cách này ngày 23/11/2026. Ô chữ `patchNote` ("Phiên bản / quy tắc cấm chọn") của giai đoạn gộp hai
việc và không liên kết được tới Wiki, nên được thay bằng các trường có cấu trúc. Chưa giai đoạn nào ghi `patchNote`
(0/714 trên dữ liệu thật ngày 23/11/2026); migration bỏ khóa này khỏi kế hoạch đã lưu.

| Trường | Giá trị |
|---|---|
| `draftRule` | `GLOBAL`: cấm chọn toàn cục, đội không chọn lại tướng đã dùng trong loạt (luật hiện có ở 01, kể cả ngoại lệ ván cuối). `STANDARD`: cấm chọn thường, đội được chọn lại tướng. Bỏ trống là chưa ghi |
| `sideSelection` | `HOME_FIRST_THEN_LOSER`: đội đứng trước trong lịch đấu chọn bên ván 1, các ván sau đội thua ván trước chọn. `OTHER`: cách khác, ghi ở `rulesNote`. Bỏ trống là chưa ghi |
| `rulesNote` | Luật khác của giai đoạn, tối đa 2000 ký tự |
| `patches` | Tối đa 30 dòng phiên bản dùng trong giai đoạn, theo thứ tự thời gian |

Mỗi dòng phiên bản có `label` (khoảng áp dụng, ví dụ "Tuần 2–4"), `releasedOn` (ngày bản cập nhật có hiệu lực theo
nguồn), `name` (tên bản cập nhật), `patchId` (patch của Wiki), `seasonId` và `seasonName` (mùa xếp hạng của Wiki, ví dụ
"S4 2026"), `sourceUrl` (bài cập nhật chính thức của nhà phát hành, ví dụ trang patch notes của Garena) và `note`
(ngoại lệ, ví dụ tướng mới được phép dùng). Một dòng cần ít nhất `patchId`, `releasedOn` hoặc `sourceUrl`.

Liên kết tới Wiki là tham chiếu mềm: community-service không gọi Wiki khi lưu kế hoạch. Admin chọn patch và mùa từ danh
sách của Wiki. Khi Wiki chưa có bản đó, dòng giữ ngày, tên và bài viết chính thức, Admin gắn nhãn "Chưa có trong Wiki"
và gợi ý liên kết khi Wiki có patch cùng ngày (mã patch của Wiki là ngày `yyyy-mm-dd`). `seasonName` được lưu kèm để
Stream hiển thị mà không gọi Wiki.

`draftRule` là luật của giai đoạn; mỗi loạt trận vẫn giữ `repeatPicksAllowed` riêng. Loạt trận do materialize tạo mới
nhận `repeatPicksAllowed = true` khi giai đoạn của nó là `STANDARD`, còn lại giữ mặc định áp dụng luật. Loạt trận đã
có không bị đổi.

Admin hiện luật và phiên bản trong thẻ giai đoạn ở bước "Thể thức" và cho sửa trong phần sửa giai đoạn. Stream hiện
chúng trong phần thể thức của trang giải.

### Tên trận theo mã (18/11/2026)

Người dùng chọn cách này ngày 18/11/2026 để tên trận do lịch tự động sinh ra hiển thị đúng ngôn ngữ người đọc. Trận
trong kế hoạch và loạt trận có thêm `title` {kind, leg, round, number}: mã cho biết trận là gì trong giai đoạn, kèm các
số cần thiết. Ứng dụng đọc (Admin, Stream) viết tên từ `title` bằng ngôn ngữ người đọc, không đọc chữ để quyết định
hiển thị. `label` của trận và `name` của loạt trận là tên biên tập viên tự đặt, không bắt buộc; khi có thì hiển thị thay
cho `title`. Đổi tên không bỏ `title`, xóa tên thì trận lại hiển thị theo `title`.

| kind | Số | Tiếng Việt | Tiếng Anh |
|---|---|---|---|
| ROUND_ROBIN | `leg`, `round` | Lượt 1 · Vòng 2 | Leg 1 · Round 2 |
| UPPER_SEMIFINAL | `number` | Bán kết nhánh thắng 1 | Upper bracket semifinal 1 |
| UPPER_FINAL | — | Chung kết nhánh thắng | Upper bracket final |
| LOWER_ROUND | `round`, `number` | Vòng 1 nhánh thua · 2 | Lower bracket round 1 · 2 |
| LOWER_SEMIFINAL | — | Bán kết nhánh thua | Lower bracket semifinal |
| LOWER_FINAL | — | Chung kết nhánh thua | Lower bracket final |
| GRAND_FINAL | — | Chung kết tổng | Grand final |
| EXTRA | — | Trận bổ sung | Additional match |

- Lịch tạo tự động (vòng tròn, mẫu playoffs AOG) chỉ có `title`, không có `label`. Trận Admin thêm thủ công có `title`
  EXTRA.
- `title` phải có `kind`; `leg`, `round`, `number` nếu có thì từ 1 đến 99. Sai trả 400 `TOURNAMENT_INVALID_CONTENT`, ở
  kế hoạch lẫn ở loạt trận.
- Lưu kế hoạch đồng bộ `label` sang `name` và `title` sang `title` của loạt trận đã liên kết; materialize tạo loạt trận
  có cả hai.
- Suất TBD không còn bắt buộc nhãn. Suất chưa có nhãn được ứng dụng viết là "Chưa xác định" / "TBD"; Admin không ghi
  sẵn "Đội A", "Đội B" nữa.
- Snapshot công bố, lịch sử kế hoạch và snapshot ván đã chụp trước đây không có `title`; ứng dụng hiển thị tên đã lưu
  trong đó cho tới lần công bố sau.

## Page và quyền đại diện

### Tham chiếu hồ sơ (03/11/2026)

Loại `CIRCUIT` mô tả hệ thống giải xuyên nhiều mùa, ví dụ Đấu Trường Danh Vọng; không tạo danh tính đội hay
tuyển thủ. Hồ sơ có giới thiệu, ảnh, liên kết, lịch sử, nguồn và tab các mùa giải; không có đội hình hoặc thành tích
thi đấu. Đây là trang thông tin biên tập, không phải danh tính cộng đồng. Quyền biên tập/công bố thuộc admin;
không nhận đại diện, bàn giao, thành viên quản lý, lớp trình bày của đại diện, bài viết hoặc theo dõi.
Public có Tổng quan, Các mùa giải và Lịch sử; vẫn xem nguồn và gửi đề xuất chỉnh sửa. Danh bạ vẫn tìm được
hệ thống giải; gợi ý theo dõi, danh sách đang theo dõi/quản lý và bảng tin loại CIRCUIT.
API chặn thao tác cộng đồng bằng 403 PAGE_ACTION_FORBIDDEN, kể cả gọi trực tiếp; bỏ theo dõi cũ vẫn được phép.
Dữ liệu cộng đồng cũ được giữ, không tự xóa; không áp dụng lớp trình bày cũ lên nội dung hệ thống giải.
Thuật ngữ giải thích (BO5, nhánh thắng/thua…) thuộc kho thuật ngữ, không tự tạo hồ sơ cộng đồng.

Kênh thông tin của CIRCUIT là tùy chọn, nằm trong Thông tin chung; header không hiển thị icon mạng xã hội
chưa có liên kết. Website, kênh phát sóng và mạng xã hội riêng lưu trong `links`; nguồn đối chiếu vẫn ở
`sources`. `channelOrganizationId` tùy chọn tham chiếu một ORGANIZATION cung cấp kênh chung, không sao chép
URL hoặc cấp quyền đại diện. Chỉ CIRCUIT nhận trường này; backend kiểm tra tổ chức tồn tại khi lưu và đã
công bố khi công bố hệ thống giải. Tham chiếu trong nháp/công bố chặn xóa nháp tổ chức. Public đọc tổ chức
qua API công khai và dẫn tới trang tổ chức; nếu tổ chức được thu hồi thì hiển thị trạng thái chưa công bố.
Thay đổi lựa chọn trong nháp không đổi tham chiếu công khai cho đến lần công bố tiếp theo.

Kế hoạch mùa giải thêm `circuitPageId` tùy chọn, chỉ nhận hồ sơ CIRCUIT. Backend lấy tên từ hồ sơ thay vì tin
chuỗi `circuit` gửi lên; snapshot thêm `circuit {id,code,name,logoUrl,published}`. Bản nháp dùng hồ sơ nháp,
công bố dùng hồ sơ đã công bố và chặn nếu hồ sơ còn nháp. Tên chữ cũ vẫn đọc được khi chưa có tham chiếu.
Tham chiếu đã lưu trong kế hoạch hoặc revision chặn xóa hồ sơ; thay đổi hồ sơ không viết lại snapshot cũ.

GET `/admin/competitions` và `/competitions` nhận bộ lọc `circuitPageId`, lần lượt lọc bản nháp và snapshot
công bố. Admin tìm/chọn hoặc tạo nhanh hồ sơ trong popup; bấm tên có tham chiếu mở giới thiệu nhanh rồi mới
chọn mở trang đầy đủ. Tạo nhanh chỉ lưu hồ sơ nháp; chọn vào giải vẫn cần lưu bản nháp giải.

Nguồn ảnh của Wiki có thể lưu `ownerPageId` và `relatedPageId` để nối hồ sơ chủ sở hữu và nội dung ảnh nhắc
tới. Đây là UUID tham chiếu mềm giữa hai dịch vụ, không truy cập chéo database, không cấp quyền đại diện và
không xác minh bản quyền. Khách chỉ đọc được hồ sơ đã công bố; tham chiếu hỏng hoặc chưa công bố vẫn giữ
tên ghi công và URL nguồn ảnh độc lập. Chi tiết lưu nguồn ảnh theo đặc tả 02/03 và ADR-017.

Nhân sự thi đấu (02/11/2026): bổ sung loại PERSON cho huấn luyện viên và ê-kíp broadcast. PERSON không
tạo danh tính tuyển thủ giả và không nhận entityId. PLAYER giữ hợp đồng danh tính thi đấu hiện có.
`PageContent.personRoles` là danh sách vai trò nghề nghiệp: COACH, TEAM_ANALYST, HOST, INTERVIEWER,
CASTER, GUEST_ANALYST; độc lập vai trò quản lý trang OWNER/EDITOR/MODERATOR. PERSON cần ít nhất một vai trò;
PLAYER có thể thêm các vai trò này trên cùng hồ sơ; TEAM/ORGANIZATION không nhận vai trò nhân sự. Dữ liệu
cũ thiếu danh sách được đọc thành rỗng. Một người kiêm nhiều vai trò dùng chung page, lịch sử và quyền đại diện.
Danh sách admin/public nhận `personRole`: một mã vai trò hoặc nhóm COACHING (COACH, TEAM_ANALYST),
BROADCAST (HOST, INTERVIEWER, CASTER, GUEST_ANALYST). Bộ lọc public chỉ đọc vai trò đã công bố.
Admin có tab Tuyển thủ, Ban huấn luyện và Broadcast; vai trò được chọn từ danh sách trong form tạo/sửa.
PERSON có thông tin, hoạt động/sự nghiệp, nguồn và quyền đại diện; không mặc định hiện thành tích hay trận đấu.
Thông tin từ đội hình của một giải được ghi rõ tên giải, trạng thái chính thức/dự bị/đã rời đội và nguồn;
không suy diễn ngày gia nhập/rời đội từ ngày diễn ra giải. Nhân sự broadcast được ghi sự kiện trong lịch sử
hoạt động, không tự liên kết vào một mùa giải chưa được tạo trong ứng dụng. Từ 19/11/2026, giải đã có trong ứng dụng
ghi ê-kíp phát sóng và ban huấn luyện bằng liên kết tới hồ sơ (xem "Liên kết giữa các bản ghi thi đấu").

Page ORGANIZATION, TEAM, PLAYER, PERSON độc lập tài khoản và không giữ mật khẩu. Tài khoản dùng issuer + subject
của JWT. Page chưa có đại diện vẫn có thông tin biên tập, nguồn, lịch sử và người theo dõi.

PageContent: tên, tên ngắn, quốc gia, giới thiệu, avatar, cover, links, sources, history, achievements,
roster. Mỗi link có thể đánh dấu `official` (kênh do chính tổ chức/đội/tuyển thủ vận hành); nội dung cũ
không có trường này được coi là không chính thức. History/roster có ngày bắt đầu/kết thúc, vai trò, nguồn và UUID page liên quan; achievement có
UUID mùa giải. Bản nháp riêng bản xuất bản; công bố cần ít nhất một nguồn. Đại diện có lớp trình bày
riêng (giới thiệu, ảnh, liên kết), không được sửa thành tích, lịch sử, đội hình hay kết quả biên tập.

Thứ hạng của thành tích (18/11/2026): `placement` là chữ hiển thị đúng như biên tập viên viết ("Vô địch", "Champion",
"MVP"). Thứ hạng lưu riêng bằng số, cùng cách ghi hạng với `placements` của giải: `place` là hạng chung cuộc (1 là vô
địch, 2 là á quân), `placeTo` là hạng cuối của một hạng đồng hạng ("5-8" là `place` 5, `placeTo` 8); `award: true` đánh
dấu giải thưởng cá nhân (MVP, tuyển thủ xuất sắc), không có hạng. `place` từ 1 đến 999; `placeTo` chỉ có khi có `place`,
lớn hơn `place` và tối đa 999; giải thưởng cá nhân không có `place`. Sai trả 422 PAGE_INVALID_CONTENT.

Stream chọn dấu của mỗi giải (cúp cho vô địch, số hạng, dấu giải thưởng) theo hạng tốt nhất đã lưu. Thành tích cũ chưa có
thứ hạng được đọc từ chữ bằng một hàm dùng chung của `@aov/community-contracts`, hiểu cả tiếng Việt và tiếng Anh ("Vô
địch", "Champion", "1st", "Á quân", "Runner-up", "Hạng 3", "3rd", "Hạng 5-8", "5th–8th", "Top 8" là hạng 5–8); chữ
không đọc được coi là giải thưởng như trước. Admin chọn thứ hạng trong form thành tích. Người đại diện không sửa thành
tích nên Stream không có ô nhập.

Nội dung giao diện phân theo loại hồ sơ: ORGANIZATION có giới thiệu, lịch sử hoạt động và giải đấu tổ chức;
TEAM có đội hình/ban huấn luyện, lịch sử và thành tích; PLAYER có sự nghiệp và thành tích. Tổ chức không
hiển thị hoặc cho nhập đội hình/thành tích thi đấu; dữ liệu cũ vẫn giữ nguyên khi lưu các mục khác.
Người quản lý trang thuộc quyền đại diện, độc lập với đội hình thi đấu. Bài viết, theo dõi, nguồn thông tin
và quyền đại diện vẫn dùng chung. Giải đấu tổ chức được lấy từ liên kết organizerPageId: admin dùng liên kết
trong bản nháp và thấy cả mùa giải chưa công bố; public chỉ dùng liên kết trong snapshot đã công bố.

Claim có bằng chứng riêng tư, người có tournament:read + tournament:publish duyệt; không tự duyệt.
Một OWNER/page. Owner mời EDITOR/MODERATOR bằng mã một lần, hạn 7 ngày; DB chỉ lưu SHA-256.
Chuyển owner cho thành viên đã thêm, owner cũ thành editor. Quản trị viên thu hồi owner thì thu hồi
cả người được ủy quyền và thư mời. Page/lịch sử/người theo dõi vẫn được giữ lại.

Bàn giao page (02/11/2026): page do AthaHub quản lý qua admin cho đến khi tổ chức, đội hoặc tuyển thủ liên
hệ; không tạo hay chia sẻ tài khoản, mật khẩu cho page. Sau khi xác minh qua kênh chính thức của họ, người có
tournament:read + tournament:publish tạo mã bàn giao OWNER dùng một lần, hạn 7 ngày, cho page đã công bố và
chưa có owner. Mã chỉ hiển thị một lần (DB lưu SHA-256); tạo mã mới hoặc hủy mã thì mã cũ hết hiệu lực. Người
nhận đăng nhập bằng tài khoản của chính họ và nhận mã qua /me/invitations/accept để thành OWNER. Khi page đã
có owner, mã bàn giao không dùng được nữa.

OWNER/EDITOR được viết thay page và sửa trình bày. OWNER/MODERATOR ẩn/khôi phục bài, ẩn bình luận.
Người thường viết bằng danh tính cá nhân, theo dõi, bình luận, báo cáo. Không đổi danh tính tác giả khi
sửa bài. Tác giả sửa bài cá nhân, người có quyền viết page sửa bài page. Bài đã kiểm duyệt không được
tự xuất bản lại. Bản nháp cá nhân không hiển thị cho người khác. Thông báo nội bộ cho bài page mới,
bình luận, xử lý yêu cầu và thay đổi quyền; không gửi email. Quyền page không cấp quyền quản trị giải.

Nội dung thông báo (18/11/2026): backend không lưu câu chữ của thông báo. Mỗi thông báo lưu `kind` và `parameters`;
ứng dụng của người đọc viết câu bằng ngôn ngữ người đọc chọn (Stream có tiếng Việt và tiếng Anh) và không đọc câu chữ để
quyết định hiển thị.

| kind | Khi nào | parameters |
|---|---|---|
| PAGE_POST_PUBLISHED | Page đang theo dõi đăng bài với tư cách page | `pageName` |
| PAGE_LIVE_STARTED | Page đang theo dõi bắt đầu phát trực tiếp | `pageName`, `title` |
| POST_COMMENTED | Người khác bình luận bài của mình | — |
| REPORT_RESOLVED | Báo cáo của mình đã được xử lý | — |
| PAGE_CLAIM_APPROVED, PAGE_CLAIM_REJECTED | Yêu cầu quản lý trang được chấp thuận / không được chấp thuận | — |
| PAGE_OWNERSHIP_RECEIVED | Nhận quyền OWNER bằng mã bàn giao hoặc được chuyển owner | — |
| PAGE_MEMBERSHIP_REVOKED | Bị thu hồi quyền quản lý trang | — |

`pageName` là tên công bố của page lúc gửi, không đổi khi page đổi tên sau đó; `title` là tiêu đề buổi phát. Mỗi loại
có đúng các tham số trong bảng. Thông báo gửi trước V018 không có `kind` và giữ câu đã lưu trong `message`; ứng dụng
hiển thị câu đó như trước. Loại mà ứng dụng chưa biết thì hiển thị `message` nếu có, nếu không thì một câu chung.

Thích bài viết (02/11/2026): tài khoản đã đăng nhập thích/bỏ thích bài đã đăng của page công khai, mỗi
tài khoản tối đa một lượt mỗi bài; gửi lại cùng trạng thái không đổi gì. Bài trả số lượt thích; `liked`
chỉ đúng với người xem đã đăng nhập (danh sách công khai luôn false). Danh sách người thích không công
khai và lượt thích không tạo thông báo. Bài bị ẩn giữ nguyên lượt thích nhưng không nhận lượt mới.

Bảng tin cộng đồng (02/11/2026): khách chưa đăng nhập vẫn đọc được bảng tin chung gồm bài đã đăng của mọi
page công khai (mới nhất trước), bài và bình luận của từng page. Mỗi mục bảng tin kèm thẻ page (mã, loại, tên,
avatar theo bản trình bày, có đại diện hay không). Mọi bài trả kèm số bình luận đang hiển thị. Chỉ tài khoản đã
đăng nhập mới có bảng tin cá nhân (cùng nội dung nhưng `liked`/`own` đúng với người xem, lọc được theo các page
đang theo dõi), danh sách page đang theo dõi, gợi ý page để theo dõi và số thông báo chưa đọc. Gợi ý chỉ gồm page
công khai mà tài khoản chưa theo dõi và không quản lý, nhiều người theo dõi trước. Bảng tin không gồm bản nháp
(bản nháp cá nhân vẫn chỉ ở /me/pages/{id}/feed), bài bị ẩn hay page đã thu hồi. Đánh dấu tất cả thông báo đã đọc
chỉ ảnh hưởng hộp thông báo của chính tài khoản.

Bài viết nhiều dạng (03/11/2026): bài có `kind` TEXT (mặc định), NEWS (bắt buộc tiêu đề tối đa 200 ký tự)
hoặc VIDEO (bắt buộc `videoUrl` http/https; nội dung được để trống). TEXT và NEWS bắt buộc nội dung. Mỗi bài
có tối đa 4 ảnh (`imageUrls`, URL http/https). Ảnh trong kho được giữ như ảnh của page: không gắn được ảnh đã
thu hồi, và ảnh đang được bài viết (kể cả bài bị ẩn hoặc bản nháp) dùng thì không thu hồi được. Bài cũ được coi
là TEXT. Bảng tin công khai, bảng tin cá nhân và danh sách bài của page lọc được theo `kind`; bảng tin công khai
tìm được theo `q` trong tiêu đề và nội dung.

Ghim bài (03/11/2026): OWNER/EDITOR của page hoặc người có tournament:write ghim một bài đã đăng với tư cách
page. Mỗi page ghim tối đa một bài; ghim bài mới thì bài cũ bỏ ghim. Bài ghim đứng đầu danh sách bài của page,
không ảnh hưởng thứ tự bảng tin chung. Bài bị ẩn hoặc đưa về nháp thì tự bỏ ghim.

Trạng thái trực tiếp (03/11/2026): OWNER/EDITOR hoặc người có tournament:write bật trực tiếp cho page đã công
bố với {url,title}; url http/https, title tối đa 200 ký tự. Hồ sơ công khai trả `live` {url,title,startedAt}
khi đang phát; trạng thái tự hết sau 12 giờ nếu không tắt. Bật khi page đang không phát thì gửi thông báo nội
bộ cho người theo dõi; đổi link hay tiêu đề khi đang phát thì không gửi lại. GET /live liệt kê page công khai
đang phát, mới bắt đầu trước. Stream không tự kiểm tra với YouTube/Facebook; người bật chịu trách nhiệm link.

Xóa hồ sơ nháp (02/11/2026): chỉ hồ sơ chưa từng công bố, chưa có người đại diện, yêu cầu nhận, thư mời,
bài viết, người theo dõi, báo cáo hay thông báo, và không được kế hoạch giải nào tham chiếu. Xóa cả lịch sử
thao tác của hồ sơ và giải phóng đường dẫn; ứng dụng ghi log người xóa. Các trường hợp khác trả 409
PAGE_CONFLICT; hồ sơ đã công bố chỉ được thu hồi. Danh tính đội/tuyển thủ tạo kèm page không bị xóa theo.

Bằng chứng claim, actor, token mời, audit không có trong API công khai. Ảnh còn được page hoặc lịch
sử giải tham chiếu bị chặn retire. Danh tính còn gắn page/kế hoạch/snapshot bị chặn xóa theo cơ chế hiện có, trừ
page nháp và kế hoạch của giải ở thùng rác nêu ngay dưới đây.

Đưa danh tính vào thùng rác (19/11/2026): page TEAM/PLAYER là một phần của danh tính nó đại diện khi page chưa từng
công bố, không có người đại diện, yêu cầu nhận, thư mời, bài viết, người theo dõi, báo cáo hay thông báo, và không nằm
trong đội hình của page TEAM nào mà đội đó còn ngoài thùng rác. Page như vậy không chặn việc xóa đội/tuyển thủ:
`deletion-impact` không tính nó vào usage `COMPETITION_PAGE`. Khi danh tính vào thùng rác, page đi theo: danh sách và ô
chọn hồ sơ trong Admin (`GET /admin/pages` ở mọi cách sắp xếp, kể cả khi lọc theo `entityIds`) và danh sách đội của một
thành viên (`/pages/{id}/teams`) không hiện nó; chi tiết `GET /admin/pages/{id}` vẫn đọc được; công bố bị từ chối cho
tới khi khôi phục danh tính. Khôi phục danh tính thì page hiện lại mà không cần ghi gì thêm. Page đã từng công bố hoặc
còn một trong các hoạt động trên vẫn giữ danh tính ngoài thùng rác như trước. Đội ở thùng rác không còn giữ thành viên
trong đội hình page của nó; còn việc xóa hẳn một page cá nhân vẫn bị chặn khi bất kỳ đội hình nào nêu tên nó, kể cả
đội hình của đội ở thùng rác, vì đội đó còn khôi phục được.

Kế hoạch và lịch sử kế hoạch của giải ở thùng rác cũng không còn giữ đội, tuyển thủ hay bản ghi nào khác của sổ đăng
ký ngoài thùng rác (ADR-015, bổ sung 2026-11-19). Chúng vẫn chặn xóa hẳn page tổ chức, chuỗi giải hay page khác mà
chúng nêu tên. Khôi phục giải không kiểm tra các đội trong kế hoạch: khôi phục đội trước rồi mới tới giải.

## Liên kết thành viên đội tuyển

Liên kết thành viên đội (03/11/2026): chọn hồ sơ PLAYER/PERSON có sẵn hoặc tạo nhanh rồi thêm vào bản nháp
đội. TEAM lưu tên từ hồ sơ liên kết khi tạo/lưu; tên cũ trong snapshot công bố không bị viết lại khi cá nhân
đổi tên. Dòng nhập tay trước đây chưa có pageId vẫn được giữ để bổ sung liên kết. Không nhận liên kết tới
tổ chức, đội khác hay UUID không tồn tại. Hồ sơ còn được đội hình nháp/công bố tham chiếu không thể xóa.
GET /admin/pages/{id}/teams trả các liên kết từ đội hình nháp; GET /pages/{id}/teams chỉ trả từ đội đã
công bố và yêu cầu cá nhân đã công bố. Mỗi mục gồm teamPageId, teamCode, teamName, teamAvatarUrl và member.
Thông tin đội hiển thị hai chiều từ cùng bản ghi roster, không sao chép/ghi đè các mốc lịch sử cá nhân.
Mốc có nguồn từ giải trước đây vẫn được giữ riêng, không suy diễn rằng thay đổi đội hiện tại sửa lại lịch sử.

Ở admin, danh sách thành viên hiển thị ảnh, tên, vị trí và trạng thái; icon mở hồ sơ, sửa và gỡ có nhãn
trợ năng. Thêm thành viên mở bảng chọn tuyển thủ hoặc ban huấn luyện, có tìm kiếm, kéo để tải thêm và tạo
hồ sơ nhanh. Tên/ảnh lấy từ hồ sơ đã chọn; vị trí, trạng thái, thời gian và nguồn thuộc lần tham gia đội.
Áp dụng chỉ cập nhật bản chỉnh sửa tại chỗ, Lưu nháp mới ghi đội hình. Hồ sơ tạo nhanh được lưu độc lập.
Vai trò kiêm nhiệm của tuyển thủ là tùy chọn; vị trí thi đấu chỉ chọn trong đội. Các mục lịch sử,
thành tích và nguồn thu gọn thành dòng tóm tắt, mở ô nhập qua icon sửa.

### Vị trí và trạng thái theo mã (18/11/2026)

Người dùng chọn cách này ngày 18/11/2026. Mỗi thành viên đội hình có thêm hai mã, không bắt buộc:

- `lane`: vị trí thi đấu, cùng mã với đội hình của giải (TOP, JUNGLE, MID, DRAGON, SUPPORT).
- `standing`: ACTIVE (đội hình chính), SUBSTITUTE (dự bị), STAFF (ban huấn luyện), LEFT (đã rời đội).

`role` và `status` vẫn là chữ hiển thị đúng như đã ghi ("Đi rừng · Đội trưởng", "Dự bị · AOG Winter 2026"); ứng dụng
đọc mã để nhóm thành viên, chọn icon vị trí và đánh dấu người ngồi ngoài, rồi viết tên nhóm và vị trí bằng ngôn ngữ người
đọc. Thành viên STAFF không có `lane`; sai trả 422 `PAGE_INVALID_CONTENT`, mã không có trong danh sách trả 400.

Admin chọn vị trí trong đội từ danh sách: chọn một vị trí thi đấu ghi `lane` cùng chữ của vị trí đó; chọn huấn luyện
viên hoặc phân tích đội tuyển ghi `standing` STAFF và bỏ `lane`; chữ tùy chỉnh đi kèm ô chọn vị trí thi đấu riêng.
Trạng thái chọn theo mã, kèm ô ghi chú tự do cho `status`. Stream nhóm đội hình theo `standing` (chính thức, dự bị,
ban huấn luyện, đã rời đội; dòng chưa có mã ở nhóm "Thành viên"), hiện icon và tên vị trí theo `lane`.

Đội trưởng (18/11/2026): thành viên có thêm `captain` (true/false, thiếu là false). Admin bật tắt bằng ô "Đội trưởng"
trong bảng thành viên và vẽ vương miện theo `captain`; Stream ghi "Đội trưởng"/"Captain" theo ngôn ngữ người đọc cạnh
tên. Không ứng dụng nào tìm chữ trong `role` để biết ai là đội trưởng nữa; chữ cũ trong `role` vẫn giữ nguyên. Với
thành viên có `lane`, Stream hiện tên vị trí theo mã và dấu đội trưởng, không hiện phần ghi chú sau vị trí trong `role`
(chữ đầy đủ vẫn xem được khi rê chuột).

## Dữ liệu giải lịch sử (06/11/2026)

Giải đã kết thúc được nhập từ nguồn ngoài (Liquipedia, kho phân tích YouTube) nên mô hình nhận thêm những gì
chúng ghi nhận, không suy diễn số liệu:

- Hạng giải thêm `D` (Liquipedia tier 5); loại giải thêm `SHOWMATCH` và `OTHER`. Tier 1–4 tương ứng S, A, B, C.
- Giải có `placements` (hạng dạng chữ vì có thể đồng hạng "5-8", đội, tiền thưởng USD và nội tệ, trận cuối),
  `awards` (giải cá nhân, người nhận, đội), `links` (nhãn, URL) và `localCurrency`. Tên trong các dòng này vẫn đọc
  được khi chưa có bản ghi liên kết. Từ 19/11/2026, `teamId`/`playerId` của các dòng này không còn là tham chiếu mềm:
  backend kiểm tra khi lưu và chặn xóa bản ghi được nhắc (xem "Liên kết giữa các bản ghi thi đấu").
- Trận nhận BO2, BO4 là thể thức đấu đủ số ván: tổng hai vế bằng BO, được hòa. BO lẻ giữ quy tắc cũ.
- Trận có `repeatPicksAllowed` khi được đấu không có luật cấm chọn lại tướng; chỉ khi đó backend và Admin mới
  bỏ qua luật này. Mặc định vẫn áp dụng luật.
- Tuyển thủ thêm `birthDate`, `lane` (vị trí thường đánh; vị trí trong từng giải vẫn ở đội hình),
  `careerStatus`, `signatureHeroes`.
- Link video: `sourceUrl` của trận là video cả trận hoặc cả buổi nếu có, nếu không là trang nguồn; `sourceUrl` của
  ván là video ván. Nguồn của kết quả nằm ở `result.sourceUrl`.

### Ngôn ngữ danh mục của ván (12/11/2026)

Ván ghi `region` và `locale` để đọc danh mục tướng, phụ trợ, trang bị, phù hiệu và ngọc từ Wiki. `locale` chỉ nhận
ngôn ngữ mà danh mục hỗ trợ, hiện là `vi-VN` và `en-US`. Giá trị khác bị từ chối cả khi lưu nháp lẫn khi công bố,
báo trong `missingFields` là `locale.unsupported`. Bản nháp vẫn được để trống `locale`; công bố thì bắt buộc như cũ.
Danh sách ngôn ngữ chỉ khai báo một nơi, dùng chung cho quy tắc của ván và cho lời gọi danh mục.

Lần nhập 06/11/2026 đã ghi `vi` cho mọi ván. Danh mục từ chối giá trị này nên trang trận không tải được ảnh tướng
và ván không thể công bố. Migration V015 đổi các giá trị `vi` đó thành `vi-VN` trong bản nháp, bản công bố và lịch
sử công bố của ván, không đụng tới trường nào khác.

## Danh bạ thi đấu trong Admin (06/11/2026)

Mỗi mục có cách hiển thị riêng thay vì một dòng chung, vì người dùng tra mỗi loại hồ sơ theo những thông tin khác nhau:

| Mục | Cách hiển thị | Thông tin chính |
|---|---|---|
| Đội tuyển | Thẻ | Logo, khu vực, số giải, thắng-thua, chức vô địch, tiền thưởng, đội hình gần nhất, giải gần nhất |
| Tuyển thủ | Bảng so sánh, lọc theo vị trí, quốc gia, trạng thái | Ảnh, tên thi đấu, tên thật, tuổi, vị trí, đội gần nhất, tướng tủ, số giải, chức vô địch, giải gần nhất, trạng thái |
| Ban huấn luyện | Dòng, lọc theo vai trò | Vai trò, đội và giải gần nhất, số giải đã làm việc |
| Broadcast | Thẻ theo ảnh, lọc theo vai trò | Ảnh, vai trò, giải gần nhất, kênh mạng xã hội |
| Tổ chức | Dòng | Khu vực, website, số giải đã tổ chức, số năm, các hạng giải, giải gần nhất |
| Hệ thống giải | Thẻ theo logo | Số mùa, số năm, các hạng giải, mùa gần nhất |

"Đội gần nhất" của tuyển thủ là đội ở dòng đội hình có ngày hoạt động gần nhất, không khẳng định hợp đồng hiện tại. Vị trí lấy từ hồ sơ tuyển thủ, nếu trống thì lấy từ dòng đội hình gần nhất có ghi vị trí. Đội hình của đội bỏ qua thành viên đã rời (INACTIVE) và lấy giải gần nhất có đội hình, vì giải mới nhất có thể chưa nhập.

Số liệu được tính từ giải, trận và đội hình khi đọc, nên không cần lưu riêng và không lệch khi sửa dữ liệu.

## Ưu tiên gần đây trong quản lý thi đấu (07/11/2026)

Lịch sử nhập từ Liquipedia lùi về tới 2016, nên mọi danh sách và ô chọn trong Admin xếp cái đang làm và còn hoạt động lên trước, nhưng vẫn tìm được hồ sơ cũ. Thứ tự do database tính khi đọc, không lưu riêng và không nạp hàng vào bộ nhớ. "Hôm nay" là ngày của database. Mỗi thứ tự đều kết thúc bằng tên rồi UUID, nên cuộn tải thêm không lặp hay bỏ sót dòng.

### Giải đấu

Xếp theo nhóm, trong nhóm theo khoảng cách tới hôm nay:

| Nhóm | Điều kiện | Trong nhóm |
|---|---|---|
| 0. Đang diễn ra | Hôm nay nằm trong ngày bắt đầu và kết thúc | Sắp kết thúc trước |
| 1. Sắp diễn ra | Bắt đầu trong 30 ngày tới | Sắp bắt đầu trước |
| 2. Còn lại có ngày | Đã kết thúc, hoặc bắt đầu sau hơn 30 ngày | Gần hôm nay trước, tính cả hai phía |
| 3. Không có ngày | Không có ngày và không có năm | Theo tên |

Giải ở xa trong tương lai nằm xen giữa các giải đã qua cách hôm nay chừng ấy ngày, nên không chen lên đầu mà cũng không bị đẩy xuống cuối. Ngày quyết định, trạng thái chỉ dùng khi: giải ghi FINISHED thì không còn là đang diễn ra dù ngày chưa hết; giải không có ngày thì ONGOING vào nhóm 0, UPCOMING hoặc ANNOUNCED vào nhóm 1; giải ONGOING chỉ có ngày bắt đầu vẫn ở nhóm 0. Giải chỉ có năm thuộc nhóm 2, tính từ đầu đến cuối năm đó.

Các mùa của một tổ chức hoặc hệ thống giải (`/admin/competitions`) dùng cùng thứ tự này.

### Đội và tuyển thủ: ngày hoạt động gần nhất

`lastActiveOn` của đội là trận gần nhất đội đã đấu:

- Ngày của trận là ngày muộn hơn giữa lịch của trận và ván cuối, đọc theo UTC. Trận được tính khi đã có kết quả, đã có ván, hoặc lịch đã qua; trận hẹn trong tương lai chưa có kết quả thì chưa tính.
- **Ngày sai không đẩy được đội cũ lên đầu:** ngày của trận không được vượt ngày kết thúc của giải (giải chỉ có năm thì là cuối năm) và không vượt hôm nay. Dữ liệu dev có 106 trận ghi ngày ngoài giải: 27 trận sau ngày kết thúc, ảnh hưởng 26 đội (có trận ghi muộn đúng một năm), đều bị chặn lại ở ngày kết thúc giải; 79 trận trước ngày bắt đầu được giữ nguyên, vì đó phần lớn là vòng loại thật và ngày sớm không nâng hạng ai. Không sửa dữ liệu nguồn.
- Đội có mặt trong giải mà không có trận có ngày (trận không ghi lịch, đội hình, bảng xếp hạng cuối, đăng ký tham dự) lấy ngày kết thúc giải; nếu giải đang diễn ra hoặc bắt đầu trong 30 ngày tới thì lấy hôm nay; giải xa hơn 30 ngày hoặc không có ngày thì chưa có ngày hoạt động. Trận có ngày luôn thắng các dấu hiệu này trong cùng một giải.

Tuyển thủ lấy ngày của đội trong từng dòng đội hình của mình, ngày muộn nhất là `lastActiveOn`; "đội gần nhất" và "giải gần nhất" lấy theo đúng dòng đó. Không đọc đội hình từng ván: chỉ 12.989 trong 25.399 ván ghi tuyển thủ, mọi tuyển thủ được ghi trong ván đều đã có dòng đội hình, và không ai có ván mới hơn ngày suy từ đội hình. Việc mở từng ván để đọc cũng rất tốn (64 nghìn dòng). Vì vậy tuyển thủ dự bị được tính theo đội, và người chỉ ghi trong ván mà không có dòng đội hình sẽ chưa có ngày. Người đã rời đội (INACTIVE) chỉ được tính tới ngày đầu của giải đó.

Hồ sơ PERSON không có trận riêng, nên lấy mốc lịch sử có ngày muộn nhất (không vượt hôm nay); mốc không ghi ngày không được tính. Tổ chức và hệ thống giải lấy giải gần nhất của mình theo quy tắc "có mặt trong giải" ở trên.

Dòng không có ngày xếp cuối, theo tên rồi UUID. Trên dev hiện còn 12 đội và 94 tuyển thủ như vậy.

### Tìm kiếm

Khi có từ khóa, độ khớp tên đứng trước độ gần đây: khớp nguyên tên, rồi đầu tên, rồi đầu một từ trong tên, rồi chỗ khác. Mỗi tên gọi khác, tên ngắn và mã đều tính là một tên. Không phân biệt hoa thường, dấu, và dấu câu giữa các từ. Vì vậy gõ đúng tên một tuyển thủ đã giải nghệ sẽ thấy người đó đầu tiên, trước những người mới đấu nhưng chỉ khớp một phần tên.

### Ô chọn trong ngữ cảnh

Thứ tự: khớp nguyên tên, rồi dòng thuộc ngữ cảnh, rồi độ khớp, rồi ngày hoạt động.

| Ô chọn | Ngữ cảnh | Xếp trước |
|---|---|---|
| Đội trong một giải (thêm đội tham dự, đội A/B của trận) | `tournamentId` | Đội có trận, đội hình, thứ hạng hoặc đăng ký trong giải |
| Tuyển thủ của đội trong giải (đội hình, ván) | `teamId`, `tournamentId` | Đội hình của đội trong giải này, rồi người từng ở đội này, rồi người khác trong giải này |
| Giải của một đội hoặc tuyển thủ (xem đội hình, thành tích) | `teamId` hoặc `playerId` | Giải họ đã tham gia |
| Thành viên của hồ sơ đội | `relatedPageId` | Hồ sơ có mốc lịch sử gắn với đội này |

Dòng hiển thị lý do xếp hạng: ngữ cảnh ("Trong giải này", "Từng ở đội này") và ngày hoạt động. Giải đấu hiển thị ngày cùng thời gian còn lại, ví dụ "Còn 8 ngày", "Kết thúc 6 ngày trước". Vẫn chọn được cách xếp khác ở từng danh sách: giải theo trạng thái hoặc tên; đội, tuyển thủ theo số giải, chức vô địch, tiền thưởng, tên; ban huấn luyện, broadcast, tổ chức, hệ thống giải theo nhiều giải nhất hoặc tên. Khi chọn cách xếp khác thì thứ tự đó được giữ nguyên, kể cả khi có từ khóa.

Trận trong một giải vẫn theo lịch thi đấu, trận không có ngày xếp cuối. Trận tìm xuyên giải theo độ khớp tên rồi mới nhất. Không đổi thứ tự public trên Stream: các endpoint công khai không dùng chung truy vấn với danh sách admin.

## Giải chính và các phần của giải (13/11/2026)

Lần nhập 06/11/2026 tạo một giải cho mỗi trang Liquipedia có infobox giải, kể cả các trang con mà Liquipedia chỉ hiện
thành tab của một giải: vòng loại, wildcard, tuần đấu, chặng thành phố, vòng thăng hạng, showmatch. Vì vậy danh sách
giải lặp lại một giải nhiều lần. Người dùng yêu cầu bỏ cách hiển thị này ngày 13/11/2026.

### Mô hình

- Giải có thêm `parentTournamentId` tùy chọn. Giải không có trường này là **giải chính**; giải có trường này là **một
  phần** của giải chính đó.
- Một phần vẫn là một giải đầy đủ: có đội tham dự, đội hình, thể thức, lịch, kết quả, thứ hạng chung cuộc và bản công
  bố riêng. Không gộp trận của vòng loại vào giải chính, vì đội dự vòng loại không phải đội dự giải chính, còn hạng
  giải, thời gian và tiền thưởng của mỗi phần cũng khác.
- Phần khác giai đoạn. Giai đoạn (vòng bảng, playoffs) nằm trong thể thức của một giải và dùng chung danh sách đội.
  Phần là một cuộc đấu riêng diễn ra vì giải chính.
- Chỉ có một cấp: giải chính không là phần của giải khác và phần không có phần riêng. Trang con nhiều tầng của
  Liquipedia được gắn thẳng vào giải chính; tên của phần vẫn giữ đủ ngữ cảnh.
- Giải chính có thể không có trận của riêng mình khi nó chỉ gom các phần ngang hàng, ví dụ một mùa gồm nhiều chặng
  thành phố.

### Quy tắc lưu, xóa và khôi phục

- `parentTournamentId` phải trỏ tới một giải không ở thùng rác, khác chính nó và là giải chính. Giải đã có phần không
  nhận `parentTournamentId`; phần đang ở thùng rác cũng được tính vì còn khôi phục được. Vi phạm trả 400
  `TOURNAMENT_INVALID_CONTENT`; giải chính không tồn tại hoặc đã xóa trả 409 `TOURNAMENT_RECORD_DELETED`.
- Giải chính còn phần chưa xóa thì chưa xóa được: `deletion-impact` trả usage `TOURNAMENT_PART` và thao tác xóa trả 409
  `TOURNAMENT_RECORD_IN_USE`. Xóa hoặc tách các phần trước.
- Khôi phục một phần khi giải chính còn ở thùng rác trả 409 `TOURNAMENT_RESTORE_BLOCKED`, như mọi bản ghi phụ thuộc khác.
- Tách một phần là bỏ `parentTournamentId`; giải đó trở lại là giải chính.

### Danh sách và tìm kiếm

- `GET /admin/tournaments` nhận `level`: `ALL` (mặc định, như trước) hoặc `MAIN`. Với `MAIN`, danh sách chỉ gồm giải
  chính; từ khóa khớp tên giải chính hoặc tên một phần của nó; bộ lọc trạng thái, hạng, khu vực và năm xét trên giải
  chính.
- Thứ tự RECENT với `MAIN` xếp giải chính theo thành viên gần hôm nay nhất trong giải chính và các phần chưa xóa của nó:
  nhóm trước, rồi khoảng cách trong nhóm, đúng quy tắc của "Ưu tiên gần đây". Vòng loại đang diễn ra đưa giải chính lên
  nhóm đang diễn ra dù giải chính còn vài tháng nữa mới đấu.
- `GET /admin/tournaments/facets?level=MAIN` đếm theo giải chính.
- `GET /admin/tournaments/parts?parentId=` trả các phần chưa xóa của một giải chính; bỏ `parentId` thì trả mọi phần. Mỗi
  dòng gồm `{id,parentId,name,logoUrl,competitionType,status,tier,region,startsOn,endsOn}`, xếp theo giải chính, rồi
  ngày bắt đầu, rồi tên.
- Ô chọn giải cho trận, đội hình và thành tích vẫn liệt kê cả các phần (`level=ALL`), vì trận và đội hình thuộc về
  từng phần. Ô chọn giải chính dùng `level=MAIN`.
- Mùa của một tổ chức hoặc hệ thống giải (`GET /admin/competitions` có lọc trang, `GET /admin/competitions/page-stats`):
  một phần chỉ được liệt kê và đếm khi giải chính của nó không thuộc cùng trang đó. Vòng loại do cùng đơn vị tổ chức đi
  theo giải chính; vòng loại do đơn vị khác tổ chức vẫn hiện ở trang của đơn vị đó. Thứ tự các mùa dùng cùng cách xếp
  theo thành viên gần hôm nay nhất.
- Số giải và số chức vô địch trong danh bạ đội, tuyển thủ chưa đổi: mỗi phần vẫn được đếm như một giải.

### Admin

- Danh sách giải chỉ hiện giải chính. Dưới ngày tháng của giải có một dòng nêu số phần và tối đa bốn phần, mỗi phần là
  một liên kết mở thẳng phần đó. Phần được từ khóa gọi tên đứng trước, rồi phần đang hoặc sắp diễn ra (có chấm màu),
  rồi theo thứ tự thi đấu. Số còn lại hiện thành "+N phần khác" và mở giải chính.
- Trang giải có một hàng tab ngay dưới tiêu đề: "Giải chính" và từng phần, giống hàng tab của Liquipedia. Mỗi tab mở
  không gian sáu bước của giải đó. Đường dẫn đầu trang của một phần có thêm tên giải chính.
- Tên rút gọn của phần là tên phần bỏ đi tên giải chính ở đầu ("… 2026 - Wildcard" thành "Wildcard"). Khi hai tên chỉ
  giống nhau phần mở đầu cho tới một dấu ngăn cách thì bỏ phần giống nhau đó. Phần có tên riêng ("Road to APL 2020 -
  GCS") giữ nguyên tên.
- Bước Tổng quan của giải chính có mục "Các phần của giải": loại, ngày, trạng thái, số đội và số trận của từng phần,
  cùng nút "Thêm phần" là nơi duy nhất tạo phần mới. Form mở sẵn giải chính, mã, tên, khu vực, năm, hạng và logo lấy từ
  giải chính. Bước Tổng quan của một phần ghi "Là một phần của" kèm tên giải chính.
- Trường "Thuộc giải chính" trong form sửa giải là nơi duy nhất gắn một giải có sẵn vào giải chính hoặc tách ra. Trường
  bị khóa khi giải đó đang có phần.

### Công khai

Chưa đổi. Snapshot công bố của một giải mang `parentTournamentId` như mọi trường khác của giải, để Stream gom các phần
thành tab ở bước sau. Hiện chưa có giải nào được công bố.

## Liên kết giữa các bản ghi thi đấu (19/11/2026)

Theo ADR-032, người dùng duyệt hướng làm ngày 19/11/2026. Lần nhập Liquipedia để lại nhiều quan hệ dạng chữ trong ghi chú
(MVP, bình luận viên) hoặc trong tiêu đề mục lịch sử (giải của huấn luyện viên). Mục này đổi các quan hệ đó thành liên
kết. Người vẫn là hồ sơ PERSON hoặc PLAYER, tổ chức là hồ sơ ORGANIZATION; không có loại bản ghi mới.

### Mô hình

| Bản ghi | Trường | Ý nghĩa |
|---|---|---|
| Giải | `broadcast[]` {`pageId`, `role`} | Ê-kíp phát sóng của cả giải. `role`: HOST (MC), CASTER (bình luận viên), INTERVIEWER (phỏng vấn), GUEST_ANALYST (khách mời phân tích) |
| Giải | `staff[]` {`teamId`, `pageId`, `role`, `title`} | Ban huấn luyện của một đội ở giải này. `role`: COACH, TEAM_ANALYST. `title` là chữ tùy chọn, hiển thị đúng như ghi ("Trợ lý huấn luyện viên") |
| Giải thưởng của giải | `teamId` | Đội của người nhận, cạnh `teamName` |
| Trận | `broadcast[]` | Người phát sóng riêng trận này, cùng dạng với giải |
| Trận | `mvpPlayerId` | MVP của cả trận |
| Ván | `mvpPlayerId` | MVP của ván |
| Mục lịch sử của hồ sơ | `tournamentId` | Giải của mốc này |
| Hồ sơ đội | `organizationId` | Tổ chức chủ quản |

- Mọi trường mới đều không bắt buộc; bản ghi cũ không có thì đọc là rỗng. Chữ cũ (`recipientName`, `teamName`, ghi
  chú, tiêu đề lịch sử) được giữ.
- Một giải có tối đa 64 người trong `broadcast` và 256 dòng `staff`; một trận tối đa 16 người. Không lặp cùng người với
  cùng vai trò (ở `staff` là cùng đội, cùng người, cùng vai trò). `title` tối đa 100 ký tự.
- Vai trò ở đây độc lập với `personRoles` của hồ sơ: hồ sơ không cần ghi sẵn vai trò đó.
- MVP không bắt buộc ngồi ở một vị trí của ván, vì nhiều ván chưa ghi đủ tuyển thủ. Admin đưa tuyển thủ của ván và đội
  hình hai đội lên trước trong ô chọn.
- Thay người, nhà tài trợ, thành phố và máy chủ vẫn là chữ. Đội vô địch, á quân trong `result` vẫn là chữ; thứ hạng 1 và
  2 trong `placements` là nơi có liên kết.

### Kiểm tra khi lưu

| Liên kết | Quy tắc | Sai trả |
|---|---|---|
| Đội ở `placements`, `awards`, `staff`; tuyển thủ ở `awards`, `mvpPlayerId` | Bản ghi có thật, không ở thùng rác (như giải chính của một phần) | 409 `TOURNAMENT_RECORD_DELETED`, kèm `usages` |
| `pageId` ở `broadcast`, `staff` | Hồ sơ PERSON hoặc PLAYER có thật | 400 `TOURNAMENT_INVALID_CONTENT` |
| `role` | Mã trong danh sách trên | 400 `INVALID_REQUEST` |
| `tournamentId` ở lịch sử và thành tích hồ sơ | Một giải có thật, kể cả ở thùng rác | 422 `PAGE_INVALID_CONTENT` |
| `relatedPageId` ở lịch sử hồ sơ | Một hồ sơ có thật | 422 `PAGE_INVALID_CONTENT` |
| `organizationId` | Chỉ hồ sơ TEAM; trỏ một ORGANIZATION có thật; công bố đội cần tổ chức đã công bố | 422 `PAGE_INVALID_CONTENT`; khi công bố 409 `PAGE_CONFLICT` |

### Xóa và khôi phục

- Đội hoặc tuyển thủ đang được nhắc ở thứ hạng, giải thưởng hay ban huấn luyện của một giải chưa xóa không xóa được:
  `deletion-impact` có usage `TOURNAMENT_RESULT` (thứ hạng, giải thưởng) hoặc `TOURNAMENT_STAFF` (ban huấn luyện).
  Tuyển thủ là MVP của trận hoặc ván chưa xóa có usage `SERIES` hoặc `GAME`. Xóa trả 409 `TOURNAMENT_RECORD_IN_USE`.
- Khôi phục một giải, trận hay ván cần các đội và tuyển thủ nó nhắc còn hoạt động: 409 `TOURNAMENT_RESTORE_BLOCKED`.
- Hồ sơ người có trong `broadcast` hay `staff` của giải hoặc `broadcast` của trận chưa xóa không xóa được bản nháp
  (409 `PAGE_CONFLICT`, như hồ sơ được kế hoạch giải tham chiếu). Tổ chức đang là chủ quản của một đội cũng vậy.
- Lịch sử và thành tích trên hồ sơ không chặn xóa giải: đó là bằng chứng sự nghiệp, vẫn đọc được bằng chữ.

### Bản công bố

- Snapshot của giải có thêm `people` {`pageId`: {`id`, `code`, `name`, `avatarUrl`, `published`}}, gồm mọi người ở
  `broadcast` và `staff` của giải và `broadcast` của các trận trong snapshot. Hồ sơ đã công bố cho tên, ảnh và mã theo
  bản công bố. Hồ sơ chưa công bố cho tên theo bản nháp, không có `code` và `avatarUrl`, và người đọc không có liên kết
  tới đó. Công bố giải không bị chặn vì người chưa công bố.
- MVP của các trận được thêm vào `players` của snapshot giải; MVP của ván được thêm vào `players` của snapshot ván.
- Snapshot chụp trước ngày này không có các trường trên; ứng dụng đọc như trước.

### Liên kết cần xem

`GET /admin/link-review?kind=&page=&size=` (`tournament:read`, size 1–100) liệt kê những chỗ còn chữ mà chưa có liên kết,
trong bản ghi và giải không ở thùng rác. `GET /admin/link-review/facets` trả [{`kind`, `count`}].

| kind | Dòng được liệt kê | `text` |
|---|---|---|
| GAME_MVP | Ghi chú ván có "MVP: " và ván chưa có `mvpPlayerId` | Phần ghi chú từ sau "MVP: " tới hết dòng |
| SERIES_MVP | Ghi chú trận có dòng bắt đầu "MVP: " hoặc "MVP trận: " và trận chưa có `mvpPlayerId` | Tên trước dấu "(" |
| SERIES_BROADCAST | Ghi chú trận có dòng bắt đầu "Bình luận: " và trận chưa có `broadcast` | Các tên sau "Bình luận: " |
| AWARD_PLAYER | Giải thưởng chưa có `playerId` | `recipientName` |
| AWARD_TEAM | Giải thưởng có `teamName` nhưng chưa có `teamId` | `teamName` |

Mỗi dòng: {`kind`, `recordId`, `tournamentId`, `tournamentName`, `seriesId`, `gameNumber`, `label`, `text`}. `recordId` là
ván, trận hoặc giải cần mở để sửa; `label` là tên trận hoặc tên giải thưởng. Xếp theo giải bắt đầu gần nhất, rồi tên giải,
rồi `recordId`.

### Admin

- Tổng quan: mục "Ê-kíp phát sóng" vẽ ảnh, tên và vai trò từng người; thêm người bằng ô chọn hồ sơ PERSON/PLAYER có tìm
  kiếm và tạo nhanh hồ sơ PERSON với vai trò đã chọn, như ô chọn tổ chức.
- Đội & đội hình: mỗi khối đội có dòng "Ban huấn luyện"; sửa trong bảng đội hình của đội đó.
- Chung cuộc: đội của thứ hạng và của giải thưởng chọn từ danh sách đội của giải; người nhận chọn từ tuyển thủ (đội hình
  của đội đã chọn trước) hoặc ghi chữ khi người đó chưa có bản ghi. Ghi chữ khác thì bỏ liên kết cũ. Không còn tự nối đội
  theo tên gõ.
- Lịch & kết quả: bảng trận có MVP trận (chọn trong đội hình hai đội) và người phát sóng riêng trận.
- Màn ván: MVP, chọn từ tuyển thủ của ván rồi đội hình hai đội.
- Hồ sơ: mục lịch sử chọn được giải; hồ sơ đội chọn tổ chức chủ quản.
- Màn "Liên kết cần xem" có tab theo `kind` kèm số đếm; mỗi dòng mở đúng chỗ sửa.

### Stream

- Trang giải: mục "Ê-kíp phát sóng" nhóm theo vai trò; ban huấn luyện dưới đội hình từng đội; đội của giải thưởng thành
  liên kết khi đội có hồ sơ công bố.
- Trang trận: tên đội dẫn tới hồ sơ đội; MVP trận và người phát sóng của trận.
- Trang ván: MVP; tên tuyển thủ dẫn tới hồ sơ khi có hồ sơ công bố.
- Hồ sơ: mốc lịch sử có giải dẫn tới trang giải khi giải đã công bố; hồ sơ đội hiện tổ chức chủ quản; hồ sơ tổ chức liệt
  kê các đội chủ quản đã công bố (`GET /pages?kind=TEAM&organizationId=`).

### Điền ngược dữ liệu cũ

Script `research/community-links/` (ADR-032), chạy tay, không phải migration:

1. Xuất dữ liệu bằng một truy vấn chỉ đọc, rồi lập kế hoạch: chỉ đề xuất khi chữ khớp đúng một bản ghi, so tên theo
   cách của `tournament.normalize_reference_search` (không phân biệt hoa thường và dấu).
   - MVP của ván và trận: tên trong đội hình hai đội của trận ở giải đó (tên thi đấu hoặc tên gọi khác).
   - Bình luận viên của trận: tên trùng đúng một hồ sơ PERSON hoặc PLAYER.
   - Ê-kíp phát sóng của giải: hồ sơ PERSON có mục lịch sử với URL nguồn `<URL nguồn của giải>#Broadcast`; vai trò lấy
     từ chữ của mục ("MC", "Bình luận viên", "Phỏng vấn", "Khách mời phân tích").
   - Ban huấn luyện: mục lịch sử PERSON có hồ sơ đội và URL nguồn trùng đúng một giải; "Huấn luyện viên…" là COACH,
     "Chuyên viên phân tích đội tuyển" là TEAM_ANALYST, chữ gốc vào `title`.
   - `tournamentId` của mục lịch sử: URL nguồn (bỏ phần sau "#") trùng đúng một giải.
   - Đội của giải thưởng: `teamName` trùng tên đúng một đội có đội hình, thứ hạng hoặc đăng ký ở giải đó.
2. Ghi qua Admin API: đọc lại bản ghi, chỉ ghi khi trường còn trống, gửi kèm version; xung đột version thì đọc lại một
   lần. Mỗi lần ghi vào sổ để hoàn tác.
3. Chạy trên dữ liệu thật cần người dùng đồng ý riêng. Phần không khớp chắc chắn ở lại trong "Liên kết cần xem".

## Tuyển thủ trùng tên và gộp hồ sơ (20/11/2026)

Lần nhập Liquipedia ngày 05/11 tạo một hồ sơ cho mỗi cách viết tên mà trang giải dùng: "Kiral" và "KiraL", "Anh Duy"
và "AnhDuy", "01.30" và "01:30". Khi mã đã có, script thêm hậu tố quốc gia (`kiral-vn`) thay vì dùng hồ sơ có sẵn,
nên một người có hai hồ sơ, đội hình và ghế chia ra hai nơi. Ngày 20/11 còn 49 cặp như vậy trên dữ liệu thật; không
cặp nào cùng ngồi trong một ván.

### Tên trùng khi tạo

- Hai tên là một khi `tournament.name_key` (V023) giống nhau: gấp như `normalize_reference_search` rồi bỏ mọi ký tự
  không phải chữ hay số. "Anh Duy", "AnhDuy" và "anh-duy" là một tên; "7K²" và "7K2" thì không.
- `POST /admin/players` từ chối (409 `TOURNAMENT_PLAYER_SAME_NAME`) khi tên thi đấu hoặc một tên gọi khác của hồ sơ
  mới trùng tên thi đấu hoặc tên gọi khác của một tuyển thủ chưa xóa cùng quốc gia. Lỗi kèm `players`
  [{id,code,nickname,country}], tối đa 5 hồ sơ.
- Người trùng tên thật thì gửi lại với `?allowSameName=true`. Hồ sơ không có quốc gia không bị kiểm tra.
- Sửa hồ sơ không kiểm tra; hồ sơ do page cộng đồng tạo cũng không, vì page đã chọn hồ sơ của mình.
- Script nhập phải tra hồ sơ có sẵn theo tên và quốc gia trước, và coi 409 là "đã có", không thêm hậu tố để tạo mới.

### Gộp hai hồ sơ của một người

`POST /admin/players/{id}/merge {version,intoId,intoVersion}` gộp hồ sơ `{id}` vào `intoId` trong một giao dịch:

1. Từ chối khi hai hồ sơ cùng ngồi trong một ván (400, đó là hai người), khi ván đã công bố, lịch sử công bố hoặc
   bản công bố kế hoạch giải có tên hồ sơ bị gộp (409, bản công bố không đổi), hoặc khi version lệch.
2. Dòng đội hình: dòng của hồ sơ bị gộp ở cùng giải và đội với một dòng chưa xóa của hồ sơ giữ lại thì vào thùng
   rác; các dòng khác chuyển sang hồ sơ giữ lại.
3. Ghế và MVP của ván, MVP của trận, giải thưởng của giải: id của hồ sơ bị gộp được thay bằng id hồ sơ giữ lại, kể cả
   trong bản ghi đã ở thùng rác. Kế hoạch giải và lịch sử sửa kế hoạch cũng đổi theo, vì lịch sử đó vẫn chặn việc
   xóa hồ sơ và vẫn nói về cùng một người.
4. Hồ sơ giữ lại thêm tên thi đấu và tên gọi khác của hồ sơ bị gộp vào tên gọi khác (tối đa 20). Trường nào còn
   trống (họ tên, ảnh, ngày sinh, vị trí, trạng thái, tướng tủ) thì lấy từ hồ sơ bị gộp.
5. Hồ sơ bị gộp vào thùng rác theo quy tắc xóa thường. Nếu nó còn được dùng (page đã sửa, dòng đội hình mà hồ sơ giữ
   lại đã có ở thùng rác) thì cả lần gộp bị hủy với 409 `TOURNAMENT_RECORD_IN_USE` và danh sách nơi dùng.

Trả `{player, moved:{rosterLines,repeatedRosterLines,tournaments,series,games,plans,planRevisions}}`. Khôi phục hồ sơ bị gộp không trả
lại các liên kết đã chuyển.

## Cơ sở dữ liệu

V006 tạo schema community và các bảng page, page_audit, page_member, page_claim, page_invitation,
post, comment, follow, report, notification. Page code unique;
unique(kind,entity_id); member unique(page_id,actor), partial unique OWNER/page; claim partial unique
PENDING/actor/page; invitation token hash unique; follow unique(actor,page). Page/claim/invitation/post
có optimistic version. Khóa page tuần tự hóa thay đổi quyền và đăng nội dung thay mặt page.

V007 tạo tournament.competition_plan (PK/FK tournament UUID, version, content JSONB, published_snapshot
JSONB, published_at, updated_at, edited_by), tournament.plan_revision (UUID, tournament_id, snapshot
JSONB, action, actor, created_at). Kế hoạch dùng khóa ghi thi đấu, khóa row và version. Thay đổi tham
chiếu ảnh page dùng cùng khóa với retire để không ghi lại ảnh vừa bị thu hồi.

V008 tạo community.post_like (UUID, post_id FK post, actor, created_at, unique(post_id,actor)). Thích
dùng INSERT ... ON CONFLICT DO NOTHING nên không cần khóa page.

V009 thêm index cho bảng tin: post(created_at DESC, id) chỉ với bài PUBLISHED, comment(post_id, created_at)
chỉ với bình luận chưa ẩn, follow(actor, page_id) để tra page đang theo dõi. Không đổi dữ liệu.

V010 thêm vào post: kind varchar(20) mặc định TEXT, title, video_url, image_urls jsonb mặc định [] và
pinned_at, kèm unique một bài ghim mỗi page. Bảng page_live (page_id PK/FK page, url, title, started_at) giữ
trạng thái trực tiếp riêng để bật/tắt không đổi version bản nháp của page.

V011 thêm cột sinh tournament.series.tournament_id (lấy từ content) và index (tournament_id, deleted_at) để lọc
trận theo giải mà không đọc toàn bộ.

V012 tạo schema currency và bảng currency.exchange_rate (currency, rate_date là khóa chính; units_per_usd, source,
fetched_at). Mỗi đơn vị một dòng mỗi ngày, giữ vĩnh viễn để đọc lại tiền thưởng theo tỷ giá của ngày đó (ADR-020).

V013 phục vụ "Ưu tiên gần đây": thêm cột sinh từ nội dung để không phải mở tài liệu khi xếp hạng (tournament: starts_on,
ends_on, season_year, status, placement_team_ids; series: scheduled_at, team_a_id, team_b_id, decided; game: started_at;
roster_membership: status, lane; competition_plan: entrant_team_ids, organizer_page_id, circuit_page_id; page:
history_last_on; search_names cho team, player, tournament, series, page), các index theo lịch trận, đội và giải, cùng
hàm và view tính khi đọc (tournament_window, tournament_team, team_tournament_activity, team_activity,
player_tournament_activity, player_activity, page_activity). `tournament.page_activity` và view `tournament.trashed_identity`
của V022 là hai phần duy nhất module community được đọc từ schema tournament; hàm `search_names`, `search_key`,
`name_match_rank` dùng chung.

Migration `V014` đưa tên thật (`fullName`) vào phần tìm kiếm của tuyển thủ: ô tìm trong danh bạ và ô chọn tuyển thủ đều tìm được
theo tên thi đấu, tên thật, biệt danh hoặc mã.

V016 phục vụ "Giải chính và các phần của giải": cột sinh `tournament.tournament.parent_id` (đọc từ `parentTournamentId`),
index theo cột đó cho các giải là phần, và view `tournament.event_window`: mỗi giải chính một dòng với `recency_rank`,
`recency_distance` của thành viên gần hôm nay nhất trong giải chính và các phần chưa xóa.

Mọi cột lưu tài khoản (`edited_by`, `deleted_by`, `actor`) dùng một dạng khóa: issuer và subject của JWT, cách nhau bằng
một dấu xuống dòng; chỉ `CommunityActor` ghép khóa này. V017 đổi các khóa cũ ghép bằng dấu `|` trong schema tournament
(team, player, tournament, series, game, roster_membership, game_publication, competition_plan, plan_revision) sang dạng đó;
khóa đã đúng dạng giữ nguyên.

V018 phục vụ "Nội dung thông báo": thêm vào `community.notification` cột `kind` (mã loại) và `parameters` (jsonb, mặc
định `{}`), bỏ ràng buộc bắt buộc của `message` và thêm ràng buộc mỗi dòng có `kind` hoặc `message`. Dòng cũ giữ
nguyên `message` và không có `kind`; dòng mới không lưu `message`.

V019 phục vụ "Tên trận theo mã", chạy một lần trên dữ liệu đã lưu. Trong bản nháp kế hoạch (`competition_plan.content`),
nhãn trận trùng đúng một mẫu đã sinh ("Lượt N · Vòng M", "Bán kết nhánh thắng N", "Vòng N nhánh thua · M", "Chung kết
nhánh thắng", "Bán kết nhánh thua", "Chung kết nhánh thua", "Chung kết tổng", "Trận bổ sung") đổi thành `title` và bỏ
`label`; nhãn "Đội A", "Đội B" của suất TBD bị bỏ. Loạt trận có `content.name` trùng các mẫu đó cũng đổi thành `title`,
cột `name` theo đó để trống. Nhãn khác, lịch sử kế hoạch (`plan_revision`), snapshot công bố của giải và snapshot ván
giữ nguyên.

V020 phục vụ "Vị trí và trạng thái theo mã", chạy một lần trên bản nháp và bản công bố của mọi page TEAM. Mã chỉ được
điền khi chữ nói rõ, theo đúng các cách đọc Admin đã dùng: phần đầu của `role` là tên một vị trí ("Đi rừng", "Đường
giữa", "Jungle", "Support"…) thì có `lane`; là huấn luyện viên hoặc phân tích đội tuyển thì `standing` STAFF. Phần đầu
của `status` "Đã rời đội"/"Inactive" thì LEFT, "Ban huấn luyện" thì STAFF, "Dự bị"/"Substitute" thì SUBSTITUTE, "Đội
hình chính"/"Chính thức"/"Active" thì ACTIVE. Khi chữ không nói gì: `lane` lấy theo vị trí của tuyển thủ mà page
PLAYER liên kết đại diện; `standing` (chỉ khi `status` để trống) lấy theo dòng đội hình giải gần nhất của tuyển thủ đó
với chính đội này (ACTIVE, SUBSTITUTE, INACTIVE thành LEFT). Chữ khác ("Cho mượn", "Thử việc", vai trò tự ghi) không
được đoán; `role` và `status` giữ nguyên.

V021 phục vụ "Đội trưởng", chạy một lần trên bản nháp và bản công bố của mọi page TEAM: thành viên có `role` chứa
"Đội trưởng" hoặc "Captain" như một từ riêng (đầu chữ, sau dấu cách, "·" hoặc "|", không phân biệt hoa thường và dấu)
được ghi `captain: true`; `role` giữ nguyên, thành viên khác không đổi.

V022 phục vụ "Đưa danh tính vào thùng rác": view `tournament.trashed_identity` (kind TEAM hoặc PLAYER, id) liệt kê đội
và tuyển thủ đang ở thùng rác. Danh sách, ô chọn hồ sơ và danh sách đội của thành viên bỏ qua page có `entity_id` nằm
trong view; view đọc sổ đăng ký lúc truy vấn nên khôi phục danh tính là đủ để page hiện lại. Không đổi dữ liệu.

"Liên kết giữa các bản ghi thi đấu" (19/11/2026) không thêm migration: các trường mới nằm trong tài liệu jsonb, và dữ liệu
cũ được điền bằng script chạy tay thay vì migration (ADR-032).

## API

Tiền tố /api/community/v1. Danh sách trả {items,totalElements,page,size}, size 1–100 (riêng danh sách đội, tuyển
thủ, giải, trận, ván, đội hình ở /admin là 1–500). Thứ tự theo "Ưu tiên gần đây". /admin cần
tournament:read; ghi cần thêm tournament:write; công bố/duyệt cần tournament:publish. /me cần tài khoản
người dùng và kiểm tra quyền page tại thời điểm thao tác. Body sửa có version để chống ghi đè.

| Endpoint | Dữ liệu / hành vi |
|---|---|
| GET /pages?kind=&q=&organizationId=&page=&size= | Chỉ bản công bố; tìm theo tên công bố. `organizationId` chỉ giữ hồ sơ đội có tổ chức chủ quản đó |
| GET /pages/{id}, /pages/by-code/{code}, /pages/by-entity/{kind}/{id} | Hồ sơ công khai |
| GET /admin/tournaments?q=&alsoRegions=&status=&tier=&region=&year=&sort=&level=&teamId=&playerId=&state=&page=&size= | `level` ALL (mặc định) hoặc MAIN: chỉ giải chính, tìm cả theo tên các phần, xếp theo thành viên gần hôm nay nhất. Mặc định sort RECENT; còn STATUS, NAME, UPDATED. `alsoRegions` là các khu vực mà từ khóa gọi tên, để gõ tên nơi vẫn ra giải. teamId/playerId đưa giải họ tham gia lên trước, dòng có `context` PARTICIPANT. state khác ACTIVE thì theo updatedAt |
| GET /admin/tournaments/facets?level= | {total,statuses,regions,years}, cho tab và bộ lọc mà không tải cả danh sách; `level=MAIN` đếm theo giải chính |
| GET /admin/tournaments/parts?parentId= | Các phần chưa xóa của một giải chính, hoặc mọi phần khi bỏ `parentId`: [{id,parentId,name,logoUrl,competitionType,status,tier,region,startsOn,endsOn}] |
| GET /admin/teams?q=&sort=&tournamentId=&state=&page=&size= | sort RECENT (mặc định), NAME, UPDATED. Dòng có thêm `lastActiveOn`, `context` TOURNAMENT khi thuộc giải; hai trường này không có khi không áp dụng |
| GET /admin/players?q=&sort=&teamId=&tournamentId=&state=&page=&size= | Như trên; `context` là TEAM_IN_TOURNAMENT, TEAM hoặc TOURNAMENT |
| POST /admin/players?allowSameName= | Tạo tuyển thủ; 409 `TOURNAMENT_PLAYER_SAME_NAME` khi trùng tên cùng quốc gia (xem "Tuyển thủ trùng tên và gộp hồ sơ") |
| POST /admin/players/{id}/merge | {version,intoId,intoVersion}: gộp hồ sơ vào `intoId` rồi đưa nó vào thùng rác |
| GET /admin/reference-catalog?q=&kind= | Khớp tên rồi hoạt động gần nhất; tra theo `ids` không xếp hạng |
| GET /admin/series?q=&tournamentId=, /admin/games?tournamentId= | Trận/ván; trong một giải theo lịch, xuyên giải theo độ khớp rồi mới nhất |
| GET /admin/tournaments/stats | [{tournamentId,teams,matches,played}], không tải từng trận |
| GET /admin/link-review?kind=&page=&size=, /admin/link-review/facets | Chỗ còn chữ chưa có liên kết / số đếm theo `kind` (xem "Liên kết cần xem") |
| GET /admin/teams/directory?q=&country=&sort=&page=&size= | Danh bạ đội: số giải, trận, thắng-thua, chức vô địch, tiền thưởng, giải gần nhất, `lastActiveOn` và đội hình gần nhất có trên hồ sơ. sort: RECENT, TOURNAMENTS, TITLES, PRIZE, NAME |
| GET /admin/players/directory?q=&country=&lane=&status=&sort=&page=&size= | Danh bạ tuyển thủ: vị trí, đội và giải của dòng đội hình gần nhất, `lastActiveOn`, số giải, chức vô địch, tướng tủ. sort: RECENT, TOURNAMENTS, TITLES, NAME |
| GET /admin/competitions/page-stats | [{pageId,tournaments,firstYear,lastYear,tiers,latestTournament}] theo trang tổ chức và hệ thống giải |
| GET /admin/pages, /admin/pages/{id} | Bản nháp. Danh sách nhận thêm country, entityIds (tối đa 100 định danh), organizationId (như danh sách công khai, theo bản nháp) và sort: RECENT (mới sửa), NAME, ACTIVITY (nhiều mục lịch sử nhất), ACTIVE (theo "Ưu tiên gần đây", dòng có thêm `lastActiveOn`). relatedPageId đưa hồ sơ có lịch sử gắn với trang đó lên trước, dòng có `related`; chỉ dùng với ACTIVE |
| POST /admin/pages | {kind,code,entityId?,content} |
| PUT /admin/pages/{id} | {version,content} |
| POST /admin/pages/{id}/publish hoặc /withdraw | {version} |
| POST /admin/pages/{id}/delete | {version}; xóa bản nháp chưa từng công bố (xem bên dưới) |
| GET /admin/pages/{id}/handover | {pending,expiresAt}; mã bàn giao còn hiệu lực |
| POST /admin/pages/{id}/handover hoặc /handover/cancel | Tạo mã OWNER, trả {token,expiresAt} một lần / hủy mã |
| GET /me, /me/pages, /me/pages/{id}, /me/pages/{id}/profile | Danh tính, page quản lý, vai trò/theo dõi/version, nội dung công bố cho người quản lý kể cả khi thu hồi |
| PUT /me/pages/{id}/presentation | {version,content:{biography,avatarUrl,coverUrl,links}} |
| POST /me/pages/{id}/claims; GET /me/claims | {evidence}; yêu cầu của chính mình |
| GET /admin/page-claims; POST /admin/page-claims/{id}/decision | Hàng chờ; {version,approve,resolution} |
| GET /me/pages/{id}/members | Người quản lý page |
| POST /me/pages/{id}/invitations; /me/invitations/accept | {role} trả token; {token} nhận lời mời hoặc mã bàn giao |
| POST /me/pages/{id}/members/{memberId}/revoke hoặc /transfer | Thu hồi / chuyển owner |
| GET /pages/{id}/posts?kind=, /me/pages/{id}/posts, /me/pages/{id}/feed | Công khai (bài ghim đứng đầu) / quản lý / công khai cùng nháp của chính mình |
| GET /posts?kind=&q=&page=&size= | Bảng tin công khai: bài đã đăng của mọi page công khai, mỗi mục {post,page}; `liked` luôn false |
| GET /me/feed?following=&kind=&page=&size= | Bảng tin của người xem, cùng dạng {post,page}; `following=true` chỉ lấy page đang theo dõi |
| POST /me/pages/{id}/posts/{postId}/pin | {pinned}; ghim/bỏ ghim bài đã đăng với tư cách page |
| PUT /me/pages/{id}/live; POST /me/pages/{id}/live/end | {url,title} bật hoặc cập nhật trực tiếp / tắt |
| PUT /admin/pages/{id}/live; POST /admin/pages/{id}/live/end | Như trên cho người có tournament:write |
| GET /live?page=&size= | Page công khai đang phát trực tiếp, mỗi mục là hồ sơ công khai có `live` |
| GET /me/follows?page=&size=; GET /me/suggestions?page=&size= | Page đang theo dõi (theo tên) / gợi ý page để theo dõi |
| POST /me/pages/{id}/posts; PUT /me/pages/{id}/posts/{postId} | {version?,kind?,title?,body,videoUrl?,imageUrls?,asPage,publish} |
| GET /posts/{id}/comments; POST /me/posts/{id}/comments | Bình luận công khai; {body,asPage} |
| POST /me/posts/{id}/like | {liked}; trả {liked,likes}. Mọi bài trả kèm `comments` (số bình luận đang hiển thị) |
| POST /me/pages/{id}/follow | {following} |
| POST /me/pages/{id}/reports | {postId?,commentId?,reason}; không có postId là góp ý hồ sơ |
| POST /me/pages/{id}/moderate | {postId,commentId?,hidden} |
| GET /admin/community-reports; POST /admin/community-reports/{id}/resolve | Hàng chờ; {resolution,hide} |
| GET /me/notifications; POST /me/notifications/{id}/read | Hộp thông báo riêng, mỗi dòng {id,pageId,kind,parameters,message?,createdAt,read} (xem "Nội dung thông báo"); đánh dấu đọc |
| GET /me/notifications/unread; POST /me/notifications/read-all | {unread} số chưa đọc / đánh dấu tất cả đã đọc |
| GET /competitions?teamId=&playerId=&organizerPageId=&page=&size= | Snapshot công bố với bộ lọc tham gia/tổ chức |
| GET /competitions/{id} | Snapshot giải |
| GET /exchange-rates?on= | Công khai. `on` là các ngày yyyy-mm-dd, tối đa 60; bỏ trống là hôm nay. Trả {base:"USD",days:[{on,rates:[{currency,unitsPerUsd,rateDate}]}]}: tỷ giá mới nhất vào hoặc trước từng ngày. Ngày cũ hơn lịch sử có rates rỗng. Ngày sai dạng hoặc quá 60 ngày trả 400 INVALID_QUERY_PARAMETER |
| GET /admin/competitions?organizerPageId=&page=&size=, /admin/competitions/{id} | Tóm tắt kế hoạch (kèm tournament và lọc tổ chức theo bản nháp, theo thứ tự danh sách giải) / kế hoạch cùng dữ liệu giải quyết |
| PUT /admin/competitions/{id} | {version,content:CompetitionPlan} |
| POST /admin/competitions/preview | {content,stageCode,opponent}; lịch xem trước, không ghi DB |
| POST /admin/competitions/{id}/materialize, /publish, /withdraw | {version}; tạo trận thật / chụp snapshot / ẩn công khai |

Lỗi page: PAGE_NOT_FOUND 404, PAGE_ACTION_FORBIDDEN 403, PAGE_CONFLICT 409, PAGE_INVALID_CONTENT 422.
Thi đấu dùng bộ TOURNAMENT_* hiện có. Không tin vai trò hoặc tên tác giả do client gửi trong body.

Lỗi dùng chung một dạng với wiki-service: RFC 9457 kèm `code`, `requestId` (trùng header `X-Request-Id` của mọi câu trả lời) và
`errors[]` {path, code, message} khi lỗi gắn với một trường; ngữ cảnh của module (`usages`, `missingFields`, `references`) vẫn là
thành viên cấp trên của problem. Tham số truy vấn lạ, lặp lại, sai kiểu hoặc ngoài giới hạn trang trả 400 INVALID_QUERY_PARAMETER
(`on`, `ids`, `entityIds` được lặp). Field JSON lạ trong body bị từ chối: 400 INVALID_REQUEST, `errors[].code = UNKNOWN_FIELD`.
Hai lần ghi đồng thời vào cùng bản ghi trả 409 VERSION_CONFLICT; ràng buộc unique trả 409 DUPLICATE_RECORD,
ở mọi module của service. Thiếu hoặc sai token trả 401 UNAUTHENTICATED, thiếu quyền 403 FORBIDDEN. Lỗi không lường
trước được ghi log và trả 500 INTERNAL_ERROR.

## Vận hành dev

Client aov-stream là public client Code + PKCE S256, redirect chính xác localhost:5174/auth/callback,
logout /pages; không password grant, implicit flow hay service account. Không cấp quyền quản trị cho
người đăng ký. Access/refresh token giữ trong bộ nhớ; sessionStorage chỉ giữ state/verifier tạm. Sau
reload có thể cần bấm đăng nhập lại bằng phiên SSO hiện có. Thư mời dùng fragment URL.

Access token của aov-stream mang hai audience: community-service cho page/thi đấu và wiki-service cho
hồ sơ dùng chung (ADR-008). Trang Tài khoản (/account) gọi /api/wiki/v1/users/me để sửa tên hiển thị,
giới thiệu, ngôn ngữ, múi giờ và avatar; popup tài khoản trên header hiển thị tên từ hồ sơ này. Avatar là ảnh của
chính người dùng, không có nguồn hay chủ sở hữu ảnh. Tài khoản đã có role client của wiki-service hoặc
community-service vẫn mang các role đó trong token stream; aov-stream không gọi API admin và không cấp
role mới. Upload avatar PUT thẳng từ localhost:5174 lên bucket private nên CORS của bucket phải có origin
này: SeaweedFS local lấy từ wiki.storage.upload-origins; R2 áp dụng infra/cloudflare/upload-cors.json
trong dashboard vì ứng dụng không ghi cấu hình bucket cloud.

Realm đã tồn tại đồng bộ bằng backend/wiki-service/scripts/sync-community-client.ps1 (cả hai audience); thêm
-EnableRegistration để bật đăng ký realm. Máy chủ thực dùng -ServerUrl, -Realm, -Origin chính xác
và HTTPS. Script không cấp role. Khởi động lại community-service để Flyway áp dụng migration;
không chạy lại import realm, không xóa database.

Theme `aov-public` thay giao diện đăng nhập mặc định bằng thiết kế AOV cho cả Stream và Wiki, giữ nguyên
Code + PKCE. Compose mount `infra/local/keycloak-themes/aov-public` vào thư mục themes của Keycloak.
Đồng bộ Wiki bằng cùng script với `-ClientId aov-wiki` (mặc định origin localhost:5173, callback
`/auth/callback`, logout `/`, chỉ audience wiki-service). Script đặt theme ở từng client và bật
ngôn ngữ vi/en cho realm; không đổi theme đăng nhập admin. Menu icon tài khoản Stream chứa ngôn ngữ,
giao diện sáng/tối và đăng nhập; Wiki không có lựa chọn giao diện.

Flyway luôn dùng default-schema public, nơi lưu bảng lịch sử migration. Không để phụ thuộc
search_path của tài khoản database: khi schema community trùng tên user xuất hiện, PostgreSQL
có thể chọn schema này làm mặc định ở lần khởi động tiếp theo.
