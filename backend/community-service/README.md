# Community service

Backend giải đấu nhập liệu thủ công, Spring Boot 4.1.1 / Java 21 / PostgreSQL / JPA.
Cổng mặc định `8082`, API `/api/community/v1`, database `community` riêng với Wiki.

## Chạy trên máy

Docker, PostgreSQL và Keycloak của dự án cần đang chạy. Trong thư mục này:

```powershell
./scripts/dev/start-local.ps1
```

Lần đầu, script chỉ tạo database/user riêng nếu chưa có; không xóa dữ liệu Wiki.
Có thể tự thiết lập database rồi dùng `-SkipDatabaseSetup`.
Biến môi trường được mô tả trong `.env.example`; ứng dụng đọc biến đã export, không tự thực thi nội dung file môi trường.
Để quản trị, chạy script đồng bộ quyền và đăng nhập lại admin để nhận audience `community-service` cùng các quyền:

```powershell
../wiki-service/scripts/sync-community-roles.ps1
```

- `tournament:read`: xem dữ liệu biên tập và danh mục tham chiếu.
- `tournament:write`: tạo/sửa đội, tuyển thủ, giải, loạt trận và ván nháp.
- Quyền ghi cũng cho xóa có thể khôi phục và khôi phục dữ liệu biên tập; không cho xóa lịch sử xuất bản.
- `tournament:publish`: xuất bản hoặc thu hồi ván công khai.

GET công khai không cần đăng nhập. API quản trị chỉ chấp nhận Bearer JWT đúng issuer/audience và quyền client; không dùng cookie đăng nhập Wiki trực tiếp.

## Mô hình nhập liệu

- Đội, tuyển thủ, giải đấu và loạt trận có UUID riêng, mã dễ đọc và phiên bản lạc quan. Đội có tên ngắn và tối đa
  20 tên gọi khác; tên gọi được cắt khoảng trắng, không để trống/trùng hoa thường và dài tối đa 100 ký tự.
- Tuyển thủ có ảnh `photoUrl` tùy chọn và các tên thi đấu khác với cùng giới hạn như tên khác của đội. Thiếu ảnh
  không tự lấy ảnh của người khác; tên thật/quốc gia không được đưa vào danh mục gợi ý tham chiếu.
- Một ván gồm hai bên xanh/đỏ, mỗi bên bốn tướng cấm và năm tuyển thủ. Mỗi tuyển thủ có vị trí, tướng và đúng một phụ trợ.
- Có thể lưu nháp thiếu dữ liệu. `missingFields` chỉ rõ các trường còn thiếu để xuất bản. Tướng cấm/chọn, tuyển thủ, đội, vị trí không được trùng trái quy tắc.
- Phù hiệu và ngọc dùng trạng thái `UNKNOWN` (chưa rõ), `NOT_SHOWN` (nguồn không hiển thị), `KNOWN` (đã nhập). Hai trạng thái đầu không được coi là không sử dụng và không cản xuất bản. Ngọc đã biết cần đủ 30 viên, mỗi màu 10; phù hiệu có ba cấp nhánh chính và hai ô nhánh phụ đúng cấu trúc.
- Mỗi ảnh chụp trang bị theo thời gian phải có đủ sáu ô đánh số **1–6**. `known=false` là chưa quan sát; `known=true,item=null` là ô trống đã xác nhận. Không suy đoán trang bị đầy đủ cuối trận từ một ảnh giữa trận.
- Sự kiện mua/bán/nâng cấp/đổi ô được ghi riêng theo giây. Chương trình không tự suy ra giao dịch giữa hai ảnh chụp; các món cấp thấp, món đã bán và món thay thế vẫn được giữ trong diễn biến.
- Mỗi ván có thị trường, mùa và patch riêng. Chọn riêng mùa khi xuất bản sẽ chốt patch công khai cuối cùng hợp lệ của mùa tại thời điểm đó. Snapshot công khai giữ UUID patch thực tế, nhãn và revision tham chiếu, không tự trôi theo cập nhật sau này.
- Tham chiếu Wiki dùng public API, không đọc database Wiki. Tướng/trang bị chưa có bản công khai có thể nhập tên quan sát với `id=null`; UI phải thể hiện đây là tên chưa liên kết, không tự tạo UUID hoặc tự xuất bản Wiki.
- Thị trường chưa có dữ liệu Wiki vẫn cho nhập và xuất bản quan sát thủ công khi chưa gán mùa/patch. Danh mục rỗng và `resolvedContext.unknown=true`, giữ nguyên quốc gia; không thay bằng VN. UUID Wiki không xác minh được hoặc patch của thị trường chưa hỗ trợ không được xuất bản như dữ liệu đã xác nhận.
- Xuất bản chụp riêng đội hình, tên đội/tuyển thủ, ngữ cảnh và **chỉ các tham chiếu thực sự dùng**. Sửa nháp sau đó không thay dữ liệu công khai. Thu hồi ẩn snapshot đang hiệu lực và giữ nhật ký xuất bản/thu hồi trong database.

## Dòng thời gian ván

`GameContent.timeline` lưu cùng bản nháp ván và được đóng băng trong snapshot khi xuất bản:

- `timeline.events`: các mốc trên đồng hồ trận, sắp xếp tăng dần theo `atSeconds`, tối đa 1000 mốc. Mỗi mốc có `id`
  ổn định (`[A-Za-z0-9:_-]`, tối đa 64 ký tự, không trùng) và `note` tùy chọn (≤ 500 ký tự).
  - `KILL`: `killer` và/hoặc `victim` là vị trí `{side, lane}`; hai người phải khác bên. `assists` tối đa bốn, cùng
    bên với đội được tính điểm hạ gục và không trùng người hạ gục. Thiếu người hạ gục thì vẫn tính cho bên còn lại.
  - `OBJECTIVE`: `side` và `objective` (`DARK_SLAYER`, `ABYSSAL_DRAGON`, `TURRET`, `BASE`, `OTHER`) bắt buộc; `by`
    tùy chọn và phải cùng bên.
  - `NOTE`: `title` bắt buộc (≤ 120 ký tự), `side` tùy chọn.
  - Trường không thuộc loại mốc bị từ chối (`fields.unexpected`) thay vì âm thầm bỏ qua.
- `timeline.pauses`: đoạn tạm dừng kỹ thuật trong video, `{atSeconds, durationSeconds}` theo đồng hồ trận, tăng dần,
  tối đa 50. Cùng với `sourceUrl` (video YouTube chính thức) và `sourceTimestampSeconds` (giây video khi ván bắt
  đầu), client tự quy đổi thời điểm trận ↔ thời điểm video; dịch vụ không tải hay sao chép video.
- Mua/bán/ghép/đổi ô trang bị **không** nằm trong `timeline`: vẫn ghi ở `equipmentEvents` của từng tuyển thủ để chỉ có
  một nguồn dữ liệu trang bị.
- Khi biết `durationSeconds`, mọi mốc và đoạn tạm dừng phải nằm trong thời lượng ván. Dòng thời gian không bắt buộc
  để xuất bản. Ván lưu trước khi có trường này đọc thành dòng thời gian rỗng, không cần migration.

## Giai đoạn cấm chọn

`GameContent.draft` ghi giai đoạn cấm chọn của ván theo video, lưu cùng bản nháp và được đóng băng khi xuất bản:

- `startSecond`: giây video lúc màn cấm chọn bắt đầu. `lockedSecond`: giây video lúc chốt đội hình, sau khi các
  tuyển thủ cùng đội đã hoán đổi tướng; phải không sớm hơn `startSecond`. Cả hai cùng hệ giây với
  `sourceTimestampSeconds` (giây video lúc vào trận) và không được muộn hơn mốc vào trận khi đã biết.
- `turns`: các lượt theo thứ tự `order` = 1, 2, 3…, tối đa 40. Mỗi lượt có `kind` (`BAN`/`PICK`), `side` và `hero`
  (bắt buộc với `PICK`, lượt cấm có thể bỏ trống khi đội bỏ lượt). Mỗi bên tối đa 4 lượt cấm và 5 lượt chọn; một
  tướng chỉ xuất hiện một lần. `atSecond` tùy chọn, nằm trong giai đoạn cấm chọn và không giảm theo thứ tự lượt.
- Lượt chọn gắn với đội, không gắn với tuyển thủ. Khi đã có lượt, cấm cuối cùng trong `sides[].bans` phải nằm trong
  lượt cấm của đội đó và tướng của từng tuyển thủ phải nằm trong lượt chọn của đội (`notDrafted`). Đường và tuyển thủ
  được gán sau mốc chốt.
- Ván lưu trước khi có trường này đọc thành giai đoạn cấm chọn rỗng, không cần migration.

## Quan sát phụ trợ, phù hiệu và bảng ngọc

Buổi phát thường chỉ hiện phụ trợ, phù hiệu hoặc bảng ngọc của từng đội ở những thời điểm khác nhau, và có khi không
hiện đủ:

- `Participant.spellObservedAtSeconds`, `arcana.observedAtSeconds`, `enchantments.observedAtSeconds`: giây trên đồng hồ
  trận lúc nguồn hiển thị thông tin đó (tùy chọn, từ 0 tới thời lượng ván khi đã biết). Quan sát trước 0:00 (màn cấm
  chọn, màn tải trận) ghi là 0.
- Trạng thái quan sát có thêm `PARTIAL` (hiện một phần): được lưu danh sách chưa đầy đủ; một dòng ngọc có thể chỉ có
  màu và số lượng khi video chỉ hiện chỉ số, phù hiệu không cần đủ 3 chính + 2 phụ. Các ràng buộc cấu trúc (không
  trùng, tối đa 10 viên mỗi màu, tối đa 30 viên, đúng nhánh) vẫn áp dụng. `KNOWN` vẫn bắt buộc đầy đủ khi xuất bản;
  `UNKNOWN`/`NOT_SHOWN` không được có dòng nào.

## Luật chọn tướng trong một loạt BO

Khi lưu ván, dịch vụ đối chiếu các ván còn hoạt động khác của cùng loạt: ngoài ván cuối cùng có thể của BO (số ván
bằng `bestOf`), một đội không được chọn lại tướng mình đã chọn ở ván khác của loạt, dù đổi bên. Ván cuối mở lại toàn
bộ tướng; tướng bị cấm chỉ bị loại trong chính ván đó. Tướng khớp theo UUID hoặc theo tên (không phân biệt hoa/thường).
Vi phạm trả `TOURNAMENT_INVALID_CONTENT` với `missingFields` dạng `sides[i].participants[j].hero.usedInSeries` hoặc
`draft.turns[k].hero.usedInSeries`.

Contract TypeScript tham khảo tại `contracts/tournament-v1.ts`; HTTP annotations nằm trên `TournamentAdminApi` và `TournamentPublicApi`.

## Tham chiếu trong ô nhập

`GET /api/community/v1/admin/reference-catalog` dành cho người có quyền `tournament:read`. API chỉ trả UUID,
tên hiển thị, mã/biệt danh để tìm kiếm và logo đội; không trả tên thật hoặc quốc gia của tuyển thủ. Dữ liệu biên tập
không được đưa vào một danh mục công khai. Stream tiếp tục dùng danh tính đã đóng băng trong ván đã xuất bản.

- `q`: tối đa 120 ký tự; tìm không phân biệt hoa/thường và dấu tiếng Việt trong tên, mã, tên ngắn của đội.
- `kind`: `TEAM` hoặc `PLAYER`; bỏ trống để tìm cả hai.
- `ids`: danh sách tối đa 50 UUID, ngăn bằng dấu phẩy, để khôi phục thẻ đã chèn sau khi mở lại ô nhập.
- `page`, `size`: phân trang từ 0, mặc định 30 mục, tối đa 100. Các bộ lọc được kết hợp, không tải toàn bộ danh bạ.

Kết quả theo `PageSlice`: `items`, `totalElements`, `page`, `size`. Mỗi mục dùng `kind` viết thường (`team`, `player`),
`translations` với nhãn `vi-VN`, `description` rỗng, `autoMatch=true` và đường dẫn quản trị nội bộ.
Migration V002 thêm cột tìm kiếm tự tính và chỉ mục trigram; PostgreSQL cần cho chủ database tạo extension tin cậy
`pg_trgm`. Tên hoặc mã thay đổi sẽ cập nhật chỉ mục ngay trong cùng thao tác lưu, kể cả bản ghi đã có trước migration.

## Thông tin bổ sung của giải

Giải có thể lưu `logoUrl`, `tier` (`S`, `A`, `B`, `C`, `UNKNOWN`), `competitionType` (`LEAGUE`, `CUP`, `QUALIFIER`,
`UNKNOWN`), `venueMode` (`ONLINE`, `OFFLINE`, `HYBRID`, `UNKNOWN`) và `status` (`UPCOMING`, `ONGOING`, `FINISHED`,
`ANNOUNCED`, `UNKNOWN`). Phân hạng là thông tin biên tập có nguồn, không phải xếp hạng chính thức do Garena cấp.
Ngày đã qua không tự biến giải thành đã kết thúc hoặc tự suy ra đội vô địch.

`result` là tùy chọn: tên đội thắng/á quân, hai điểm số có thể để trống cùng nhau, URL nguồn bắt buộc,
mức xác minh và ngày kiểm chứng tùy chọn. Điểm số nếu nhập phải từ 0–99 và đội thắng có điểm cao hơn.
Mức xác minh gồm `PRIMARY`, `SECONDARY_CORROBORATED`, `SECONDARY_CAPTURE`, `SECONDARY_PRESS_ONLY`, `UNVERIFIED`;
không tự nâng nguồn thứ cấp thành nguồn chính thức. Thiếu trường mới trong dữ liệu cũ được đọc thành chưa rõ,
không sửa snapshot đã xuất bản hoặc đoán kết quả.

## Đội hình đăng ký theo giải

Danh tính tuyển thủ không có trường “đội hiện tại”. `RosterMembershipContent` ghi quan hệ tuyển thủ–đội trong
một giải cụ thể; cùng tuyển thủ có thể thuộc đội khác ở giải khác mà không ghi đè lịch sử.

`/api/community/v1/admin/roster-memberships` hỗ trợ GET phân trang (`tournamentId`, `teamId`, `playerId`, `page`,
`size`), POST `{content}`, GET `/{id}` và PUT `/{id}` `{version,content}`. Quyền đọc/ghi giống các danh mục giải đấu.
`content` bắt buộc ba UUID giải/đội/tuyển thủ đã tồn tại, duy nhất theo bộ ba. Vị trí `lane` có thể để `null` khi chưa
biết; số áo tùy chọn dài tối đa 20 ký tự. `status` là `ACTIVE`, `SUBSTITUTE`, `INACTIVE`, `UNKNOWN`; ngày bắt đầu/kết
thúc có thể để trống, ghi chú tối đa 2.000 ký tự. Nguồn `sourceUrl` cần HTTP(S); khi mức xác minh khác `UNVERIFIED`
phải có nguồn. Không biến nguồn thứ cấp thành nguồn chính thức hoặc suy đoán vị trí từ thứ tự danh sách.

Các quan hệ đăng ký hiện dành cho quản trị, không tự xuất bản danh bạ hoặc thay đổi đội hình thực tế của một ván.
Quan sát tuyển thủ trong ván và snapshot công khai tiếp tục độc lập; sửa đội hình đăng ký không viết lại ván cũ.
Migration V003 chỉ thêm bảng quan hệ và cập nhật cột/chỉ mục tìm kiếm tự tính của tuyển thủ để tìm cả tên khác.

## Xóa có thể khôi phục

Các nhóm `teams`, `players`, `tournaments`, `series`, `roster-memberships`, `games` có:

- `GET /api/community/v1/admin/{kind}/{id}/deletion-impact`: xem phiên bản, khả năng xóa và số liên kết đang dùng.
- `POST /api/community/v1/admin/{kind}/{id}/delete` với `{version}`: đưa vào thùng rác.
- `POST /api/community/v1/admin/{kind}/{id}/restore` với `{version}`: khôi phục bản ghi.

Danh sách nhận `state=ACTIVE` (mặc định), `DELETED` hoặc `ALL`; `DocumentView.deletedAt` chỉ ra bản đã xóa.
Chi tiết quản trị vẫn đọc được bản đã xóa, nhưng phải khôi phục trước khi sửa. Mã và UUID được giữ để tránh tạo
trùng danh tính; muốn nhập lại cùng mã thì tìm trong thùng rác và khôi phục. Ảnh Media/R2 được giữ theo vòng đời ảnh.

Khi còn liên kết đang hoạt động hoặc được lịch sử xuất bản tham chiếu, API trả `409` kèm loại/số liên kết và đường
dẫn quản trị để kiểm tra. Cần sửa liên kết nhập nhầm trước; không xóa dây chuyền. Ván từng xuất bản được thu hồi/sửa
bản nháp, không xóa lịch sử. Việc xóa, khôi phục và tạo liên kết được đồng bộ trong transaction database, không giữ
khóa trong lúc gọi Wiki hoặc upload. Migration V004 thêm dấu xóa; không xóa dữ liệu đã có.

Loạt trận có thể lưu `result` riêng với `scoreA`, `scoreB`, `sourceUrl`, `verification`, `verifiedOn`. Kết quả cuối phải
đúng ngưỡng thắng của thể thức BO và có nguồn. Không cần tạo các ván giả để ghi tỷ số loạt trận; ván chưa biết chi
tiết tiếp tục được nhập nháp riêng. Thứ tự đội A/B chỉ xác định hai vế tỷ số, không suy ra bên xanh/đỏ của từng ván.

## Nhập metadata giải đấu đã thu thập

Script Python chỉ tạo metadata đội và giải để biên tập; không tạo loạt trận, ván, đội hình hoặc xuất bản dữ liệu.
Mặc định đọc `resources/esports/2026-post-apl/manifest.json` từ gốc repository.

```powershell
python ./scripts/import-collected-metadata.py --dry-run
python ./scripts/import-collected-metadata.py --apply
```

Chế độ `--dry-run` chạy ngoại tuyến, không cần đăng nhập và là chế độ mặc định. Trước khi dùng `--apply`, đặt access token
của phiên quản trị đã có vào biến môi trường `COMMUNITY_IMPORT_ACCESS_TOKEN`. Token cần quyền `tournament:read` và
`tournament:write`; script không lưu hoặc in token. Nếu token hết hạn, cấp token mới rồi chạy lại.

Chỉ các đội có tên được xác minh bằng nguồn chính thức mới được tạo; logo rời chỉ dùng URL nguồn chính thức.
Logo dự phòng và đội hình chưa kiểm chứng nằm ngoài database. Ngày chưa xác minh được để trống; bản ghi chưa xác minh
thuộc khoảng thời gian thu thập được bỏ qua. Thông tin nguồn và các giới hạn được lưu trong ghi chú giải và báo cáo nhập.

Có thể chạy lại an toàn: script tìm theo mã trước khi tạo, giữ nguyên bản ghi đã có và đánh dấu nội dung khác để xem xét,
không tự ghi đè chỉnh sửa thủ công. Báo cáo nằm trong `.local-state/tournament-metadata-import/` ở gốc repository và
không được Git theo dõi. Các mã kiểm thử `ui-check*` bị từ chối.

Chạy kiểm tra an toàn nhập liệu (không cần mạng hoặc credential):

```powershell
python ./scripts/test_import_collected_metadata.py
```

## Kiểm tra

```powershell
./mvnw.cmd spotless:apply
./mvnw.cmd verify
```

Kiểm thử PostgreSQL dùng Docker Testcontainers riêng, không sửa database local. Không chạy hai build vào cùng thư mục.
