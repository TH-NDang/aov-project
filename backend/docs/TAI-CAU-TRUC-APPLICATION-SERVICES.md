# Tái cấu trúc application services

## Mục tiêu và phạm vi

Đợt chỉnh sửa này tách các trách nhiệm đang trộn trong `ItemCatalog`, `ArcanaCatalog`,
`EnchantmentCatalog`, `SpellCatalog`, `HeroImports` và một phần `PatchAuthoring`, để đọc luồng
nghiệp vụ trước rồi mới đi vào chi tiết dữ liệu. Mục tiêu là giữ hành vi hiện có, không thiết kế lại API.
Tài liệu mô tả cấu trúc triển khai; không thay thế đặc tả [01](01-BAN-DAC-TA-DU-AN.md),
[02](02-DATABASE-DU-AN.md), [03](03-API-DU-AN.md) hoặc các ADR.

Đây **không phải viết lại toàn bộ backend**. Không đổi controller, request/response, schema/Flyway,
public contract giữa các module hay cấu hình hạ tầng. Các luồng Hero authoring, durable import job,
media, cache và phần Patch authoring còn lại không được tái cấu trúc trong đợt này. Việc gom truy vấn
để dễ đọc cũng chưa thay thế các thao tác `findAll`/lọc trong bộ nhớ bằng truy vấn phân trang ở DB.

## Bản đồ trách nhiệm trước và sau

Các lớp mới nằm trong `internal` của chính module, không mở thêm API liên module.

| Khu vực | Trước | Sau |
|---|---|---|
| Bốn `*Catalog` | Trộn điều phối ghi, chọn snapshot, tìm kiếm, dựng response, lưu bản dịch và kiểm tra nội dung | Facade giữ quyền, transaction, khóa, vòng đời draft, version, audit và đánh dấu patch cần rà soát; giao phần đọc/nội dung cho ba cộng tác viên |
| `*CatalogQueries` | Nằm trong facade | Chọn snapshot theo ruleset/season/patch, tìm kiếm, phân trang, lịch sử, public reads và media usages; Spell còn có archive/removal reads |
| `*RevisionContent` | Nằm trong facade | Lưu gameplay và thay thế bản dịch; ghép lại content, revision view, admin/public view |
| `*ContentRules` | Nằm trong facade | Validation, danh sách trường còn thiếu, mức sẵn sàng xuất bản và asset references; giữ quy tắc riêng từng loại |
| `HeroImports` | Một lớp vừa lập kế hoạch, chọn lịch sử, chuẩn hóa, cảnh báo và ghi sáu section | Facade kiểm tra context/field, điều phối preview/apply và kiểm tra preview còn hiệu lực; tách bốn phần bên dưới |
| `HeroImportRevisions` | Nằm trong `HeroImports` | Chọn snapshot đúng chế độ nhập và mở/tái sử dụng draft |
| `HeroImportContent` | Nằm trong `HeroImports` | Áp dụng chính sách field, chuẩn hóa kiểu, alias skin, giữ ảnh/bản dịch/nguồn, gọi validation |
| `HeroImportWarnings` | Nằm trong `HeroImports` | Tách cảnh báo thiếu nội dung xuất bản khỏi cảnh báo ý nghĩa lịch sử của lần nhập |
| `HeroImportDraftWriter` | Nằm trong `HeroImports.apply` | Ghi các section thay đổi, truyền version mới nhất và đọc lại draft trước khi ghi media |
| `PatchAuthoring` | Chứa cả SQL timeline, quy tắc release và chọn vị trí patch trong mùa | Giữ entry point bảo vệ quyền/transaction và các thao tác authoring khác; ủy quyền release và season placement |
| `PatchReleaseWorkflow` / `PatchReleaseStore` | Cùng nằm trong `PatchAuthoring` | Workflow diễn đạt quy tắc schedule/confirm; store đóng gói SQL, khóa và snapshot có kiểu |
| `SeasonPatchPlacement` | Nằm trong `PatchAuthoring.seasonPatch` | Giữ khóa ruleset rồi chọn ordinal/điểm chèn; đọc danh sách có kiểu qua `PatchStore.orderedSeasonVariants` |

### Vì sao chia ở các ranh giới này?

- **Theo việc cần thay đổi**, không chỉ theo độ dài file: sửa tìm kiếm ở Queries, sửa định dạng lưu/bản
  dịch ở RevisionContent, sửa điều kiện nội dung ở ContentRules. Luồng chuyển trạng thái vẫn nhìn thấy
  trực tiếp trong facade.
- Không tạo một superclass catalog dùng chung: công thức trang bị, nhánh phù hiệu, màu/cấp ngọc và
  phép bổ trợ lưu trữ có quy tắc khác nhau. Các thuật toán chung đã có như `CatalogSnapshots` và
  `CatalogPatchScope` vẫn được dùng, nhưng quyết định của từng domain không bị giấu sau generic hooks.
- ContentRules là cộng tác viên tầng application, **không phải domain thuần**: vẫn có thể đọc metadata
  hoặc `MediaAssets` để xác thực. RevisionContent không sở hữu quyền hay tự mở transaction.
- Cộng tác viên Catalog/Patch là Spring component nội bộ; bốn cộng tác viên Hero import là lớp
  package-private được `HeroImports` tạo. Chúng không phải entry point mới và không cần proxy riêng
  để kế thừa transaction đang chạy ở facade.

## Đọc code theo luồng nghiệp vụ

### 1. Tìm catalog trong một mùa hoặc patch

Bắt đầu ở [`ItemCatalog.list`](../wiki-service/src/main/java/com/wikiaov/item/internal/application/service/ItemCatalog.java)
(cấu trúc tương tự cho Arcana, Enchantment, Spell), rồi theo
[`ItemCatalogQueries`](../wiki-service/src/main/java/com/wikiaov/item/internal/application/service/ItemCatalogQueries.java):

1. Kiểm tra page/size và ruleset trước khi tải dữ liệu.
2. Lấy snapshot chưa bị discard, giới hạn scope bằng `CatalogPatchScope`.
3. Với `includeUnchanged=false`, chọn thay đổi tại patch, kể cả revision đích từ change facts.
   Với `true`, dùng phép carry-forward hiện có, có xét mốc thêm/xóa; không lấy snapshot tương lai
   để suy ngược trạng thái quá khứ.
4. Chọn snapshot mới nhất theo owner, đọc bản dịch theo lô, tìm code/tên trên các bản dịch của
   snapshot được chọn, giữ thứ tự identity theo code rồi cắt trang.
5. `RevisionContent` dựng response; `ContentRules` giải thích trường còn thiếu để xuất bản.

Public reads là nhánh khác: resolve context theo region/thời gian, chỉ chọn bản đã xuất bản áp dụng
ở ordinal đó, xét lifecycle removal và áp dụng locale qua `publicCopy`. Không dùng kết quả admin list
làm kết quả public. Spell tiếp tục phân biệt catalog hiện hành với archive legacy/removal evidence.

### 2. Sửa và xuất bản draft catalog

Đọc `update` rồi `publish` ở facade:

1. Khóa owner; riêng cập nhật Item khóa đồ thị công thức **trước** owner.
2. Xác nhận revision thuộc owner, là draft và khớp expected version trước khi kiểm tra nội dung.
3. Gọi ContentRules; kiểm tra giới hạn cause/context và quy tắc riêng như vòng lặp công thức Item.
   `TRANSLATION_UPDATE` không được đổi mechanics; chỉ baseline độc lập được đổi mốc quan sát.
4. Nếu nội dung và context không đổi, trả lại view mà không tăng version hay ghi audit cập nhật.
5. RevisionContent lưu gameplay, xóa/flush bản dịch cũ rồi lưu/flush bản dịch mới; facade tăng
   version và ghi audit trong cùng transaction.
6. Publish kiểm tra context và trường bắt buộc trước khi đổi trạng thái, tăng publication sequence,
   ghi thời điểm/actor và đánh dấu data review cho `DATA_BASELINE`/`GAME_PATCH` như trước.

Điểm đặc thù không bị ép vào helper chung: kiểm tra đồ thị công thức ở `ItemCatalog`; ghi bằng chứng
xóa phép bổ trợ, chống trùng và audit vẫn ở `SpellCatalog.recordRemoval`.

### 3. Preview rồi áp dụng một hàng import Hero

Đọc [`HeroImports`](../wiki-service/src/main/java/com/wikiaov/hero/internal/application/service/HeroImports.java)
trước, sau đó mở cộng tác viên theo bước cần hiểu:

1. Kiểm tra ruleset/context và field được hỗ trợ. `HeroImportRevisions` ưu tiên draft khớp
   context/cause; correction cần snapshot tại đúng patch, patch update cần snapshot trước patch.
   Không có baseline thì trả kế hoạch không thể áp dụng, không lấy dữ liệu tương lai bù vào.
2. `HeroImportContent` tạo `before`, áp dụng `SKIP`/`FILL_EMPTY`/`OVERWRITE`, chuẩn hóa JSON và thứ
   tự combat stats trước khi so sánh. Giá trị nhập rỗng không xóa dữ liệu hiện có. Alias skin được
   chuẩn hóa trước khi giữ artwork. Profile giữ bản dịch của locale khác; profile, skills, skins và
   media bindings giữ sources hiện có khi cập nhật.
3. Facade phân loại kế hoạch; `HeroImportWarnings` giữ cảnh báo thiếu nội dung và lưu ý rằng
   baseline không có nghĩa “mới ra mắt”, khác biệt snapshot không tự chứng minh changelog.
4. Khi apply, khóa Hero hiện có rồi **preview lại**. Kiểm tra `canApply`, revision ID và version
   trước khi xử lý no-op: một preview đã cũ vẫn bị từ chối dù nội dung gửi lên không đổi.
5. `HeroImportDraftWriter` mở/tái sử dụng draft; lần lượt xử lý profile, statistics, skills, skins,
   media. Section không đổi không bị ghi; mỗi lần ghi dùng version từ lần trước. Media đọc lại
   draft trước khi cập nhật. Cuối cùng facade preview lại để trả trạng thái sau ghi.

Import chỉ chuẩn bị/cập nhật draft, không tự publish hay tự ghi changelog. Quyền `hero:write`,
transaction apply và đường xử lý ngoại lệ hiện có vẫn ở facade; không mở rộng việc bọc ngoại lệ
chuyển đổi JSON thành `ApiException` trong đợt tách lớp này.

### 4. Lập lịch release, xác nhận ngày áp dụng và chèn patch trong mùa

Bắt đầu ở [`PatchAuthoring`](../wiki-service/src/main/java/com/wikiaov/patch/internal/application/service/PatchAuthoring.java),
rồi đọc [`PatchReleaseWorkflow`](../wiki-service/src/main/java/com/wikiaov/patch/internal/application/service/PatchReleaseWorkflow.java):

- Schedule khóa region rồi ruleset/variant; xác định season, yêu cầu đúng một trong timestamp/ngày,
  kiểm tra mùa và URL, variant đã publish, rồi mới kiểm tra assignment/timeline nếu có timestamp.
  Ngày chưa có giờ tạo release `DRAFT`; timestamp tạo `SCHEDULED`.
- Confirm đọc mục tiêu, khóa region rồi ruleset, **đọc lại variant sau khi có khóa ruleset**, sau đó
  khóa release. Việc đọc lại tránh dùng ordinal cũ nếu một lần chèn patch vừa đánh lại thứ tự.
  Release đã xác nhận không bị ghi/audit lần nữa, nhưng kiểm tra region vẫn diễn ra trước no-op.
- Ngày đủ điều kiện xác nhận được tính theo timezone của region. Khi xác nhận thành công,
  `effectiveAt` và `confirmedAt` nhận thời điểm thực tế; workflow kiểm tra publication, season,
  assignment và timeline trước khi đổi trạng thái.
- [`PatchReleaseStore`](../wiki-service/src/main/java/com/wikiaov/patch/internal/persistence/PatchReleaseStore.java)
  giữ SQL và mapping riêng: assignment vẫn bao gồm đầu khoảng/loại trừ cuối khoảng; timeline vẫn
  từ chối xung đột cả hai chiều, kể cả bằng thời điểm/ordinal. Lỗi insert do ràng buộc dữ liệu vẫn
  được đổi thành `PATCH_CONFLICT`.
- [`SeasonPatchPlacement.choosePlacement`](../wiki-service/src/main/java/com/wikiaov/patch/internal/application/service/SeasonPatchPlacement.java)
  giữ khóa ruleset trước khi đọc thứ tự. Anchor chỉ hợp lệ trong cùng ruleset và season; nếu không
  chỉ định thì chèn trước patch đầu tiên của mùa sau. Append ordinal vẫn dùng `Math.addExact` để
  không bỏ qua overflow; `PatchAuthoring` tiếp tục tạo patch/variant và gán season.

## Các bất biến cần giữ khi sửa tiếp

- Không chuyển `@PreAuthorize` hoặc `@Transactional` từ facade sang helper và không gọi helper trực
  tiếp từ controller. Admin read/write/publish giữ capability cũ; public read không thành admin read.
  Catalog/Patch giữ transaction ở class; các read method đã khai báo read-only giữ nguyên khai báo đó.
- Giữ thứ tự validation và loại lỗi, không chỉ nội dung cuối cùng. Ví dụ: version conflict có trước
  content validation; import thiếu baseline có trước stale preview; lỗi mùa release có trước lỗi URL.
- Giữ thứ tự khóa Item **recipe graph → identity**, Patch release **region → ruleset**, và đọc lại
  variant sau khóa ruleset khi confirm. Không đưa transaction riêng vào các helper làm mất tính
  nguyên tử giữa cập nhật trạng thái, audit và data review.
- Giữ ownership check, một draft/ruleset, optimistic version, no-op, snapshot đã publish bất biến,
  locale fallback và cách chọn publication sequence. Không coi việc tách lớp là cho phép đổi nghiệp vụ.
- Không phát sinh gọi HTTP/object storage hoặc truyền bytes ảnh trong transaction. Media tiếp tục
  đi qua public contract `MediaAssets`; không tham chiếu entity/repository nội bộ module khác.

## Kiểm chứng và bàn giao

**Kiểm chứng local ngày 21/10/2026, JDK 21:** `clean verify` kết thúc **BUILD SUCCESS**, bao gồm
đóng gói JAR và Spotless check. Tổng cộng **369 test: 268 chạy thành công, 0 failure/error,
101 bị bỏ qua do không có Docker**. Mã nguồn/test tương ứng [commit `6b8b8f2`](https://github.com/TH-NDang/aov-project/commit/6b8b8f2dcb541e13b2ce633d12acfc03430faf00); cây mã nguồn trên remote đã được đối chiếu trùng với bản kiểm chứng local.
Kết quả local chưa kiểm chứng các integration test phụ thuộc Docker; CI có Docker vẫn là cửa
kiểm chứng tích hợp cần vượt qua cho commit được đưa lên remote.

Từ `backend/wiki-service`, dùng JDK 21:

```bash
# Kiểm tra định dạng; nếu cần sửa, chạy sh mvnw spotless:apply rồi kiểm tra lại.
sh mvnw spotless:check

# Hồi quy tập trung cho các ranh giới vừa tách, không cần Docker.
sh mvnw '-Dtest=*CatalogQueriesTest,*ContentRulesTest,ItemCatalogWorkflowTest,CatalogFacadeBoundaryTest,HeroImportsTest,HeroImportDraftWriterTest,PatchReleaseWorkflowTests,SeasonPatchPlacementTests,PatchReleaseStoreTests' test

# Kiểm chứng toàn bộ, bao gồm build, format và integration tests.
# Cần Docker để các bộ Testcontainers thực sự chạy.
sh mvnw --batch-mode --no-transfer-progress clean verify
```

Trên Windows dùng `./mvnw.cmd` với cùng tham số. Xem kết quả tại `target/surefire-reports/`, không
coi integration test bị skip vì thiếu Docker là đã được kiểm chứng.

Các test mới tập trung vào:

- Catalog: phân trang, thứ tự kiểm tra lỗi, tìm tên qua bản dịch, thứ tự kết quả, content readiness,
  annotation quyền/transaction trên facade và khóa công thức trước identity.
- Hero import: chính sách field, chuẩn hóa/no-op, alias và giữ ảnh, cảnh báo, stale preview, lựa chọn
  snapshot/draft, giữ sources/bản dịch và truyền version qua các section.
- Patch: thứ tự khóa/validation, placement trong mùa, lịch theo timezone, idempotency, đọc lại ordinal,
  biên assignment/timeline và ánh xạ lỗi insert.

Đây là hồi quy đơn vị có mock và kiểm tra annotation, không thay thế kiểm chứng transaction/khóa
trên PostgreSQL hoặc kiểm tra Spring wiring. Workflow
[`backend`](https://github.com/TH-NDang/aov-project/actions/workflows/backend.yml) chạy `verify`
(theo [cấu hình trong repo](../../.github/workflows/backend.yml)) trên runner có Docker khi thay đổi
`backend/wiki-service`; cần đối chiếu kết quả CI với đúng commit trước khi kết luận đã hoàn tất.
