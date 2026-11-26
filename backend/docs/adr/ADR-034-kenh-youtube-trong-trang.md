# ADR-034 — Xem kênh YouTube ngay trong trang

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-26

## Bối cảnh

Hồ sơ tổ chức, đội, tuyển thủ và nhân sự có link YouTube trong phần mạng xã hội. Trước đây bấm icon thì mở một thẻ nhỏ
rồi sang youtube.com. Người dùng muốn bấm icon là xem được kênh ngay trong Stream: ảnh bìa, ảnh đại diện, tên, số người
đăng ký, video mới nhất, phát video tại chỗ, cuộn để xem video cũ hơn.

Không nhúng được nguyên trang youtube.com (YouTube chặn đặt trang của mình trong khung), nên khung kênh phải là giao diện
của Stream dựng từ dữ liệu của kênh. YouTube có hai nguồn: feed `feeds/videos.xml` miễn phí, chỉ 15 video mới nhất, không
có ảnh kênh hay số liệu; và YouTube Data API v3, có đủ nhưng cần khóa và tính hạn mức (10.000 đơn vị miễn phí mỗi ngày,
mỗi lần gọi danh sách là 1 đơn vị).

## Quyết định

- `community-service` đọc kênh, vì hồ sơ và link của chúng nằm ở đây. Mã nằm trong module `community`, phần
  `internal/channels`; YouTube nằm sau port `YouTubeSource`.
- Chỉ đọc kênh mà một hồ sơ đã công bố đang link tới: `GET /pages/{id}/youtube-channel?url=` nhận link đúng như hồ sơ
  ghi (sau khi áp phần trình bày của người đại diện, giống hồ sơ công khai). Link khác trả 404. Nhờ vậy hạn mức chỉ tiêu
  cho kênh của trang, không ai dùng service làm proxy đọc kênh bất kỳ.
- Hồ sơ vẫn chỉ lưu link, không lưu video. Kênh được nhận ra từ link: `channel/<id>`, `@<handle>`, `c/<tên>` (thử như
  handle), `user/<tên>` và địa chỉ cũ `/<tên>`.
- Thông tin kênh (tên, handle, mô tả, ảnh đại diện, ảnh bìa, số người đăng ký, số video) lấy từ Data API
  (`channels.list`), giữ 24 giờ. Video mới nhất lấy từ feed, rồi gọi `videos.list` một lần để có độ dài, lượt xem và trạng
  thái phát trực tiếp; giữ 30 phút. Video cũ hơn lấy từ danh sách tải lên của kênh (`playlistItems.list`, 24 video một
  lần, có `pageToken`) rồi `videos.list`; mỗi phần giữ 30 phút. Feed hỏng thì phần đầu danh sách tải lên thay cho feed.
- Cache nằm trong bộ nhớ của service (Caffeine, có giới hạn số mục), không dùng Redis: service chạy một bản trên một máy
  (ADR-021), dữ liệu nhỏ, mất cache khi khởi động lại chỉ tốn vài lần gọi. Một yêu cầu vừa lỗi thì một phút sau mới hỏi
  lại YouTube, để YouTube sập không biến mỗi lượt xem thành một lần gọi.
- Service tự đếm đơn vị đã dùng trong ngày theo giờ Thái Bình Dương (giờ Google đặt lại hạn mức) và dừng ở
  `community.youtube.daily-units` (mặc định 8.000). Google báo hết hạn mức thì cũng dừng tới hết ngày. Khi dừng, kênh
  link bằng id vẫn hiện từ feed; kênh link bằng handle và phần video cũ trả 503 `CHANNEL_UNAVAILABLE`.
- Khóa đọc từ biến môi trường `YOUTUBE_API_KEY` (thuộc tính `community.youtube.api-key`), gửi trong header
  `X-Goog-Api-Key`, không bao giờ nằm trong URL, log hay `toString` của cấu hình. Không có khóa thì chỉ kênh link bằng id
  được hiện, từ feed.
- Stream mở khung kênh khi bấm icon của link kênh YouTube: bảng trượt từ phải trên màn hình rộng, cả màn hình trên điện
  thoại. Video phát bằng trình phát `youtube-nocookie.com` ngay trong khung. Nút Đăng ký mở trang đăng ký của YouTube vì
  chỉ YouTube làm được việc đó. Link khác (video, Facebook, TikTok…) giữ thẻ nhỏ như cũ.

## Hệ quả

- Không thêm dịch vụ hay bảng mới. Thêm thư viện Caffeine vào `community-service`.
- Mỗi kênh tốn khoảng 1 đơn vị mỗi ngày cho thông tin kênh và 1 đơn vị mỗi 30 phút có người xem cho video mới; cuộn xem
  video cũ tốn 2 đơn vị mỗi phần. Hạn mức miễn phí dư nhiều so với số kênh hiện có.
- Feed của YouTube từng có lúc trả lỗi hàng loạt; khi đó Data API thay thế nếu có khóa.
- Link bằng handle và link bằng id của cùng một kênh là hai khóa cache khác nhau; cả hai trỏ về cùng id nên video dùng
  chung cache.
- Không lưu video vào cơ sở dữ liệu. Nếu sau này cần gắn video với giải, trận hay tuyển thủ, hoặc cho admin ẩn video,
  cần một ADR mới.
