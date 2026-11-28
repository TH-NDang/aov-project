# ADR-037 — Dịch bài đăng Stream bằng Claude API

**Trạng thái:** Chấp nhận  
**Ngày:** 2026-11-28

## Bối cảnh

- Stream có bài đăng tiếng Việt, tiếng Anh, tiếng Thái và tiếng Trung. Chủ dự án muốn mỗi bài có nút Dịch, có thiết lập
  tự dịch, và khi ảnh trong bài có chữ khác ngôn ngữ thì có một dòng dịch nói ảnh đang ghi gì.
- Chủ dự án chọn Claude API (28/11/2026), so bản dịch của 20 bài mẫu kèm ảnh game thật, rồi chọn Claude Haiku 5.5 và
  yêu cầu cải thiện prompt thay vì đổi model.
- Lỗi hay gặp nhất là thuật ngữ game: tên phép bổ trợ, quái lớn, hạng, đường và tiếng lóng bị dịch từng chữ ("Trừng trị"
  thành "Punishment", "bùa xanh" thành "blue charm"). Tên chính thức từng khu vực lấy từ trang chính của game (Garena Liên
  Quân, Garena RoV, Garena 傳說對決, Arena of Valor quốc tế) và đã nằm một phần trong bảng thuật ngữ dùng chung (ADR-011)
  cùng tên trong danh mục tướng, trang bị, phép bổ trợ, ngọc và phù hiệu của wiki-service.

## Quyết định

**Nơi dịch.** `community-service` dịch, trong capability `translation`. Khóa `ANTHROPIC_API_KEY` chỉ nằm trong môi trường
của service này, không bao giờ ở frontend. Không có khóa thì `GET /translation` trả `enabled: false` và Stream ẩn nút
Dịch.

**Model và lời gọi.**

- Model `claude-haiku-5-5` (đổi bằng `COMMUNITY_TRANSLATION_MODEL`), effort `medium`, tối đa 8000 token ra, hết giờ sau 60
  giây, SDK Java chính thức thử lại một lần khi lỗi mạng.
- Câu trả lời theo structured output: một JSON đóng gồm `targetLanguage` (chỉ nhận đúng ngôn ngữ đích), `sourceLanguage`,
  `title`, `body` và mỗi ảnh một dòng `{index, hasText, language, translatedText}`. Ảnh gửi trước, chữ của bài gửi sau.
- System prompt có quy tắc (chỉ viết ngôn ngữ đích, bảng thuật ngữ thắng, giữ nguyên thẻ tham chiếu, tên tướng, hashtag,
  link, emoji, cách viết số của ngôn ngữ đích, giữ giọng và xuống dòng, cách đọc ảnh), bảng thuật ngữ của riêng bài và ba
  ví dụ ngắn. Phiên bản prompt (`TranslationPrompt.VERSION`) nằm trong mã băm của bản dịch, nên đổi prompt thì bản cũ được
  dịch lại khi có người đọc.

**Thuật ngữ.**

- community-service đọc `GET /api/wiki/v1/reference-catalog?region=VN&locale=X` công khai của wiki-service cho từng ngôn
  ngữ của bảng thuật ngữ (vi-VN, en-US, th-TH, zh-TW), giữ 15 phút, hỏi lại bằng ETag. Thuật ngữ, trang bị, phép bổ trợ,
  ngọc và phù hiệu thành mục dịch; tên tướng chỉ dùng để kiểm tra ngôn ngữ vì tướng giữ tên ở mọi khu vực.
- Đây là ngoại lệ của ADR-011: ADR-011 nói service khác không tự nhận diện thuật ngữ trong văn bản. Ở đây community-service
  chỉ tìm các tên đã có trong danh mục để đưa vào prompt, không lưu, không hiện ra trang và không thay cách Wiki hay Stream
  tô sáng thuật ngữ.
- Chỉ những mục bài viết dùng mới vào prompt. Chữ Latinh khớp nguyên từ; chữ Thái và chữ Hán khớp ở bất kỳ đâu. Tên viết
  thường khớp mọi kiểu chữ hoa; tên có chữ hoa sau chữ đầu (hạng "Kim Cương") chỉ khớp đúng như vậy để không bắt từ thường.
  Hai mục chồng nhau thì mục dài hơn thắng. Chữ nằm trong thẻ tham chiếu được bỏ qua.
- Bài có ảnh nhận thêm tới 150 thuật ngữ khác để đọc chữ trong ảnh (cửa hàng, bảng ngọc), không kiểm tra.
- Thuật ngữ mới cho việc dịch (hạng, quái lớn, đường, vai trò, tiếng lóng, tên phép bổ trợ tiếng Anh) được seed bằng
  migration của wiki-service với `auto_match = false`, nên Wiki và Stream không tô sáng thêm chữ nào. Biên tập viên sửa tên
  và tên gọi khác theo từng ngôn ngữ ở trang Thuật ngữ của Admin.

**Kiểm tra câu trả lời.** Mỗi câu trả lời được kiểm tra: đủ thẻ tham chiếu như bản gốc, có tiêu đề khi bài có tiêu đề,
đúng ngôn ngữ đích (sau khi bỏ thẻ tham chiếu, trích dẫn, chữ viết tắt và tên tướng), đủ số ảnh, có chữ khi `hasText`, và
mỗi thuật ngữ chắc chắn của bảng xuất hiện trong bản dịch (cho phép số nhiều và đuôi tiếng Anh). Có lỗi thì gọi lại một lần
kèm câu trả lời đầu và danh sách lỗi; giữ câu trả lời ít lỗi hơn. Lỗi còn lại được lưu cùng bản dịch để xem sau.

**Ảnh.** Đọc tối đa 4 ảnh đầu của bài, mỗi ảnh tới 5 MB, chỉ từ máy chủ ảnh trong `COMMUNITY_TRANSLATION_IMAGE_HOSTS`
(production chỉ `img.athahub.com`), chỉ HTTPS, không theo chuyển hướng; loại ảnh đọc từ byte đầu (JPEG, PNG, GIF, WebP).
Ảnh không đọc được thì bỏ qua và bản dịch không được lưu, để lần sau dịch lại cùng ảnh.

**Lưu và giới hạn.**

- `community.post_translation` (V030) giữ một bản dịch cho mỗi bài và ngôn ngữ, kèm mã băm của model, phiên bản prompt,
  tiêu đề, nội dung và link ảnh. Bài đổi thì mã băm đổi và bài được dịch lại khi có người đọc. Xóa bài thì xóa bản dịch.
- Bài đã cùng ngôn ngữ người đọc và không có ảnh được trả ngay, không gọi model (`sameLanguage: true`).
- Mỗi tài khoản hoặc địa chỉ được bắt đầu 30 bản dịch mới mỗi giờ (`COMMUNITY_TRANSLATION_HOURLY`); đọc bản đã lưu không
  tính. Hai người cùng mở một bài mới chờ chung một lời gọi.
- `community.translation_usage` cộng token và chi phí của từng lời gọi theo tháng (UTC), theo giá trong cấu hình. Đạt
  `COMMUNITY_TRANSLATION_MONTHLY_BUDGET_USD` (mặc định 5) thì dừng dịch mới tới tháng sau; bản đã lưu vẫn đọc được. Nên đặt
  thêm giới hạn chi tiêu của workspace trong Claude Console.

**API.** `GET /api/community/v1/translation` trả `{enabled, locales}`. `GET /api/community/v1/posts/{id}/translation?locale=`
trả bài đã dịch, không cache ở trình duyệt. Lỗi: 400 `TRANSLATION_UNSUPPORTED_LOCALE`, 404 khi bài không công khai, 429
`TRANSLATION_RATE_LIMITED`, 502 `TRANSLATION_FAILED`, 503 `TRANSLATION_UNAVAILABLE` với `reason` là `disabled` hoặc
`budget`.

**Tự dịch.** Hồ sơ người dùng có cờ `autoTranslate` (wiki-service, V089). Khách dùng bộ nhớ của trình duyệt. Khi bật,
Stream dịch dần các bài đang hiện trên màn hình sang ngôn ngữ giao diện, vài bài một lúc.

## Hệ quả

- Mỗi bài chỉ tốn tiền một lần cho mỗi ngôn ngữ, tới khi bài, model hoặc prompt đổi. Ước tính một bài có ảnh dùng vài
  nghìn token vào và khoảng một nghìn token ra, dưới 0,1 xu theo giá Haiku 5.5.
- Ngân sách đếm theo giá ghi trong cấu hình; đổi model thì phải đổi giá theo. Hai lời gọi cùng lúc ở cuối tháng có thể vượt
  ngân sách một chút.
- Bảng thuật ngữ đúng tới đâu thì bản dịch đúng tới đó: sửa tên ở Admin có hiệu lực cho bài dịch sau tối đa 15 phút, nhưng
  bản đã lưu không tự dịch lại.
- Wiki-service ngừng thì dịch vẫn chạy với bảng thuật ngữ đọc lần trước, hoặc không có bảng nếu chưa đọc được lần nào.
