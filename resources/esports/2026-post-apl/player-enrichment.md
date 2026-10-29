# Bổ sung tuyển thủ và logo — đợt 1

Rà soát ngày **27/10/2026**. Đây là gói dữ liệu chuẩn bị nhập, không tự ghi database, tạo đội hình thi đấu hay xuất bản.

## Phần có thể nhập

`player-enrichment.json` đã khóa ở `PHASE_1_FROZEN`:

| Nội dung | Số lượng | Nguồn xác minh |
| --- | ---: | --- |
| Tuyển thủ GCS Summer 2026 | 46 | [Công bố đội hình của Garena](https://esports.moba.garena.tw/gcs/news/content/5687) |
| Tuyển thủ GAM ở AOG Winter 2026 | 7 | [Đội hình trên website GAM](https://gam.gg/teams) |
| Tuyển thủ GAM nữ ở QOG Winter 2026 | 6 | [Công bố ngày 11/10 của GAM](https://gam.gg/news/gam-esports-womens-arena-of-valor-team-queens-of-glory) |
| Ánh xạ logo bổ sung đã đối chiếu | 14 | Đồ họa đội tham dự AOG/QOG của Garena và website chính thức của GAM, Team Flash |

Chỉ nhập `verifiedPlayers` và các mục `logoAudit` có `importReady: true`. Không nhập `provisionalPlayers` hoặc `excludedPersonnel`.

Các mã `teamCode` và `eventCode` nối tới hồ sơ đã có trong gói nghiên cứu; đây không phải UUID của database. Phải tra mã để tìm bản ghi hiện hữu, không tự tạo đội hoặc giải khác do khác cách viết tên.

## Giới hạn cần giữ khi nhập

- `country: null`: nguồn xác minh đội hình không đủ để kết luận quốc tịch từng tuyển thủ. Khu vực của đội không phải quốc tịch của người.
- Tám mục có `lane: null`: Kuga, Owen và sáu tuyển thủ GAM nữ. Nguồn hiện tại không ghi rõ đường; “đội trưởng” không phải vị trí thi đấu.
- Danh sách GCS là đội hình được công bố đầu mùa. Một đội có nhiều người cùng vị trí là hợp lệ, nhưng không được tự gán ai đánh chính hoặc dự bị.
- Đội hình GAM trên website là hồ sơ câu lạc bộ hiện tại, không chứng minh cả bảy người đã thi đấu ở từng trận hay từng patch.
- Tên thật chỉ được bổ sung ở nơi câu lạc bộ đã công bố công khai. Không suy đoán tên hoặc danh tính từ ảnh.
- Bổ sung sau khi khóa đợt 1: tên thật của PhuHoang không thống nhất giữa trang GAM đang đọc và bản trang được máy tìm kiếm lưu trước đó. Khi nhập, bỏ trường `fullName` của riêng PhuHoang; nickname, vị trí và đội vẫn khớp. Không ghi đè tên thật đã có.
- Huấn luyện viên, trợ lý và nhân sự khác nằm trong danh sách loại trừ. Dữ liệu nghiên cứu cũ có những dòng nhân sự bị xếp vào nhóm dự bị, nên không thể nhập nguyên danh sách đó thành tuyển thủ.

## Vì sao chưa nhập toàn bộ đội hình AOG cũ

Nguồn thứ cấp có [đội hình mở màn](https://vsgg.com/en/news/19930), nhưng [bản tin chuyển nhượng cuối tháng 9](https://vsgg.com/en/news/20620) ghi nhận Maris/Gray đến RRQ và Bridget trở lại FPT. Vì vậy, danh sách mở màn và đội hình hiện tại không thể dùng thay cho nhau. Trang câu lạc bộ Team Flash vẫn hiển thị một số thành viên cũ, nên một trang chính thức nhưng không có mốc cập nhật cũng chưa đủ để gán quan hệ hiện tại.

`provisionalPlayers` giữ 85 dòng để biên tập viên tiếp tục đối chiếu. Chúng không có quyền ưu tiên hơn nguồn chính thức đã xác minh và không được ghi đè quan hệ đội hiện có. Chưa có gói đội hình đầy đủ đã xác minh cho mọi đội AOG/QOG.

## Logo

Trong 17 đội còn thiếu logo ở database, 14 có ảnh độc lập đã đối chiếu với đồ họa đội tham dự hiện tại. Ba đội **ALG Queen, Five Dragon Princesses, WESC.VHS** mới xác minh được biểu tượng trong ảnh tổng hợp, chưa tìm thấy tệp logo độc lập có nguồn đủ rõ; giữ chỗ trống thay vì cắt ảnh hoặc dùng biểu tượng đội khác.

Mỗi dòng `logoAudit` có đường dẫn, checksum, kích thước và URL nguồn. Biểu tượng của đội nữ được kiểm tra trên [đồ họa QOG Winter riêng](https://lienquan.garena.vn/queens-of-glory-mua-dong-2026-chinh-thuc-khoi-tranh-tu-ngay-19-10-voi-dien-mao-moi/), không lấy quan hệ đội hình nam để suy ra.

- GAM: tải nguyên bản biểu tượng 800×800 từ website câu lạc bộ. Trang công bố đội nữ cũng sử dụng cùng biểu tượng tổ chức.
- FPT x Flash: lấy nguyên bản logo đầu trang từ website chính thức; ảnh ngang và trong suốt, cần hiển thị `contain`.
- SGP: bản logo cũ của đội chính có thêm huy hiệu. Tệp `current-wordmark.png` dùng biểu tượng chữ SGP sạch đã đối chiếu độc lập với đồ họa AOG hiện tại; giữ nguyên byte và ghi nguồn sao chép.
- Một số tệp cũ có độ phân giải thấp, đặc biệt FPT Polytechnic 100×34. Có thể dùng tạm ở kích thước nhỏ, không tự phóng nét hoặc vẽ lại biểu tượng.

Ảnh/logo vẫn thuộc chủ sở hữu tương ứng. Ghi nguồn không đồng nghĩa tài sản có giấy phép Creative Commons hoặc thuộc sở hữu của dự án.

## Ảnh tuyển thủ — đợt phụ riêng

`player-photos-phase2.json` ở `PHASE_2_PHOTOS_FROZEN` chứa bảy ảnh chân dung chuyên nghiệp của GAM nam, tổng khoảng 334 KB. Ảnh được tải nguyên bản từ website GAM, có nguồn và checksum, đã xem kiểm tra. Không tải ảnh giữ chỗ “Photo soon” của đội nữ. Gói ảnh này không thay đổi danh sách đợt 1 và chỉ áp dụng khi bản ghi tuyển thủ tương ứng đã tồn tại.

## Kiểm chứng

`player-enrichment-validation.json` xác nhận 59 mã tuyển thủ không trùng, mã hợp lệ, đội/giải tham chiếu có tệp hồ sơ, vị trí thuộc bộ giá trị cho phép và 14 checksum logo khớp. Không có lỗi. Hash của tệp kế hoạch được ghi trong kết quả để phát hiện thay đổi sau khi bắt đầu nhập.
