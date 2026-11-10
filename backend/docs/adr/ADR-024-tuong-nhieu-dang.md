# ADR-024 — Tướng nhiều dạng (Flowborn)

**Trạng thái:** Chấp nhận (phương án B) theo quyết định của người dùng ngày 10/11/2026  
**Ngày:** 2026-11-10

## Bối cảnh

### Trong game

- Flowborn là **một** tướng: tên “Flowborn”, danh hiệu “Hậu duệ Khởi Nguyên”. Cạnh tên có nút đổi dạng; mở ra
  là danh sách biểu tượng các dạng (xạ thủ, pháp sư…).
- Mỗi dạng có vai trò, sở trường, thanh đánh giá (Sinh mệnh, Sát thương, Hiệu ứng kỹ năng, Độ khó), bộ kỹ năng
  và chỉ số riêng. Giá bán theo dạng hay theo tướng chưa được xác minh. Trang phục có thể dùng chung.
- Số dạng sẽ tăng. Dữ liệu giải đấu đã nhập (Liquipedia, community DB dev) có 741 lượt chọn/cấm “Flowborn Ad”,
  27 lượt “Flowborn Mage” và 4 lượt “Flowborn Tank”: game gốc đã có dạng đỡ đòn. Các trang thống kê ngoài cũng
  tách Flowborn (Marksman), (Mage), (Tank) thành ba mục chọn riêng. Chưa có nguồn đáng tin cho luật cấm/chọn
  (cấm một dạng có cấm các dạng khác không); ADR này không mô hình hóa luật đó.
- Nội tại và chiêu 1 của hai dạng trùng tên và biểu tượng (“Dòng chảy năng lượng”, “Dòng chảy hội tụ”); chiêu 2
  và chiêu 3 khác nhau.

### Trong dự án hiện tại

- Flowborn là hai tướng độc lập: `flowborn-ad` (MARKSMAN, DRAGON; revision 1, 2, 4 đã xuất bản, nháp 5) và
  `flowborn-mid` (MAGE, MID; chưa xuất bản, chỉ có nháp 2). Garena có hai trang `.../d/flowborn/` (xạ thủ) và
  `.../d/flowborn-2/` (pháp sư). Chưa có giá shop, alias hay external identity cho Flowborn.
- Gần như mọi dữ liệu tướng khóa theo `hero_id` UUID:
  - section revision gắn với revision cùng tướng qua FK `(section_id, hero_id)`; mỗi `(hero, ruleset)` có tối đa
    một nháp; bản đã xuất bản và lịch sử thay đổi được trigger bảo vệ;
  - kỹ năng `(hero_id, skill_key)` với quy ước `skill-<ô>-<biến thể>`; thư viện ảnh kỹ năng
    UNIQUE(`hero_id`, `source_slot`, `variant_no`); change set UNIQUE(`patch_variant_id`, `hero_id`); giá shop
    khóa `(hero_id, region, captured_on)`;
  - token tham chiếu kỹ năng `<ref=skill:<heroUUID>.<skillKey>>` (regex frontend không nhận đoạn thứ ba);
    video, media usage, audit và lượt chọn trong giải đấu lưu UUID tướng; ảnh minh họa kỹ năng và ảnh gốc trong
    Admin tìm theo **mã** tướng (`flowborn-ad-2-1.png`, `/__patch-captures/<patch>/heroes/<code>.json`).
- `formKey` của kỹ năng hiện là nhãn tự do cho trạng thái trong trận (“Sóc nhỏ”, “Cường hóa”, “Phi hành”),
  không liên quan tới dạng của Flowborn. ADR này không đổi ý nghĩa của `formKey`.
- Wiki dùng `/hero/<code>`; canonical không được chứa query string (ADR-022). Admin dùng `/hero/<uuid>`.

## Các phương án

### A — Một tướng, dạng nằm trong revision

Mỗi revision của `flowborn` chứa vai trò, đánh giá, chỉ số, kỹ năng, ảnh theo từng dạng; một nháp và một lần
xuất bản cho mọi dạng.

- Thêm chiều “dạng” vào mọi section và mọi luồng (soạn, import, so sánh, change set, sẵn sàng xuất bản, đọc
  công khai) cho cả 130 tướng, dù chỉ một tướng cần.
- Phải chuyển `hero_id` của các dòng đã xuất bản/chỉ-thêm của `flowborn-mid` sang tướng mới, gộp hai chuỗi
  revision, và viết lại tham chiếu bên ngoài: token `@`, 741 ván đấu ở community DB, video, media usage, audit.
- Hai dạng cùng có `skill-2-1`, cùng ô 1–3: đụng khóa kỹ năng, thư viện ảnh và các regex `^skill-<ô>-<biến thể>`;
  token `@` phải có thêm đoạn dạng.
- Giải đấu lưu lượt chọn bằng một UUID: gộp làm mất thông tin dạng đã chọn, và luật không chọn lại tướng trong loạt
  sẽ coi “xạ thủ ván 1, pháp sư ván 2” là chọn lại.
- Đụng toàn bộ trang tướng Admin đang được phiên khác sửa.

### B — Tướng là danh tính danh mục, mỗi dạng là một thực thể chơi được gắn vào tướng (khuyến nghị)

Mô tả ở phần Quyết định.

### C — Giữ hai tướng, chỉ thêm liên kết “xem dạng khác”

Danh sách vẫn có hai Flowborn, tên/danh hiệu/trang phục chung phải nhập hai lần, không có trang một tướng. Không
đáp ứng yêu cầu.

## Quyết định (phương án B)

### Hai khái niệm

- **Tướng** (catalog hero): thứ người đọc duyệt, tìm và mở bằng `/hero/<code>`. Flowborn là một tướng.
- **Dạng** (form): thứ người chơi chọn trong trận và sở hữu gameplay — vai trò, vị trí, đánh giá, chỉ số, kỹ năng,
  lịch sử cân bằng. Tướng thường là tướng có đúng một dạng ngầm định, nên không đổi gì với 129 tướng còn lại.
- Một dạng được lưu bằng chính aggregate tướng hiện có (`hero.hero` + chuỗi revision). `flowborn-ad` và
  `flowborn-mid` **giữ nguyên UUID, mã, revision, nháp, change set, ảnh**; chúng trở thành dạng của tướng mới
  `flowborn`. Mọi tham chiếu đã lưu tới một dạng (token `@`, lượt chọn giải đấu, video, ảnh, ảnh gốc theo mã)
  tiếp tục đúng mà không cần viết lại.

### Lưu trữ

- Bảng mới `hero.hero_form`:

  | Cột | Kiểu | Quy tắc |
  |---|---|---|
  | hero_id | UUID | PK, FK `hero.hero` — tướng nội bộ của dạng |
  | parent_hero_id | UUID | FK `hero.hero` — tướng chứa dạng |
  | form_key | VARCHAR(32) | slug, UNIQUE(`parent_hero_id`, `form_key`) |
  | display_order | INTEGER | ≥ 1, UNIQUE(`parent_hero_id`, `display_order`); dạng đầu là dạng mặc định |
  | created_at, created_by_issuer, created_by_subject | | như các bảng khác |

- Chỉ một cấp: tướng chứa dạng không thể là dạng; dạng không có dạng con; một tướng nội bộ thuộc tối đa một tướng.
  Mã dạng phải là `<mã tướng>-<form_key>` (`flowborn-ad` = `flowborn` + `ad`), nên đường dẫn và mã luôn suy ra
  được nhau. Trigger kiểm tra các điều này.
- Bảng này là cấu trúc, không theo revision: đổi danh sách dạng có hiệu lực ngay, cần quyền `hero:publish` và ghi
  audit `HERO_FORMS_UPDATED`.

### Nội dung chung và nội dung theo dạng

| Nội dung | Tướng chứa dạng (`flowborn`) | Dạng (`flowborn-ad`, `flowborn-mid`) |
|---|---|---|
| Tên, danh hiệu, mô tả, tiểu sử (bản dịch) | Có — hiển thị ở đầu trang | Tên là **tên đầy đủ của dạng** dùng khi dạng đứng một mình (bộ chọn, ván đấu, ghi chú cập nhật), ví dụ “Flowborn Xạ thủ”; mô tả là gợi ý của dạng; danh hiệu/tiểu sử không hiển thị |
| Vai trò, vị trí | Không lưu; hiển thị bằng hợp các dạng theo thứ tự | Có |
| Đánh giá tổng quan, chỉ số, kỹ năng (cả biểu tượng trạng thái, thư viện ảnh kỹ năng) | Không có — section rỗng | Có |
| Trang phục | Trang phục dùng chung cho mọi dạng | Trang phục riêng của dạng (ví dụ ngoại hình mặc định của dạng) |
| Ảnh HEAD/PORTRAIT/SPLASH | Ảnh thẻ tướng trong danh sách và ảnh đầu trang | Ảnh của dạng khi đang xem dạng đó và trong bộ chọn |
| Giá shop, cách nhận trang phục | Giá mua tướng | Giá riêng nếu dạng bán riêng; có giá dạng thì dùng giá dạng, không thì giá tướng |
| Change set theo patch | Thay đổi phần chung (ảnh, trang phục) | Thay đổi gameplay — mỗi dạng một change set |
| Video | Video của tướng | Video của dạng/kỹ năng của dạng |

- Backend từ chối lưu hoặc xuất bản vai trò, vị trí, đánh giá, chỉ số, kỹ năng cho tướng chứa dạng
  (`HERO_FORM_PARENT_GAMEPLAY`). Các quy tắc xuất bản khác giữ nguyên (đủ ba ảnh, đủ bản dịch kỹ năng).
- Mỗi dạng có nháp, xuất bản, change set, ảnh gốc, kiểm tra sẵn sàng riêng như một tướng. Dạng chưa xuất bản
  không xuất hiện trên Wiki: hiện tại Flowborn chỉ hiện dạng xạ thủ cho đến khi dạng pháp sư được xuất bản.
- Nhãn và biểu tượng nút đổi dạng lấy từ vai trò đầu tiên của dạng (Xạ thủ, Pháp sư, Đỡ đòn), giống biểu tượng
  lớp tướng trong game; nếu hai dạng cùng vai trò đầu thì dùng tên dạng. Không thêm bảng nhãn hay ảnh biểu tượng
  riêng.

### Mã, đường dẫn, alias

- Tướng mới `flowborn` có UUID mới. Không cần `hero_code_alias`: `flowborn-ad`, `flowborn-mid` vẫn là mã thật.
- Wiki:
  - `/hero/flowborn` hiển thị dạng mặc định, canonical, có trong sitemap.
  - `/hero/flowborn/<form_key>` hiển thị dạng đó, trang tĩnh riêng; `/hero/flowborn/mid` là canonical, có trong
    sitemap. `/hero/flowborn/ad` (dạng mặc định) có canonical là `/hero/flowborn`.
  - `/hero/flowborn-ad`, `/hero/flowborn-mid` và `/hero/<uuid dạng>` là trang alias không vào sitemap, canonical
    trỏ về đường dẫn mới, client chuyển hướng `replace`.
  - Đổi dạng không cuộn lên đầu trang; `?skill=` giữ nguyên khi đổi dạng nếu dạng kia có cùng khóa kỹ năng.
- Admin: vẫn `/hero/<uuid>`. Nút đổi dạng cạnh tên chỉ liệt kê các dạng (“Xạ thủ · Pháp sư”), giống game và Wiki;
  chọn dạng là mở trang của tướng nội bộ đó, nên các trình sửa section hiện có dùng nguyên vẹn. Mở tướng chứa dạng từ
  danh sách tướng, ô tìm tướng hoặc `/hero/<uuid>` không kèm `revision` là vào dạng mặc định; tab trang của tướng
  chứa dạng được thay bằng tab của dạng.
- Phần chung (tên, danh hiệu, ảnh thẻ của tướng chứa dạng) hiện cạnh nút đổi dạng trên trang mỗi dạng và sửa trong
  một hộp thoại: lưu là tạo bản nháp của tướng chứa dạng nếu chưa có, lưu phần đã đổi rồi xuất bản ngay; người không
  có quyền xuất bản chỉ lưu bản nháp. Nếu tướng chứa dạng đang có bản nháp, hộp thoại sửa trên bản nháp đó và báo
  rằng các thay đổi khác trong đó cũng được xuất bản. Trang riêng của tướng chứa dạng (trang phục chung, giá, video,
  lịch sử) mở từ hộp thoại này, từ nút mở bản nháp trong danh sách tướng hoặc từ trang sẵn sàng xuất bản; trên trang
  đó nút đổi dạng đánh dấu “Phần chung”.
- Danh hiệu của dạng không hiển thị ở đâu, nên Admin ẩn ô danh hiệu khi sửa thông tin của dạng; danh hiệu chỉ sửa ở
  phần chung.
- External identity được ghi cho dạng: Garena `flowborn` → `flowborn-ad`, `flowborn-2` → `flowborn-mid`;
  Liquipedia `Flowborn/Marksman`, `Flowborn/Mage`.

### API

- `GET /heroes` (danh sách công khai) mặc định trả **tướng**: tướng thường và tướng chứa dạng; không trả dạng thành
  mục riêng. Mục của tướng chứa dạng có `roles`/`positions` là hợp của các dạng đã xuất bản và
  `forms: [{id, code, formKey, name, roles, positions, head, portrait}]`. Lọc vai trò và tìm `q` khớp tướng nếu
  khớp tướng hoặc một dạng. Tướng chứa dạng chỉ xuất hiện khi chính nó và ít nhất một dạng đã xuất bản.
- `GET /heroes?playable=true` trả **thực thể chơi được**: tướng thường và từng dạng (không có tướng chứa dạng), mỗi
  dạng có `parent: {id, code, formKey}`. `community-service` (`WikiCatalog`) chuyển sang tham số này: bộ chọn
  tướng của giải đấu, kiểm tra “tướng có trong patch” khi công bố ván và snapshot ván đấu tiếp tục làm việc với UUID
  dạng. Nếu không đổi, 741 ván có `flowborn-ad` sẽ không công bố lại được vì UUID không còn trong danh mục.
- `GET /heroes/{heroId}` của tướng chứa dạng trả nội dung chung như hiện tại, thêm `forms` theo thứ tự; mỗi phần tử
  có đúng cấu trúc chi tiết một tướng (`id`, `code`, `formKey`, `revisionId`, `sections`, `content`, `media`,
  `skillMedia`, `skinMedia`…). Gọi bằng UUID của dạng trả chi tiết dạng kèm `parent: {id, code, formKey}` để client
  chuyển về trang tướng.
- Admin: `GET /admin/heroes/{heroId}/forms` và `PUT /admin/heroes/{heroId}/forms` (thay toàn bộ danh sách có thứ tự
  `{heroId, formKey}`, kèm `expectedForms` để phát hiện ghi đè). Danh sách admin và kiểm tra sẵn sàng thêm
  `holderId`, `formKey` (khi là dạng) và `formIds` (khi chứa dạng) để Admin nhóm dạng dưới tướng. Tạo dạng mới (ví dụ
  `flowborn-tank`) = tạo tướng bằng API hiện có rồi gắn vào danh sách dạng.
- Bộ chọn thực thể chơi được (tham chiếu `@`, giải đấu, Cờ Liên quân, so sánh chỉ số) liệt kê tướng thường và
  **dạng**, không liệt kê tướng chứa dạng; tên hiển thị là tên đầy đủ của dạng.

### Tham chiếu, tìm kiếm, giá, ảnh gốc, sẵn sàng

- Token `@` (`<ref=hero:<uuid>>`, `<ref=skill:<uuid>.<skillKey>>`) không đổi định dạng; token đã lưu trỏ UUID dạng
  vẫn phân giải. Link Wiki của kỹ năng thuộc dạng là `/hero/flowborn/<form_key>?skill=<key>`; link tới UUID dạng đi
  tới trang dạng. Câu “chiêu 2 của <ref=hero:Flowborn>” không tự khớp vì tướng chứa dạng không có kỹ năng; người
  biên tập chọn kỹ năng của dạng cụ thể. Alias tên trong `terminology.entry` (khóa theo UUID) giữ nguyên.
- Cờ Liên quân lưu `heroCode` dạng (`flowborn-ad`): link Wiki đi qua trang alias, không cần sửa nội dung.
- Video theo UUID dạng hiển thị ở trang dạng; video theo UUID tướng chứa dạng hiển thị ở mọi dạng.
- Danh mục trang phục `/skins?hero=flowborn` gồm trang phục của tướng và mọi dạng; `?hero=flowborn-ad` chỉ của dạng.
- Tìm kiếm Wiki khớp tên/mã của tướng và các dạng, kết quả là thẻ Flowborn.
- Ảnh gốc (`/__patch-captures`, `/__shop-captures`), ảnh minh họa kỹ năng theo tên file và thư viện ảnh kỹ năng
  vẫn theo mã/UUID dạng nên không đổi. Ảnh màn hình chọn dạng như trong game thuộc tướng chứa dạng.
- Kiểm tra sẵn sàng liệt kê tướng chứa dạng và các dạng; Admin nhóm dạng dưới tướng. Quy tắc cho tướng chứa dạng:
  có tên, danh hiệu, ba ảnh; không yêu cầu gameplay.
- Change set theo patch: mỗi dạng một change set (khóa hiện có `(variant, hero)` giữ nguyên). Trang patch hiển thị
  tên đầy đủ của dạng và link tới trang dạng.
- Giải đấu: lượt chọn/cấm tiếp tục lưu UUID dạng. 27 lượt “Flowborn Mage” chưa liên kết có thể nối với
  `flowborn-mid` bằng công cụ liên kết hiện có; “Flowborn Tank” chờ có dạng đỡ đòn. Migration không sửa
  community DB.

### Migration dữ liệu

1. Schema: bảng `hero.hero_form` và trigger.
2. Dữ liệu (một migration riêng, UUID cố định):
   - tạo tướng `flowborn` với revision baseline **đã xuất bản** cùng ruleset/patch hiệu lực với revision baseline
     của `flowborn-ad`: tên “Flowborn”, danh hiệu “Hậu duệ Khởi Nguyên” (vi-VN); không vai trò, vị trí, đánh giá,
     chỉ số, kỹ năng, trang phục; ảnh HEAD/PORTRAIT/SPLASH là ảnh hiện tại của `flowborn-ad`. Xuất bản ngay để
     Flowborn không biến khỏi Wiki trong lúc chờ biên tập;
   - gắn `flowborn-ad` (`ad`, thứ tự 1) và `flowborn-mid` (`mid`, thứ tự 2);
   - ghi external identity Garena/Liquipedia ở trên;
   - tăng `platform.catalog_cache_epoch` để cache danh mục (Redis, ADR-012) không trả danh sách cũ.
3. Không sửa revision đã xuất bản, nháp đang mở (nháp 5 của `flowborn-ad`, nháp 2 của `flowborn-mid`), change set,
   ảnh, alias hay dữ liệu community. Đổi tên dạng thành “Flowborn Xạ thủ”/“Flowborn Pháp sư” làm trong nháp kế
   tiếp qua Admin.
4. Kiểm tra migration trên bản sao DB trước khi chạy trên DB dev dùng chung.

## Đánh đổi

- Xuất bản không nguyên tử giữa các dạng: ngày patch phải xuất bản từng dạng. Admin hiển thị số nháp đang mở của cả
  tướng ở nút đổi dạng. Có thể thêm “xuất bản cùng nhau” sau nếu cần.
- Nội tại và chiêu 1 giống nhau được lưu riêng ở mỗi dạng. Chấp nhận vì số liệu có thể khác theo dạng và tham chiếu
  `@` cần trỏ đúng dạng.
- Tướng chứa dạng có section gameplay rỗng; mọi nơi liệt kê phải phân biệt “tướng” và “thực thể chơi được”. Quy tắc
  này nằm trong module `hero` và được kiểm thử.
- Hai cấp cố định: không hỗ trợ dạng lồng nhau.
- Một tướng thường có thêm dạng sau này (ví dụ game thêm dạng cho tướng cũ) làm như Flowborn: tạo tướng chứa
  dạng, chuyển mã công khai sang tướng mới, giữ tướng cũ làm dạng đầu tiên với alias — cần migration riêng.

## Cập nhật đặc tả

- 01 §7.1: tướng, dạng và bảng nội dung chung/riêng ở trên.
- 02 §4: bảng `hero.hero_form`, ràng buộc và trigger.
- 03: `forms` trong danh sách/chi tiết công khai, `playable=true`, `parent` của dạng, API quản lý dạng, lỗi mới.
- `community-service`: `WikiCatalog` đọc danh mục bằng `playable=true`.

## Quyết định của người dùng (10/11/2026)

1. Chọn phương án B.
2. Khóa dạng giữ `ad`/`mid` theo mã hiện có; không đổi tên file, khóa trang phục hay ảnh gốc. Dạng sau này theo cùng
   quy ước, ví dụ `flowborn-tank`.
3. Migration xuất bản ngay revision baseline của tướng `flowborn`, để Wiki không mất Flowborn.
4. Thứ tự dạng: xạ thủ (`ad`) là dạng mặc định, pháp sư (`mid`) thứ hai.
5. Admin không có mục “Chung” trong nút đổi dạng: phần chung sửa và xuất bản từ trang mỗi dạng; dữ liệu, API và Wiki
   giữ nguyên.

Triển khai: V060 (bảng và trigger), V061 (dữ liệu Flowborn).

## Kiểm chứng

- Testcontainers PostgreSQL: migration tạo đúng tướng, revision đã xuất bản và thứ tự dạng; trigger chặn lồng cấp,
  mã sai quy ước, một tướng thuộc hai tướng; lưu/xuất bản gameplay cho tướng chứa dạng bị từ chối; danh sách công
  khai nhóm dạng, lọc vai trò và tìm kiếm theo dạng; dạng chưa xuất bản bị ẩn; chi tiết theo UUID dạng có `parent`;
  token `@` cũ vẫn phân giải; đổi danh sách dạng cần `hero:publish`, ghi audit, phát hiện ghi đè.
- Frontend: nút đổi dạng ở Admin và Wiki, đường dẫn `/hero/flowborn/mid`, trang alias `/hero/flowborn-ad`,
  prerender và sitemap, nhóm dạng trong danh sách và trang sẵn sàng xuất bản.
