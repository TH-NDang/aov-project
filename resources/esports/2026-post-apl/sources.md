# Giải đấu Liên Quân sau APL 2026

Bộ thu thập được rà soát ngày **26/10/2026**, dành cho nhập liệu có kiểm chứng. Chưa tự đưa dữ liệu này lên trang công khai hoặc xuất bản vào database.

Phạm vi là giải chuyên nghiệp/chính thức và vòng tuyển chọn đi vào các giải đó. Mốc lọc chính là **01/08/2026**; giải bắt đầu trước nhưng còn thi đấu sau mốc này được ghi riêng. Các giải nữ chính thức được giữ thành nhánh đội riêng, không lấy đội hình nam cùng tổ chức thay thế. Không thu video dài; chỉ lưu liên kết phát sóng.

## Các giải và vòng tuyển chọn đã tìm thấy

| Giải | Khu vực | Thời gian | Mức kiểm chứng |
|---|---|---|---|
| ĐTDV mùa Đông 2026 | Việt Nam | 29/08–07/11 | Garena xác nhận ngày khai mạc, 9 đội và ngày chung kết |
| GCS Summer 2026 | Đài Loan/Hồng Kông/Ma Cao | 22/08–31/10 | Garena xác nhận lịch, 7 đội, đội hình ban đầu; logo từ cổng giải |
| RPL Winter 2026 | Thái Lan | 22/08–25/10 | Kênh phát sóng Garena xác nhận khai mạc; địa điểm xác nhận chung kết 23–25/10 |
| TEPL 2026 | Thái Lan | 27/06–09/08 | Giải giao với mốc lọc; ngày khai mạc toàn giải từ nghiên cứu cũ, vòng chung kết 08–09/08 và suất RPL 2027 do Cơ quan Thể thao Thái Lan xác nhận |
| Queens of Glory Winter 2026 | Việt Nam | 19/10–01/11 | Garena xác nhận 8 đội, thể thức và lịch các vòng |
| Vòng tuyển chọn QOG Winter | Việt Nam | Chưa rõ | Đã xác minh có vòng tuyển chọn và 3 đội đi tiếp; **chưa đủ ngày để xác nhận nằm sau tháng 7** |
| Miss RoV 2026 Season 2 | Thái Lan | 12/10–25/10 | Website giải xác nhận playoffs và chung kết; còn thiếu danh sách đội đầy đủ |
| Vòng loại Miss RoV Season 2 | Thái Lan | 22/09–07/10 | Website giải xác nhận lịch vòng loại |
| AIC 2026 | Quốc tế, tổ chức tại Thái Lan | Cuối năm; chưa chốt ngày | Garena xác nhận kế hoạch. Không lấy ngày vòng wildcard từ nguồn thứ cấp để coi là lịch chính thức |

Nguồn xác định mốc APL: [Garena Đài Loan](https://moba.garena.tw/news/show/5604) liệt kê các ngày thi đấu cuối 18–19/07, phù hợp ngày kết thúc 19/07 trong nghiên cứu có sẵn. APL được dùng làm mốc, không bị nhập lặp thành giải sau tháng 7.

Ngày kết thúc theo lịch không đồng nghĩa đã xác minh nhà vô địch. RPL/TEPL/Miss RoV giữ trạng thái cần kiểm tra kết quả sau giải; không tự điền tỷ số từ ngày hoặc từ bảng tổng hợp bên ngoài.

## Nguồn chính thức

- [Garena VN — bài công bố ĐTDV mùa Đông trong trang lưu trữ giải đấu](https://lienquan.garena.vn/category/giai-dau/page/2/): ngày khởi tranh, danh sách đội và hình công bố. Trang lưu trữ đang trả nội dung toàn bài; liên kết này được giữ làm nguồn thay vì tự đoán permalink.
- [Garena VN — lịch chung kết trong Liên Quân 10Fest](https://lienquan.garena.vn/cong-bo-thong-tin-mo-ban-ve-lien-quan-10fest/): ngày thi đấu là 07/11; ngày 08/11 là đại nhạc hội.
- [Garena VN — Queens of Glory Winter](https://lienquan.garena.vn/queens-of-glory-mua-dong-2026-chinh-thuc-khoi-tranh-tu-ngay-19-10-voi-dien-mao-moi/): đội tham dự, nhánh tuyển chọn và lịch thi đấu.
- [Garena GCS — công bố mùa Hè](https://esports.moba.garena.tw/gcs/news/content/5687), [lịch và logo đội](https://esports.moba.garena.tw/gcs/schedule).
- [Garena RoV — phát sóng khai mạc RPL](https://www.youtube.com/watch?v=Xq19Mkao8DA), [IMPACT — lịch chung kết RPL](https://www.impact.co.th/en/visitors/event-calendar/special-event/rov-pro-league-2026-winter).
- [Cơ quan Thể thao Thái Lan — chung kết TEPL](https://www.sat.or.th/พิธีเปิดการแข่งขันกีฬา-2/), [Garena — phát sóng ngày chung kết TEPL](https://www.youtube.com/watch?v=e_n8Y46BP0s).
- [Website Miss RoV Season 2](https://www.missrov.com/web/), [trailer từ kênh Garena](https://www.youtube.com/watch?v=_GBmiiRTAyY).
- [Garena — lộ trình quốc tế 2026](https://www.garena.sg/news/2M54DC): AIC cuối năm tại Thái Lan; phân biệt hợp tác HoK tại EWC với game AoV thông thường.

## Tài nguyên và cách đọc dữ liệu

- `manifest.json`: chỉ mục 9 bản ghi giải/vòng, 41 bản ghi đội và 59 ảnh, khoảng 12,6 MiB. Mỗi ảnh có URL nguồn, trang chứa ảnh, kích thước và SHA-256.
- Có **35 ảnh lấy trực tiếp nguồn chính thức**, gồm 7 logo đội GCS, hình công bố/lịch/đội tuyển và thumbnail phát sóng. Các ảnh nhúng base64 trong bài GCS được tách nguyên byte; không tạo lại logo bằng AI.
- **24 logo dự phòng** được sao chép từ bộ nghiên cứu Liquipedia cũ, có nguồn gốc và cờ `logoReviewRequired`. Một số chỉ là ảnh nhỏ hoặc thương hiệu từ mùa trước; cần kiểm tra trước khi dùng làm logo mùa hiện tại.
- 10 đội chưa có file logo riêng đã được ghi thiếu. Không dùng logo AoV chung giả làm logo đội. Với 3 đội nữ VN thiếu logo rời, hình `tournaments/qog-2026-winter/participating-teams.jpg` vẫn có logo chính thức trong ảnh tổng hợp; từng đội có `officialLogoEvidence` trỏ về hình đó.
- Có 33 đội hình tham chiếu, 284 dòng thành viên gồm tuyển thủ và nhân sự, lấy từ nghiên cứu cũ. Các dòng chỉ lưu tên thi đấu/vị trí/nhóm; giữ cờ nguồn thứ cấp cần rà soát. Không coi đội hình công bố đầu mùa là đội hình của mọi trận.
- `tournaments/*.json`: lịch, đội, nguồn, các khoảng trống, liên kết phát sóng và trạng thái kiểm chứng. `teams/*.json`: tách đội nữ/đội mở; tên hiển thị tại giải tách khỏi mã ổn định.
- `gameplayContext` chưa xác định. Không suy ra patch từ ngày thi đấu hoặc lấy patch đang dùng trên wiki. Khi nhập từng ván cần chọn mùa/patch thực tế hoặc ghi rõ chưa biết.

## Bao phủ và phần còn thiếu

VN, TH và hệ GCS TW/HK/MO có sự kiện được xác minh. Indonesia/SG/MY/PH chưa tìm được giải sau mốc từ nguồn chính thức trong lượt rà soát này; ACS Indonesia tìm thấy diễn ra tháng 4 nên không đưa vào. Nhật/Hàn/Âu/Bắc Mỹ/Mỹ Latin/Ấn Độ cũng chưa có sự kiện phù hợp được xác minh. Đây là **thiếu bằng chứng**, không phải kết luận các khu vực đó không tổ chức giải.

Còn cần bổ sung ngày/danh sách vòng tuyển chọn QOG, toàn bộ đội và logo Miss RoV, logo rời TEPL, lịch/đội/vòng loại AIC khi có công bố chính thức và kết quả mới nhất. Không trộn các giải HoK/KPL/Asian Games bị một số trang tổng hợp gắn nhãn AoV.

Tứ Phương Đại Chiến, ACS học đường, Legend of City và RoV T-POP không nằm trong phạm vi đã chốt. Bộ nghiên cứu `research/aov-esports-2020-2026` được giữ nguyên; tài nguyên mới nằm riêng ở thư mục này.

## Quyền sử dụng

Logo và hình thuộc chủ sở hữu tương ứng. Việc có đường dẫn nguồn không tự tạo giấy phép tái sử dụng. Bộ dữ liệu không tự gắn Creative Commons hoặc quyền sở hữu dự án cho ảnh bên ngoài. Khi dùng công khai cần giữ nguồn và rà soát điều kiện của chủ sở hữu.

## Bổ sung Liquipedia — 27/10/2026

`liquipedia-enrichment.json` là lớp nghiên cứu bổ sung, không ghi đè manifest hoặc metadata nguồn chính thức đã nhập.
Lần rà soát này các trang Liquipedia trực tiếp trả HTTP 403. Dữ liệu lấy từ bản thu thập ngày 14–15/10 đã có và tài liệu
Liquipedia được công cụ tìm kiếm lập chỉ mục; không vượt kiểm soát truy cập. Cần giữ riêng ngày lấy nguồn và ngày dữ liệu có hiệu lực.

| Mục | Kết quả bổ sung |
|---|---|
| Hạng theo Liquipedia | AOG/GCS/RPL: A; TEPL: B; QOG: C. Chưa gán hạng cho AIC 2026 hoặc Miss RoV Season 2 khi thiếu trang tương ứng |
| RPL Winter | [Trang thành tích Buriram](https://liquipedia.net/honorofkings/Buriram_United_Esports) ghi vô địch ngày 25/10, thắng FULL SENSE 4:2; [báo Thái ngày 27/10](https://mgronline.com/game/detail/9690000103059) xác nhận. Nguồn thứ cấp có đối chiếu, chưa coi là công bố sơ cấp |
| TEPL | [Liquipedia](https://liquipedia.net/honorofkings/RoV_Thailand_Esports_Premier_League/2026): Gangrocket thắng Satoshi x iBitzz 4:0 ngày 09/08. Có bảng xếp hạng và kết quả chung cuộc trong bản thu thập |
| QOG Winter | [Liquipedia](https://liquipedia.net/honorofkings/Queens_of_Glory/2026/Winter): đã có bảng hai nhóm và 10 kết quả trận ngày 19–22/10; chưa có nhà vô địch vì playoffs chưa kết thúc |
| GCS | [Garena](https://esports.moba.garena.tw/gcs/news/content/5750) xác nhận chung kết 31/10 giữa ANK và Relove DCG; không điền tỷ số trước khi thi đấu |
| Miss RoV Season 2 | Báo Thái 27/10 ghi eArena nữ thắng Hydra nữ 4:2 ngày 25/10. Chưa xác minh được trang Liquipedia cho đúng Season 2; không dùng kết quả mùa đầu thay thế |
| AIC Wildcard | [Liquipedia](https://liquipedia.net/honorofkings/Arena_of_Valor_International_Championship/2026/Wildcard) ghi 16–17/11, 8 đội, 4 suất vào vòng chính; trạng thái lịch từ nguồn thứ cấp, chờ đối chiếu Garena |
| RPL Promotion | [Liquipedia](https://liquipedia.net/honorofkings/RoV_Pro_League/2027/Promotion): vòng tranh suất mùa 2027, dự kiến tháng 11/2026, chưa rõ ngày. Không biến độ chính xác theo tháng thành 01/11 |

Lớp bổ sung gồm 11 bản ghi (9 mục trước và 2 vòng tuyển chọn mới), bốn snapshot bảng xếp hạng cũ có thời điểm chụp,
bốn logo giải/series đã sao chép nguyên byte vào `liquipedia/tournaments/<code>/logo.png`, và tham chiếu tới 24 logo đội
Liquipedia đã có. Tổng file logo giải bổ sung khoảng 879 KiB. `liquipedia-validation.json` kiểm tra checksum và phạm vi.
Chưa thực hiện upload hoặc ghi database trong bước nghiên cứu này.

Các logo AOG/GCS/RPL có thể mang năm trong tên file cũ, nhưng được trang giải 2026 dùng như logo series.
Không tự gắn nhãn đây là thiết kế riêng mùa 2026. Chưa có logo rời đáng tin cậy cho QOG, Miss RoV Season 2 hoặc AIC 2026;
không lấy logo giải khác lấp vào. Các file đã thu thập có đủ nguồn gốc để đưa qua Media của dự án trong bước sau.

Hạng A/B/C, loại league/cup/qualifier, cách tổ chức online/offline, trạng thái diễn ra và trạng thái xuất bản là các thông tin khác nhau.
Hạng do Liquipedia phân loại không thay thế phạm vi giải chuyên nghiệp đã xác nhận. Đặc biệt không đưa giải cộng đồng/học đường
vào chỉ vì có hạng B/C. Khoảng trống Indonesia vẫn giữ nguyên: tìm thấy ACS tháng 4 ngoài phạm vi; Indonesia Kings Laga là HoK.

Một số trang/index Liquipedia cập nhật khác thời điểm: RPL trang tổng hợp còn TBD nhưng trang đội đã ghi vô địch;
QOG nguồn mới ghi Offline/VPS Arena còn bản cũ ghi Online/Offline. Các khác biệt này được giữ trong `crossSourceIssues`
để biên tập viên xem xét, không tự coi dữ liệu mới tìm thấy là đồng nhất với nguồn chính thức.
