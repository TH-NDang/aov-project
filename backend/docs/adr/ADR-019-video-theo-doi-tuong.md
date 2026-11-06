# ADR-019 — Gắn video cho tướng, kỹ năng, trang phục và kho trang bị

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-06

## Bối cảnh

Người biên tập cần gắn nhiều video cho cùng một đối tượng: tướng có video cách chơi cơ bản và video
combo nâng cao, từng kỹ năng có video riêng, trang phục có video hiệu ứng, tướng có video cốt truyện.
Sau khi tướng đổi ở một patch có thể cần thêm video mới. Ngoài video nhập tay còn có dữ liệu thu thập
từ hai kênh YouTube của Garena (repo `lienquan-youtube-crawl`), trong đó một phần khớp chắc chắn với
trang phục và tướng, một phần chỉ là gợi ý.

ADR-005 chỉ cho nhúng player, không lưu hoặc chuyển mã video. ADR-015 tham chiếu video bằng liên kết
YouTube. Quyết định này giữ nguyên hai ràng buộc đó.

Video không phải dữ liệu gameplay: thêm một video không nên tạo revision tướng, không nên phải qua
chu trình nháp và xuất bản của tướng, và không làm thay đổi snapshot đã công bố.

## Quyết định

- Thêm module `video` với schema riêng `video` và bảng `video.subject_video`. Một dòng là một video
  gắn vào một đối tượng, nên một đối tượng có bao nhiêu video tùy ý.
- Đối tượng được xác định bằng `subject_kind`, `subject_id`, `subject_key`:
  - `HERO`, `ITEM`, `ENCHANTMENT`, `ARCANA`, `SPELL`: `subject_id` là định danh của mục, không có key.
  - `SKILL`, `SKIN`: `subject_id` là định danh tướng, `subject_key` là khóa kỹ năng hoặc trang phục.
- Không có khóa ngoại sang module khác. Module sở hữu đối tượng cài port `VideoSubjectProvider` ở gốc
  module `video`: kiểm tra đối tượng tồn tại khi ghi và trả danh mục đối tượng cho màn hình quản trị.
  Module `video` không đọc bảng của module khác.
- `purpose` nói video dùng để làm gì (`INTRO`, `GUIDE_BASIC`, `GUIDE_ADVANCED`, `SKILL_DEMO`,
  `SKIN_SHOWCASE`, `SKIN_TRAILER`, `LORE`, `PATCH_CHANGE`, `OTHER`).
- `patch_variant_id` tùy chọn nghĩa là "video này áp dụng từ patch này". Dữ liệu không gắn với revision
  tướng. Trang công khai ẩn video của patch mới hơn patch đang xem và ẩn video của patch chưa công bố.
- Backend là nơi chuẩn hóa liên kết: chỉ nhận `http`/`https`; mọi dạng link YouTube (`youtu.be`,
  `watch?v=`, `/shorts/`, `/embed/`, `/live/`) được đổi về một URL chuẩn cùng `provider_video_id`. Nền
  tảng khác giữ nguyên liên kết.
- Frontend quyết định cách phát từ liên kết, dùng chung `@aov/ui/lib/video-playback`, và phát ngay trong trang
  bằng player chính thức của nền tảng: YouTube (video, playlist), Facebook (video, reel), TikTok (link đầy đủ),
  Twitch (video, clip, kênh); tệp `.mp4`, `.webm` qua https dùng thẻ `<video>`. Vẫn chỉ là nhúng, không lưu
  hay chuyển mã. Link rút gọn `vm.tiktok.com` cần redirect nên trình duyệt không đọc được, và các trang khác
  không cho nhúng, nên vẫn mở ở tab mới.
- Một đối tượng không có hai dòng trùng `(url, start_seconds)`. Cùng một video có thể gắn nhiều lần với
  mốc bắt đầu khác nhau, ví dụ phần cơ bản và phần combo trong cùng một video dài.
- `status` có ba giá trị: `PUBLISHED` hiện công khai, `DRAFT` chờ duyệt, `HIDDEN` đã bác. Nhập lại dữ
  liệu thu thập bỏ qua dòng đã có, nên video đã bác không quay lại hàng chờ. `origin` phân biệt
  `MANUAL` và `IMPORT`.
- Quyền dùng lại capability của đối tượng, không thêm role: tướng, kỹ năng, trang phục cần `hero:write`;
  mục kho cần `item:write`, `enchantment:write`, `arcana:write`, `spell:write`. Đưa video vào hoặc ra
  khỏi trạng thái `PUBLISHED` cần thêm capability `:publish` tương ứng.

## Nhập dữ liệu thu thập

Admin đọc file JSON của repo thu thập trong trình duyệt, so khớp với danh mục đối tượng, cho xem trước
rồi gửi từng lô tới `POST /admin/videos/import`. Backend không gọi mạng ngoài và không biết định dạng
của repo thu thập.

- Trang phục khớp đúng tên trong tướng, video loại hiệu ứng/trailer/phim/màn chọn: `PUBLISHED`.
- Trang phục khớp một phần, hoặc video quảng bá: `DRAFT`.
- Loại video khác trong danh mục trang phục (sự kiện, nhạc, giải trí): bỏ qua.
- Video cốt truyện, truyện tranh, hoạt hình có gắn tướng: `PUBLISHED` với `purpose = LORE`. Video
  fanmade: `DRAFT`.
- Video giới thiệu và hướng dẫn của tướng: `DRAFT`, vì phân loại tự động không đủ chắc để công khai.

## Hệ quả

- Thêm hoặc bỏ video có hiệu lực ngay, không phụ thuộc chu trình xuất bản của tướng và không tạo
  revision. Lịch sử thay đổi nằm trong audit log.
- Không có khóa ngoại nên xóa đối tượng không xóa video. Hiện tướng và mục kho không bị xóa khỏi hệ
  thống; nếu sau này có, module sở hữu phải báo cho `video`.
- Khóa trang phục và kỹ năng phải ổn định. Alias hiện chỉ dùng để quy đổi khi import; đổi khóa đã phát
  hành phải cập nhật `video.subject_video` trong cùng migration.
- Trang công khai chỉ tải ảnh xem trước và chỉ tạo player khi người đọc bấm phát, nên trang không bị chậm vì
  nhiều player. YouTube dùng `youtube-nocookie.com`; Facebook, TikTok, Twitch có thể đặt cookie của họ sau khi bấm phát.
- Video bị chủ kênh xóa hoặc tắt nhúng sẽ không phát được. Không có việc kiểm tra định kỳ trong phạm vi
  này; người đọc vẫn có liên kết mở trên YouTube.
