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

Page ORGANIZATION, TEAM, PLAYER độc lập tài khoản và không giữ mật khẩu. Tài khoản dùng issuer + subject
của JWT. Page chưa có đại diện vẫn có thông tin biên tập, nguồn, lịch sử và người theo dõi.

PageContent: tên, tên ngắn, quốc gia, giới thiệu, avatar, cover, links, sources, history, achievements,
roster. Mỗi link có thể đánh dấu `official` (kênh do chính tổ chức/đội/tuyển thủ vận hành); nội dung cũ
không có trường này được coi là không chính thức. History/roster có ngày bắt đầu/kết thúc, vai trò, nguồn và UUID page liên quan; achievement có
UUID mùa giải. Bản nháp riêng bản xuất bản; công bố cần ít nhất một nguồn. Đại diện có lớp trình bày
riêng (giới thiệu, ảnh, liên kết), không được sửa thành tích, lịch sử, đội hình hay kết quả biên tập.

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

Xóa hồ sơ nháp (02/11/2026): chỉ hồ sơ chưa từng công bố, chưa có người đại diện, yêu cầu nhận, thư mời,
bài viết, người theo dõi, báo cáo hay thông báo, và không được kế hoạch giải nào tham chiếu. Xóa cả lịch sử
thao tác của hồ sơ và giải phóng đường dẫn; ứng dụng ghi log người xóa. Các trường hợp khác trả 409
PAGE_CONFLICT; hồ sơ đã công bố chỉ được thu hồi. Danh tính đội/tuyển thủ tạo kèm page không bị xóa theo.

Bằng chứng claim, actor, token mời, audit không có trong API công khai. Ảnh còn được page hoặc lịch
sử giải tham chiếu bị chặn retire. Danh tính còn gắn page/kế hoạch/snapshot bị chặn xóa theo cơ chế hiện có.

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

## API

Tiền tố /api/community/v1. Danh sách trả {items,totalElements,page,size}, size 1–100. /admin cần
tournament:read; ghi cần thêm tournament:write; công bố/duyệt cần tournament:publish. /me cần tài khoản
người dùng và kiểm tra quyền page tại thời điểm thao tác. Body sửa có version để chống ghi đè.

| Endpoint | Dữ liệu / hành vi |
|---|---|
| GET /pages?kind=&q=&page=&size= | Chỉ bản công bố; tìm theo tên công bố |
| GET /pages/{id}, /pages/by-code/{code}, /pages/by-entity/{kind}/{id} | Hồ sơ công khai |
| GET /admin/pages, /admin/pages/{id} | Bản nháp |
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
| GET /pages/{id}/posts, /me/pages/{id}/posts, /me/pages/{id}/feed | Công khai / quản lý / công khai cùng nháp của chính mình |
| GET /posts?page=&size= | Bảng tin công khai: bài đã đăng của mọi page công khai, mỗi mục {post,page}; `liked` luôn false |
| GET /me/feed?following=&page=&size= | Bảng tin của người xem, cùng dạng {post,page}; `following=true` chỉ lấy page đang theo dõi |
| GET /me/follows?page=&size=; GET /me/suggestions?page=&size= | Page đang theo dõi (theo tên) / gợi ý page để theo dõi |
| POST /me/pages/{id}/posts; PUT /me/pages/{id}/posts/{postId} | {version?,body,asPage,publish} |
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
| GET /admin/competitions, /admin/competitions/{id} | Tóm tắt kế hoạch / kế hoạch cùng dữ liệu giải quyết |
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
