# Mẫu AOG Winter 2026

Phạm vi chỉ gồm **Đấu Trường Danh Vọng mùa Đông 2026**, kiểm tra đến **27/10/2026**. Nhập dưới dạng bản nháp; không tự xuất bản hoặc tạo quan sát từng ván từ tỷ số trận.

## Gói ổn định để nhập

`registries-and-rosters.json` đã khóa, chứa:

- Một giải, **9 đội**, 68 hồ sơ tuyển thủ và 69 quan hệ tuyển thủ–đội tại giải.
- 45 mục Main → `ACTIVE`, 16 mục Subs → `SUBSTITUTE`, 8 mục Former có nhãn Left → `INACTIVE`.
- Một người có thể có nhiều quan hệ tại cùng giải: Maris rời Flash rồi gia nhập RRQ. Chỉ tạo **một** hồ sơ Maris, nối hai quan hệ bằng mã/UUID tương ứng.
- Năm mục được nguồn ghi DNP. Vẫn giữ đăng ký dự bị nhưng không coi là bằng chứng đã thi đấu.
- Chín đội trưởng được đánh dấu ở metadata nguồn; trạng thái đội trưởng không thay thế vị trí thi đấu.

`players` là danh sách hồ sơ toàn cục. `rosters` là danh sách quan hệ theo giải; khi nhập cần ánh xạ `teamCode`, `playerCode` và mã giải sang UUID đã khôi phục/tạo. Không tạo lại đội hay tuyển thủ chỉ vì cách viết tên khác.

Mã tướng, kỹ năng hoặc dữ liệu wiki không nằm trong gói này. Không suy ra patch thi đấu từ ngày trận hoặc patch hiện tại của wiki.

`series-import.json` đã khóa riêng, gồm **79 trận**: 72 trận vòng bảng, sáu trận Playoffs đã kết thúc và Chung kết nhánh thua SGP–BME chưa diễn ra. Toàn bộ có giờ lịch thi đấu rõ từ nguồn. Trường `content.result` của 78 trận đã đấu dùng đúng cấu trúc `SeriesResult`; cần ánh xạ ba mã giải/đội sang UUID trước khi gửi API. Không thêm Chung kết FPL–TBD vào danh sách nhập vì chưa xác định đối thủ và không tạo đội giả.

`game-outcomes-evidence.json` giữ chuỗi thắng/thua của **315 ván** hiển thị trong các trận, chỉ để đối chiếu. Đây không phải dữ liệu gửi API tạo ván: chưa có bên xanh/đỏ, chọn/cấm tướng, phụ trợ hoặc trang bị từ riêng từng ván.

## Nguồn và mức xác minh

- [Trang giải Liquipedia](https://liquipedia.net/honorofkings/Arena_of_Glory/2026/Winter): dữ liệu hiển thị trực tiếp trong trình duyệt người dùng, gồm Overview, Main, Subs, Former, Player Info và bảng chuyển nhượng. Lịch trận lấy từ Detailed Results của [lượt đi](https://liquipedia.net/honorofkings/Arena_of_Glory/2026/Winter/Group_Stage/First_Leg), [lượt về](https://liquipedia.net/honorofkings/Arena_of_Glory/2026/Winter/Group_Stage/Second_Leg) và [Playoffs](https://liquipedia.net/honorofkings/Arena_of_Glory/2026/Winter/Playoffs). Các bản chụp DOM được giữ nguyên trong `evidence/`. Đây là nguồn thứ cấp, ghi `SECONDARY_CAPTURE`.
- [Thông báo của Garena ngày 25/08](https://lienquan.garena.vn/dau-truong-danh-vong-mua-dong-2026-chinh-thuc-khoi-tranh-tu-29-08-mo-ra-ky-nguyen-danh-vong-era-of-g10ry/): xác minh tên chín đội, lịch mùa giải, BO5 vòng bảng, sáu đội vào Playoffs và BO7.
- [Thông tin 10Fest](https://lienquan.garena.vn/cong-bo-thong-tin-mo-ban-ve-lien-quan-10fest/): xác minh Chung kết ngày 07/11 tại Sân vận động Quốc gia Mỹ Đình, Hà Nội.
- Logo được kế thừa từ bộ tài nguyên đã đối chiếu với đồ họa đội tham dự của Garena; ảnh GAM từ website câu lạc bộ. URL, đường dẫn và checksum nằm trong từng bản ghi.

Công cụ web nhận HTTP 403 khi mở Liquipedia. Không vượt hạn chế truy cập; dữ liệu mới lấy từ trang đang hoạt động trong trình duyệt của người dùng. Bản nghiên cứu cũ ngày 14–15/10 không được dùng thay cho ảnh chụp hiện tại.

## Quy tắc ngày và danh tính

Chỉ 17 mốc chuyển nhượng giữa mùa có ngày rõ mới được áp dụng: 10 lần gia nhập và 7 lần rời đội. Đây là **ngày thông báo chuyển nhượng của nguồn**, không tự hiểu là ngày đầu/cuối ra sân. Những ngày chưa rõ giữ `null`, đặc biệt ngày Peak rời BOX. Không có cựu thành viên nào được xác minh đã rời đội trước khi mùa giải bắt đầu trong nhóm Former đã chụp.

Quốc tịch `VN` lấy từ lá cờ hiển thị cạnh từng tuyển thủ trên nguồn, không suy ra từ quốc gia của đội. Gói mẫu không thu thập ngày sinh hoặc tên thật. Nickname giữ cách viết của danh sách giải; mã bỏ dấu và viết thường để ánh xạ ổn định.

Danh sách câu lạc bộ GAM hiện tại có Adonis ở đường Tà thần, còn danh sách **giải cụ thể** đặt Kuga ở Main và Adonis ở Subs. Gói này theo danh sách giải; không trộn hai bối cảnh.

## Trận và bảng xếp hạng

`plan.json` bổ sung lịch, thể thức, bảng xếp hạng và bằng chứng tỷ số, phát triển độc lập với gói hồ sơ đã khóa. Bảng xếp hạng vòng bảng là số liệu kết thúc vòng bảng, không phải thứ hạng chung cuộc. Trận chưa diễn ra không có tỷ số hoặc đội thắng.

Toàn bộ 72 trận vòng bảng và 278 ván đã được đối chiếu giữa ma trận tổng hợp và lịch chi tiết. Hai đội A/B được xếp theo thứ tự xuất hiện của từng trận trong lịch, không suy ra đội chủ nhà hoặc bên xanh/đỏ. Giờ của từng trận vòng bảng được đọc từ popup thông tin hiển thị; đội, tỷ số, thứ tự hai bên và ngày đều phải khớp lịch chi tiết trước khi dùng. Bản chụp 72 popup nằm trong `evidence/liquipedia-fixture-popups.json`. Toàn bộ 79 mốc giờ ICT được đổi chính xác sang UTC; không suy ra giờ bắt đầu thật của từng ván từ giờ lịch này.

Chung kết vẫn ở tương lai tại mốc kiểm tra. Không điền nhà vô địch hoặc tỷ số Chung kết. Nguồn hiện có thể xác minh một số đội đã bị loại và thứ hạng của họ; không gán hạng 1–3 khi còn chưa phân định.

API đã có tỷ số tổng của series độc lập, vì vậy có thể lưu kết quả trận đã xác minh mà không tạo các ván giả. Bảng xếp hạng giữ riêng dưới dạng bằng chứng để đối chiếu. Phần quan sát chọn/cấm, trang bị, ngọc, phù hiệu và phụ trợ cần nguồn từng ván riêng.

## Ảnh và khôi phục

Các URL ảnh `null` trong payload mẫu là chỗ chờ ánh xạ Media, **không phải yêu cầu xóa ảnh đã có**. Khi khôi phục bản ghi cùng mã/UUID, giữ URL Media hiện hữu nếu chưa có ảnh thay thế đã xác minh. Bảy ảnh tuyển thủ GAM có metadata nguồn riêng; không lấy ảnh đội nữ hoặc đội của trò chơi khác để lấp chỗ trống.

Chỉ đưa bản ghi cũ vào thùng rác, không xóa ảnh hoặc sửa ảnh chụp đã xuất bản. Các ID được khôi phục phải giữ nguyên để không làm đứt liên kết.

## Logo thay thế từ trang giải

`logo-replacements.json` là danh sách riêng cho chín logo quan sát trực tiếp trên trang AOG Winter 2026 của Liquipedia. Mỗi mục giữ mã đội ổn định, trang đội được ảnh liên kết tới, `src`/`srcset` nguyên bản và URL ảnh có kích thước lớn nhất **đã thấy trong nguồn**. Không tự đoán URL ảnh gốc hoặc gán logo của bộ môn khác.

Team Flash dùng biểu tượng đội hiển thị tại trang giải thay cho ảnh chữ đồng thương hiệu nằm ngang trên website câu lạc bộ. Team Secret chọn biến thể `lightmode` được nguồn cung cấp để phù hợp nền sáng của admin. Ảnh được lưu nguyên dạng, không cắt, đổi màu hoặc tạo lại. Tên tệp nguồn có năm 2020/2021 chỉ là tên tài nguyên của Liquipedia; bằng chứng sử dụng là trang giải năm 2026 đang hiển thị ảnh đó.

Danh sách này không thay đổi gói đội hình đã khóa. Chỉ sau khi tải, kiểm tra tệp và đưa qua Media của dự án mới thay URL ảnh của đội bằng URL Media. URL Liquipedia trong danh sách dùng để ghi nguồn, không phải URL ảnh đích được chép thẳng vào bản ghi đội.

Cả chín tệp PNG đã tải nguyên vẹn vào `logos/liquipedia/`, kiểm tra chữ ký PNG, kích thước đúng nguồn và xem trực tiếp từng logo. Chín ảnh đã được đưa qua Media của dự án và lưu URL CDN mới cho đúng đội trong admin. `logo-replacements.json` giữ URL Media công khai, URL nguồn Liquipedia, checksum SHA-256 và kích thước từng tệp; biên nhận nằm tại `evidence/uploaded-liquipedia-logos.json`. Không thay đổi ảnh nguồn hoặc nội dung tệp hồ sơ đã khóa để thực hiện thay ảnh này.

Khi dựng lại database, nhập `registries-and-rosters.json` trước, sau đó nhập `team-media-overlay.json` và chọn cập nhật bản ghi đã có. Gói bổ sung này chỉ có chín đội với mã, tên chuẩn của gói nền và `logoUrl` đã upload; những trường đội khác không được gửi và được giữ nguyên. Gói không tạo giải, tuyển thủ, đội hình hoặc thao tác xuất bản. Các URL đã upload phải vẫn tồn tại trong kho Media thì ảnh mới hiển thị được.
