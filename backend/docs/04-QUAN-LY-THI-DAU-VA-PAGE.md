# Quản lý thi đấu và page cộng đồng

Phần mở rộng đặc tả 01/02/03 theo ADR-018, được người dùng chấp nhận ngày 01/11/2026.
Áp dụng cho community-service; không thay hợp đồng Wiki hay snapshot ván của ADR-015.

## Luồng sử dụng

Admin có sáu bước: thông tin → đội tham dự → đội hình → thể thức → lịch/kết quả → kiểm tra/công bố.
Đội tham dự độc lập trận đấu. Page tổ chức, đội, tuyển thủ có thể được tạo trước. Tạo page TEAM/PLAYER
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
hoạt động, không tự liên kết vào một mùa giải chưa được tạo trong ứng dụng.

Page ORGANIZATION, TEAM, PLAYER, PERSON độc lập tài khoản và không giữ mật khẩu. Tài khoản dùng issuer + subject
của JWT. Page chưa có đại diện vẫn có thông tin biên tập, nguồn, lịch sử và người theo dõi.

PageContent: tên, tên ngắn, quốc gia, giới thiệu, avatar, cover, links, sources, history, achievements,
roster. Mỗi link có thể đánh dấu `official` (kênh do chính tổ chức/đội/tuyển thủ vận hành); nội dung cũ
không có trường này được coi là không chính thức. History/roster có ngày bắt đầu/kết thúc, vai trò, nguồn và UUID page liên quan; achievement có
UUID mùa giải. Bản nháp riêng bản xuất bản; công bố cần ít nhất một nguồn. Đại diện có lớp trình bày
riêng (giới thiệu, ảnh, liên kết), không được sửa thành tích, lịch sử, đội hình hay kết quả biên tập.

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
sử giải tham chiếu bị chặn retire. Danh tính còn gắn page/kế hoạch/snapshot bị chặn xóa theo cơ chế hiện có.

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

## Dữ liệu giải lịch sử (06/11/2026)

Giải đã kết thúc được nhập từ nguồn ngoài (Liquipedia, kho phân tích YouTube) nên mô hình nhận thêm những gì
chúng ghi nhận, không suy diễn số liệu:

- Hạng giải thêm `D` (Liquipedia tier 5); loại giải thêm `SHOWMATCH` và `OTHER`. Tier 1–4 tương ứng S, A, B, C.
- Giải có `placements` (hạng dạng chữ vì có thể đồng hạng "5-8", đội, tiền thưởng USD và nội tệ, trận cuối),
  `awards` (giải cá nhân, người nhận, đội), `links` (nhãn, URL) và `localCurrency`. `teamId`/`playerId` trong
  các dòng này là tham chiếu mềm: tên vẫn đọc được khi chưa có hoặc đã xóa bản ghi liên kết.
- Trận nhận BO2, BO4 là thể thức đấu đủ số ván: tổng hai vế bằng BO, được hòa. BO lẻ giữ quy tắc cũ.
- Trận có `repeatPicksAllowed` khi được đấu không có luật cấm chọn lại tướng; chỉ khi đó backend và Admin mới
  bỏ qua luật này. Mặc định vẫn áp dụng luật.
- Tuyển thủ thêm `birthDate`, `lane` (vị trí thường đánh; vị trí trong từng giải vẫn ở đội hình),
  `careerStatus`, `signatureHeroes`.
- Link video: `sourceUrl` của trận là video cả trận hoặc cả buổi nếu có, nếu không là trang nguồn; `sourceUrl` của
  ván là video ván. Nguồn của kết quả nằm ở `result.sourceUrl`.

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
player_tournament_activity, player_activity, page_activity). `tournament.page_activity` là phần duy nhất module community
được đọc từ schema tournament; hàm `search_names`, `search_key`, `name_match_rank` dùng chung.

## API

Tiền tố /api/community/v1. Danh sách trả {items,totalElements,page,size}, size 1–100 (riêng danh sách đội, tuyển
thủ, giải, trận, ván, đội hình ở /admin là 1–500). Thứ tự theo "Ưu tiên gần đây". /admin cần
tournament:read; ghi cần thêm tournament:write; công bố/duyệt cần tournament:publish. /me cần tài khoản
người dùng và kiểm tra quyền page tại thời điểm thao tác. Body sửa có version để chống ghi đè.

| Endpoint | Dữ liệu / hành vi |
|---|---|
| GET /pages?kind=&q=&page=&size= | Chỉ bản công bố; tìm theo tên công bố |
| GET /pages/{id}, /pages/by-code/{code}, /pages/by-entity/{kind}/{id} | Hồ sơ công khai |
| GET /admin/tournaments?q=&alsoRegions=&status=&tier=&region=&year=&sort=&teamId=&playerId=&state=&page=&size= | Mặc định sort RECENT; còn STATUS, NAME, UPDATED. `alsoRegions` là các khu vực mà từ khóa gọi tên, để gõ tên nơi vẫn ra giải. teamId/playerId đưa giải họ tham gia lên trước, dòng có `context` PARTICIPANT. state khác ACTIVE thì theo updatedAt |
| GET /admin/tournaments/facets | {total,statuses,regions,years}, cho tab và bộ lọc mà không tải cả danh sách |
| GET /admin/teams?q=&sort=&tournamentId=&state=&page=&size= | sort RECENT (mặc định), NAME, UPDATED. Dòng có thêm `lastActiveOn`, `context` TOURNAMENT khi thuộc giải; hai trường này không có khi không áp dụng |
| GET /admin/players?q=&sort=&teamId=&tournamentId=&state=&page=&size= | Như trên; `context` là TEAM_IN_TOURNAMENT, TEAM hoặc TOURNAMENT |
| GET /admin/reference-catalog?q=&kind= | Khớp tên rồi hoạt động gần nhất; tra theo `ids` không xếp hạng |
| GET /admin/series?q=&tournamentId=, /admin/games?tournamentId= | Trận/ván; trong một giải theo lịch, xuyên giải theo độ khớp rồi mới nhất |
| GET /admin/tournaments/stats | [{tournamentId,teams,matches,played}], không tải từng trận |
| GET /admin/teams/directory?q=&country=&sort=&page=&size= | Danh bạ đội: số giải, trận, thắng-thua, chức vô địch, tiền thưởng, giải gần nhất, `lastActiveOn` và đội hình gần nhất có trên hồ sơ. sort: RECENT, TOURNAMENTS, TITLES, PRIZE, NAME |
| GET /admin/players/directory?q=&country=&lane=&status=&sort=&page=&size= | Danh bạ tuyển thủ: vị trí, đội và giải của dòng đội hình gần nhất, `lastActiveOn`, số giải, chức vô địch, tướng tủ. sort: RECENT, TOURNAMENTS, TITLES, NAME |
| GET /admin/competitions/page-stats | [{pageId,tournaments,firstYear,lastYear,tiers,latestTournament}] theo trang tổ chức và hệ thống giải |
| GET /admin/pages, /admin/pages/{id} | Bản nháp. Danh sách nhận thêm country, entityIds (tối đa 100 định danh) và sort: RECENT (mới sửa), NAME, ACTIVITY (nhiều mục lịch sử nhất), ACTIVE (theo "Ưu tiên gần đây", dòng có thêm `lastActiveOn`). relatedPageId đưa hồ sơ có lịch sử gắn với trang đó lên trước, dòng có `related`; chỉ dùng với ACTIVE |
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
| GET /me/notifications; POST /me/notifications/{id}/read | Hộp thông báo riêng; đánh dấu đọc |
| GET /me/notifications/unread; POST /me/notifications/read-all | {unread} số chưa đọc / đánh dấu tất cả đã đọc |
| GET /competitions?teamId=&playerId=&organizerPageId=&page=&size= | Snapshot công bố với bộ lọc tham gia/tổ chức |
| GET /competitions/{id} | Snapshot giải |
| GET /exchange-rates?on= | Công khai. `on` là các ngày yyyy-mm-dd, tối đa 60; bỏ trống là hôm nay. Trả {base:"USD",days:[{on,rates:[{currency,unitsPerUsd,rateDate}]}]}: tỷ giá mới nhất vào hoặc trước từng ngày. Ngày cũ hơn lịch sử có rates rỗng. Lỗi EXCHANGE_RATE_INVALID_QUERY 400 |
| GET /admin/competitions?organizerPageId=&page=&size=, /admin/competitions/{id} | Tóm tắt kế hoạch (kèm tournament và lọc tổ chức theo bản nháp, theo thứ tự danh sách giải) / kế hoạch cùng dữ liệu giải quyết |
| PUT /admin/competitions/{id} | {version,content:CompetitionPlan} |
| POST /admin/competitions/preview | {content,stageCode,opponent}; lịch xem trước, không ghi DB |
| POST /admin/competitions/{id}/materialize, /publish, /withdraw | {version}; tạo trận thật / chụp snapshot / ẩn công khai |

Lỗi page: PAGE_NOT_FOUND 404, PAGE_ACTION_FORBIDDEN 403, PAGE_CONFLICT 409, PAGE_INVALID_CONTENT 422.
Thi đấu dùng bộ TOURNAMENT_* hiện có. Không tin vai trò hoặc tên tác giả do client gửi trong body.

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
