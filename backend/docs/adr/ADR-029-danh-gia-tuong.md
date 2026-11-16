# ADR-029 — Đánh giá tướng: số liệu có sẵn, đặc điểm có hay không, nhận định do người viết

**Trạng thái:** Chấp nhận (người dùng duyệt phương án B ngày 2026-11-16), đã triển khai cả ba bước  
**Ngày:** 2026-11-13, viết lại 2026-11-15, cập nhật theo bản triển khai 2026-11-16

## Bối cảnh

### Yêu cầu

Trang tướng của Wiki cần phần đánh giá dựa trên dữ liệu: tướng có sát thương chuẩn không, cơ động đến đâu, trên kèo
những tướng nào, và các khía cạnh khác. Mỗi nhận định phải có căn cứ đọc được và gắn với bản cập nhật, vì tướng đổi
theo bản cập nhật.

### Dữ liệu có sẵn (dữ liệu dev, 13/11/2026)

- **Bộ kỹ năng** (bản 30/10/2026): 130 tướng và dạng chơi được, 560 kỹ năng, đã đọc tay từ ảnh game. Mỗi kỹ năng có mô
  tả, nhãn của game (tối đa hai nhãn), hồi chiêu, bảng thông số theo cấp. Mô tả **không ghi** tầm lướt, tầm đánh hay
  khả năng qua tường (chỉ 3 kỹ năng nhắc tới vượt địa hình).
- **Bốn thanh của game** (Sinh tồn, Tấn công, Hiệu ứng kỹ năng, Độ khó) cho 130 tướng, đã hiện trên trang tướng.
- **Bản chụp đấu hạng** ngày 11/11/2026 (ADR-025): bậc, tỷ lệ thắng, chọn, cấm; sát thương gây ra, sát thương gánh chịu,
  hạ gục, hỗ trợ, vàng; ba tướng mà game ghi là "thắng nhiều khi gặp". 130 tướng, 22 giá trị chờ duyệt, bản chụp chưa
  xác nhận. Chỉ có API Admin.
- **Build đề cử** (ADR-026): 57 tướng. **Thay đổi theo bản** (ADR-016): 34 bộ thay đổi trong 4 bản.
- **Ván giải đấu** (`community-service`): 25.173 ván nhập từ Liquipedia, tất cả là bản nháp chưa kiểm chứng; 17.544 ván
  dùng được cho thống kê. Đường của ván là thứ tự liệt kê trên Liquipedia, chỉ đáng tin từ 2020.

### Bản đề xuất trước và vì sao bỏ

Bản ngày 13/11 tự tính năm trục điểm 0–10 (cơ động, khống chế, chống chịu, xuyên chống chịu, hỗ trợ) từ mô tả kỹ năng
bằng công thức có trọng số, kèm bảng dữ kiện duyệt từng dòng và phiên bản công thức. Kiểm tra trên dữ liệu của dự án
cho thấy:

1. **Trọng số tự đặt dễ cho kết quả trái với người chơi.** Bản đầu cho Florentino cơ động 8,5, cao hơn Nakroth 8,0, vì
   đếm số kỹ năng có dịch chuyển. Trong hai ngày công thức đổi ba lần (0.1 đến 0.3) mà vẫn thiếu dữ liệu: 122 trên 133
   kỹ năng dịch chuyển không có tầm lướt, 121 không rõ qua tường.
2. **Điểm tự tính khớp vừa phải với số thật; số của game thì khớp tốt.** Tương quan hạng (Spearman, 128–130 tướng):
   thanh Tấn công của game với sát thương mỗi trận 0,87; thanh Sinh tồn với sát thương gánh chịu 0,78. Điểm tự tính:
   khống chế và hỗ trợ với thanh Kỹ năng 0,65; chống chịu với sát thương gánh chịu 0,55; cơ động với thanh Độ khó 0,39;
   sát thương tính từ mô tả với sát thương mỗi trận 0,11.
3. **Kèo đấu suy từ kỹ năng không đo được.** Sáu luật (sát thương chuẩn trước tướng trâu, miễn khống trước tướng dựa vào
   khống chế…) thử trên 13.754 ván giải 2020–2026, có hiệu chỉnh sức mạnh hai đội bằng Elo: chênh từ −2,3 đến +0,6 điểm
   phần trăm so với kỳ vọng, không luật nào cho lợi thế.
4. **Thống kê đối đầu ở giải đấu có tín hiệu yếu.** Trong 503 cặp cùng đường đủ 30 ván, 51 cặp lệch khỏi kỳ vọng ở mức
   95% (ngẫu nhiên đã cho khoảng 25), 17 cặp ở mức 99%. Dữ liệu ván lại chưa kiểm chứng.
5. **Đọc mô tả kỹ năng chính xác ở cấp tướng hơn ở cấp từng câu.** So với phần đọc tay 15 tướng: dữ kiện từng kỹ năng
   đúng 42/44 ở 5 tướng chưa dùng để chỉnh luật (2 sót, 3 sai); đặc điểm có hay không ở cấp tướng đúng 45/45 ở 10 tướng
   dùng để chỉnh và 23/24 ở 5 tướng chưa dùng, không đặc điểm nào sai. Một đặc điểm chỉ cần một câu chứng minh trong cả
   bộ kỹ năng.
6. **Có hay không một đặc điểm không làm đổi tỷ lệ thắng.** Tướng có miễn khống chênh +0,2 điểm, tướng tự hồi máu ở hai
   kỹ năng trở lên −0,3 điểm so với kỳ vọng ở giải. Đặc điểm mô tả cách tướng chơi và cách đối phó, không đo mạnh yếu.

Script, dữ liệu xuất và phần đọc tay nằm ở `.local-state/hero-evaluation/` của worktree `hero-evaluation-dc79e8`
(không commit), bản sao script ở thư mục ghi chú chung của các phiên (`danh-gia-tuong/`).

## Các phương án

- **A — Điểm tự tính theo công thức** (bản trước). Bỏ, vì các lý do 1–3 ở trên.
- **B — Số liệu có sẵn, đặc điểm có hay không, nhận định do người viết (chọn).** Số nào cũng có nguồn ngoài dự án hoặc
  do người xác nhận; không có trọng số để tranh cãi; máy chỉ gợi ý.
- **C — Thống kê từ ván giải đấu làm trục chính.** Chưa được: dữ liệu chưa kiểm chứng, tín hiệu yếu (lý do 4). Để sau,
  ADR riêng trong `community-service`.

## Quyết định

Mục **Đánh giá** của trang tướng gồm ba khối, làm theo ba bước độc lập. Bốn thanh của game giữ nguyên chỗ hiện có.
Mỗi khối chỉ hiện khi có nội dung; không khối nào có thì Wiki không hiện mục này.

### Bước 1 — Số liệu trận thật (từ bản chụp đấu hạng)

- Không thêm bảng. Dữ liệu là `hero.ranking_snapshot*` của ADR-025.
- API công khai `GET /heroes/{heroId}/ranking?region=VN&mode=RANKED_ELITE` (hai tham số có mặc định như trên) trả
  `{snapshot, entry}` của bản chụp **đã xác nhận** mới nhất của thị trường và chế độ đó. `snapshot` có mã, thị trường,
  chế độ và nhãn, nhãn kỳ, thời điểm chụp, múi giờ nguồn, số tướng; `entry` có bậc, tỷ lệ thắng, chọn, cấm, năm chỉ số
  (`figures`: `metric`, `value`, `rank`, `of`) và tối đa ba tướng "thắng nhiều khi gặp" (`counters`). Thứ hạng tính
  trong số tướng có giá trị của chỉ số đó, lớn nhất là hạng 1, hòa thì cùng hạng. Giá trị còn cờ chờ duyệt trả `null`
  và không được xếp hạng. Không trả `readText`, ghi chú, dẫn chứng. Chưa có bản chụp xác nhận thì cả hai là `null`;
  bản chụp không có tướng thì `entry` là `null`. Dạng của tướng (ADR-024) đọc theo id của dạng.
- Wiki: thẻ số liệu ghi nguồn "Bảng xếp hạng trong game · {nhãn chế độ} · máy chủ Việt Nam · chụp ngày …". Danh sách
  "thắng nhiều hơn khi gặp" ghi là số của game; ở giải đấu nó chỉ khớp nhẹ (đội cầm tướng đó thắng hơn kỳ vọng 0,7
  điểm trên 22.013 lượt gặp).
- Trước khi mở cho người đọc: duyệt 22 giá trị còn chờ và xác nhận bản chụp; xem lại đơn vị của chỉ số vàng (giá trị
  570–740 chỉ có thể là vàng mỗi phút, ADR-025 đang ghi "trung bình mỗi trận"). Bản nháp nhận định ở Admin đang viết
  "vàng mỗi phút".

### Bước 2 — Đặc điểm có hay không

- **Danh sách cố định 22 đặc điểm**, mã ổn định, nhóm theo năm mục:
  - Sát thương: `TRUE_DAMAGE`, `PERCENT_HP_DAMAGE`, `MISSING_HP_DAMAGE`, `ARMOR_SHRED`.
  - Di chuyển: `DASH`, `WALL_CROSS`, `UNTARGETABLE`, `STEALTH`, `GLOBAL`.
  - Sống sót: `CC_IMMUNE`, `CLEANSE`, `SELF_HEAL`, `SHIELD`, `DAMAGE_REDUCTION`, `REVIVE`.
  - Khống chế: `HARD_CC`, `DISPLACE`, `SILENCE`.
  - Đồng đội: `ALLY_HEAL`, `ALLY_SHIELD`, `ALLY_BUFF`, `VISION`.
  Thêm đặc điểm mới là thêm mã vào danh sách (đổi `CHECK` qua Flyway), không đổi cấu trúc.
- **Mỗi đặc điểm có một dòng chi tiết** theo locale (không bắt buộc, tối đa 300 ký tự), ví dụ "Tài hoa: miễn khống
  3 giây", "Hào hoa: choáng 0,75 giây", và danh sách khóa kỹ năng làm căn cứ (có thể rỗng).
- **Lưu trong phần kỹ năng của bản nháp tướng** (V072), vì đặc điểm dẫn tới khóa kỹ năng và đổi cùng bộ kỹ năng:
  `hero.hero_skill_trait` (`skill_set_revision_id`, `trait_code`), `hero.hero_skill_trait_skill` (thêm `skill_key`,
  khóa ngoại tới kỹ năng của cùng phiên bản), `hero.hero_skill_trait_translation` (thêm `locale`, `detail`). Ba bảng
  dùng trigger `guard_section_child` như các bảng con khác nên bất biến sau khi xuất bản. Không thêm cột vào
  `hero_revision`, không thêm điều kiện xuất bản: tướng chưa duyệt đặc điểm vẫn xuất bản được. Bản nháp mới dùng lại
  phần kỹ năng của bản trước nên giữ nguyên đặc điểm; đặc điểm tự gắn với bản cập nhật, chọn bản cũ trên trang tướng
  (ADR-016) thì hiện đặc điểm của bản đó.
- **Chỉ endpoint riêng đổi đặc điểm.** Lưu phần kỹ năng bằng `PUT .../skills` (kể cả khi nhập dữ liệu) luôn giữ đặc
  điểm đang có, bỏ khóa kỹ năng không còn trong bộ kỹ năng; nội dung `traits` gửi kèm bị bỏ qua. Đổi đặc điểm tạo phiên
  bản kỹ năng mới (sao chép khi ghi), không đổi thì không tạo. Một tướng chứa các dạng (ADR-024) chỉ lưu đặc điểm ở
  từng dạng, như kỹ năng.
- **Admin:** tab **Nhận định** của trang tướng (sau tab Kỹ năng) có khối **Đặc điểm**: 22 ô tick theo năm nhóm. Máy gợi
  ý từ mô tả và nhãn kỹ năng tiếng Việt của bản đang xem, hiện câu làm căn cứ; tick một gợi ý thì điền sẵn kỹ năng, và
  với khống chế, lướt thì điền cả dòng chi tiết (loại, thời gian, diện rộng; hồi chiêu), chỉ khi đang sửa tiếng Việt.
  Các đặc điểm khác để trống dòng chi tiết cho biên tập viên viết, vì tên kỹ năng đã hiện bên dưới. Nút "Đánh dấu N gợi
  ý" tick mọi gợi ý chưa tick. Biên tập viên tick, bỏ
  tick, chọn kỹ năng, sửa dòng chi tiết rồi bấm lưu; hủy khi có thay đổi thì hỏi lại. `WALL_CROSS` chỉ được gợi ý khi mô
  tả ghi rõ (3 kỹ năng, ví dụ Thần hành bách biến của Ryoma); các tướng còn lại do biên tập viên tự đánh dấu. Bộ gợi ý
  là module TypeScript của Admin (`hero-traits.ts`), cho kết quả trùng với script nghiên cứu ở cả 130 tướng; backend
  chỉ kiểm tra mã đặc điểm, khóa kỹ năng và locale hợp lệ. Danh sách 22 mã và tên tiếng Việt, tiếng Anh dùng chung ở
  `@aov/ui/lib/hero-traits`. Quyền như các phần khác của bản nháp tướng (`hero:write`, xuất bản `hero:publish`).
- **API:** Admin `PUT /admin/heroes/{heroId}/drafts/{draftId}/traits` với `expectedDraftVersion`, danh sách `traits`
  đầy đủ (rỗng là xóa hết) và `changeNote`. Công khai: đặc điểm nằm trong nội dung phần kỹ năng đã xuất bản
  (`traits[]`: `code`, `skillKeys`, `detail`, `actualLocale`, `fallbackApplied`; chưa có dòng chi tiết thì `detail`
  là `null`); `GET /hero-traits?region=VN` trả, cho từng mã, các tướng và dạng người đọc đang thấy có đặc điểm đó
  (`{id, code}`), không liệt kê tướng chứa dạng. Không thêm bộ lọc `GET /heroes?trait=`: danh sách tướng cùng đặc điểm
  đọc từ `/hero-traits`.
- **Wiki:** khối **Đặc điểm bộ kỹ năng** nhóm theo năm mục, mỗi nhãn kèm dòng chi tiết (chưa có thì tên các kỹ năng);
  mở "N tướng khác cũng có" để xem các tướng cùng đặc điểm. Không hiện dòng "Không có: …".

### Bước 3 — Nhận định do người viết

- Thêm ba cột văn bản, cho phép `null`, tối đa 4.000 ký tự, vào `hero.hero_profile_translation` (V072): `strengths`,
  `weaknesses`, `counter_tips`. Gắn với phiên bản hồ sơ và locale như tên, mô tả hiện có. Mỗi ý một dòng.
- **Chỉ endpoint riêng đổi nhận định:** `PUT /admin/heroes/{heroId}/drafts/{draftId}/notes` với
  `expectedDraftVersion`, `locale` (phải có sẵn trong hồ sơ), ba ô chữ và `changeNote`; chữ trống là xóa ô đó. Lưu hồ
  sơ bằng `PUT .../profile` (kể cả khi nhập dữ liệu) giữ nguyên nhận định của các locale còn trong hồ sơ.
- **Admin:** khối **Mạnh, yếu và khắc chế** trong tab Nhận định, ba ô chữ theo locale đang đọc, kèm nút "Soạn nháp từ
  dữ liệu" khi sửa tiếng Việt. Nút ghép câu từ số liệu đấu hạng của API công khai ở bước 1 (chỉ số thuộc một phần tư cao
  nhất hoặc thấp nhất, kèm nhãn chế độ và ngày chụp, ví dụ "Gánh nhiều sát thương: 32.452 sát thương gánh chịu mỗi
  trận, hạng 5/128 ở … ngày …"), thanh Sinh tồn của game và các đặc điểm đã lưu (ví dụ "Miễn khống (Tài hoa: miễn
  khống 3 giây): khống chế trước khi tướng vào chiêu, hoặc chờ hiệu ứng kết thúc rồi mới dùng"; "Trang bị giảm hồi máu
  cắt bớt lượng hồi từ …"). Câu không hợp vai trò bị bỏ (ít hạ gục không là điểm yếu của trợ thủ). Bản nháp không ghi
  tên trang bị cụ thể để khỏi lỗi thời; biên tập viên thêm khi viết lại. Ô đang có chữ thì hỏi trước khi thay.
- **Wiki:** ba thẻ Điểm mạnh, Điểm yếu, Cách khắc chế, mỗi dòng một ý; ô trống thì không hiện thẻ đó.
- Nhận định viết bằng lời của dự án từ số liệu của dự án; không chép đánh giá từ trang khác.

### Không làm trong ADR này

- Điểm 0–10 tự tính, biểu đồ năm trục, phiên bản công thức, bảng dữ kiện duyệt từng dòng.
- Danh sách "trên kèo / dưới kèo" suy ra từ kỹ năng.
- Thống kê tướng ở giải đấu (đường thật, thắng theo độ dài ván, đối đầu, hợp cạ). Khi dữ liệu ván được kiểm chứng và
  có id tướng, viết ADR riêng trong `community-service`. Ngưỡng đã thử: tỷ lệ thắng luôn kèm số ván, khoảng tin cậy
  Wilson 95% và kỳ vọng theo Elo; chỉ gọi "rõ" ở mức 99%; cặp cùng đường từ 30 ván, cặp khác từ 60 ván, ván từ 2020.

## Đánh đổi

- Không có con số tổng hợp kiểu "cơ động 7/10". So sánh hai tướng dựa vào số liệu trận thật, đặc điểm và lời nhận
  định; người đọc phải đọc nhiều hơn một con số.
- Số liệu trận thật phụ thuộc việc chụp lại định kỳ; tướng mới chưa có bản chụp thì trống khối này. Khoảng thời gian
  game dùng để thống kê không biết.
- Đặc điểm có hay không không nói mức độ (miễn khống 0,5 giây và miễn khống mỗi lần tung chiêu cùng một nhãn); dòng chi
  tiết và nhận định bù phần này.
- `WALL_CROSS` và mọi thứ mô tả không ghi cần người biết game điền.
- Bộ gợi ý ở Admin không được backend kiểm tra; sai thì biên tập viên sửa trước khi xuất bản.
- Đặc điểm và nhận định nằm trong phần kỹ năng và hồ sơ, nên so sánh hai phiên bản ở Admin cũng thấy chúng đổi (đường
  dẫn `/traits` của phần kỹ năng, các ô nhận định của hồ sơ). Đó là thay đổi biên tập, không phải thay đổi theo bản cập
  nhật của game (ADR-016 ghi riêng các bộ thay đổi).

## Kiểm chứng

Đã làm trên dữ liệu dev, chỉ đọc: các phép đo ở mục "Bản đề xuất trước và vì sao bỏ", gồm tương quan điểm với số thật,
sáu luật khắc chế, thống kê đối đầu có hiệu chỉnh Elo, độ đúng của gợi ý đặc điểm so với 15 tướng đọc tay.

Đã có khi triển khai:

- Bước 1: kiểm thử tích hợp chỉ trả bản đã xác nhận, giá trị chờ duyệt thành `null`, thứ hạng đúng, tướng vắng mặt
  trong bản chụp, chế độ chưa có bản chụp, tham số sai.
- Bước 2: kiểm thử tích hợp endpoint riêng, giữ đặc điểm khi lưu phần kỹ năng và bỏ khóa kỹ năng đã xóa; mã lạ, mã
  trùng, khóa kỹ năng lạ, phiên bản cũ và thiếu quyền bị từ chối; nội dung công khai có `traits`; `/hero-traits`; nhật
  ký kiểm toán. Kiểm thử đơn vị đọc đặc điểm của nhiều phiên bản kỹ năng; kiểm thử Admin của bộ gợi ý, của việc tick
  gợi ý và bút chì khi chưa có bản nháp. Bộ gợi ý trùng với script nghiên cứu ở 130/130 tướng.
- Bước 3: kiểm thử tích hợp lưu nhận định theo locale (locale chưa có trong hồ sơ bị từ chối, chữ trống thành `null`)
  và giữ khi lưu hồ sơ; kiểm thử Admin của bản nháp nhận định với số liệu mẫu và khi chưa có bản chụp xác nhận.

## Việc đã quyết (2026-11-16)

1. Hiện số liệu lấy từ bảng xếp hạng trong game, kèm ghi nguồn và ngày chụp.
2. `WALL_CROSS` do biên tập viên tự đánh dấu trong Admin theo hiểu biết game.
3. Nhận định chỉ hiện khi đã có người viết; bản nháp máy soạn chỉ nằm trong ô chữ của Admin cho tới khi lưu.
4. Làm cả ba bước.

Còn mở: tần suất chụp lại đấu hạng (gợi ý: mỗi tuần và ngay sau mỗi bản cập nhật cân bằng).

## Phụ lục: xem trước trên 10 tướng (dữ liệu dev)

| Tướng | Đấu hạng 11/11: bậc, thắng, chọn | Đặc điểm máy gợi ý |
|---|---|---|
| Florentino | T0, 48,5%, 16,4% | Sát thương chuẩn, theo % máu; lướt; miễn khống; tự hồi máu; khống chế cứng |
| Ryoma | T1, 50,2%, 15,9% | Lướt, qua được tường (mô tả có ghi); tự hồi máu; khống chế cứng |
| Maloch | T2, 50,3%, 10,2% | Sát thương chuẩn; lướt; tự hồi máu; lá chắn; khống chế cứng |
| Nakroth | T0, 48,9%, 35,7% | Lướt; miễn khống; giảm sát thương; khống chế cứng |
| Liliana | T2, 48,4%, 7,2% | Theo % máu; lướt; miễn khống; giảm sát thương; khống chế cứng |
| Marja | T2, 52,1%, 6,9% | Lướt; không thể bị chọn; miễn khống; giải khống; tự hồi máu |
| Hayate | T0, 48,2%, 30,8% | Sát thương chuẩn; lướt |
| Violet | T0, 49,9%, 33,5% | Mạnh khi mục tiêu mất máu; giảm giáp; lướt |
| Toro | T0, 49,4%, 24,1% | Lướt; miễn khống; tự hồi máu; lá chắn; giảm sát thương; khống chế cứng |
| Rouie | T3, 46,9%, 3,1% | Hồi máu, tăng tốc cho đồng đội; hiện diện tầm bản đồ; câm lặng; đẩy lùi. Máy gợi ý thêm "tự hồi máu" từ Thần môn; biên tập viên nên bỏ, vì chiêu chỉ hồi đầy máu khi đã về tế đàn |

Trang xem trước có hình (riêng tư): https://claude.ai/artifact/AJ7cDtXp6S9rUppCKf4MJf
