# Tổ chức application services theo chức năng

## Mục tiêu và cách sử dụng

Backend giữ một ứng dụng Spring Boot và các module sở hữu dữ liệu riêng. Bên trong mỗi module,
các nhóm nhỏ phản ánh chức năng cần đọc hoặc sửa: biên tập, danh mục, import, ảnh, lịch phát hành,
tham chiếu. Tên thư mục không phải lý do để tạo thêm lớp; mỗi cộng tác viên phải có trách nhiệm cụ thể.

Tài liệu này mô tả cách đi qua mã nguồn hiện tại, không thay thế đặc tả
[01](01-BAN-DAC-TA-DU-AN.md), [02](02-DATABASE-DU-AN.md), [03](03-API-DU-AN.md) hoặc
[ADR-013](adr/ADR-013-backend-organization.md). Hướng dẫn chạy và cấu hình nằm tại
[README của service](../wiki-service/README.md).

## Các ranh giới được giữ

| Nơi sở hữu | Trách nhiệm |
|---|---|
| Public contract ở gốc module | Giao tiếp giữa các module, không lộ entity hoặc repository nội bộ |
| `internal/web` | HTTP contract `*Api`, binding và controller gọi application facade |
| `internal/<chức năng>/application` | Điều phối use case, quyền, transaction và cộng tác viên theo chức năng |
| `internal/<chức năng>/domain` | Quy tắc thuần, không phụ thuộc Spring, JPA, JDBC, HTTP hoặc SDK lưu trữ |
| `internal/<chức năng>/persistence/entity` và repository kế bên | Entity, projection và truy vấn có chức năng sở hữu |
| `internal/<chức năng>/infrastructure` | Adapter hệ thống ngoài, tích hợp qua port hoặc public contract phù hợp |
| `internal/application`, `internal/domain` cấp module | HTTP commands/DTOs, lỗi và content record serialize giữ tên tương thích có chủ đích |

Application có thể dùng repository và entity của chính module. Không bắt buộc tạo một interface cho
mỗi lớp, một tầng CRUD chung hoặc một bộ `Interface`/`Impl` chỉ chuyển tiếp lời gọi. Các phép CRUD,
truy vấn có kiểu và khóa bản ghi thông thường dùng Spring Data JPA. SQL đặc thù hoặc Criteria phức
tạp được cô lập theo nhiệm vụ; không mở lại API tổng quát kiểu `rows(sql)`, `write(sql)` cho application.

Module lớn dùng chức năng trước tầng; module nhỏ còn gắn kết có thể giữ cấu trúc tầng hiện tại.
Không tạo đủ mọi tầng cho mọi chức năng. Các HTTP DTO giữ FQN vì tên schema dùng `springdoc.use-fqn`;
content record đã serialize và contract `*Api` cũng không bị chuyển chỉ để cây thư mục đều nhau.

## Bốn danh mục kho trang bị

Item, Arcana, Enchantment và Spell có cách bố trí tương tự, nhưng giữ nghiệp vụ riêng:

```text
internal/
├── catalog/
│   ├── application/     facade catalog, truy vấn, validation và nội dung revision
│   └── persistence/     identity, revision, bản dịch, projection và Specifications
├── change/              application/persistence cho thay đổi theo patch
├── reference/           tìm tham chiếu và adapter public-reference
└── metadata/            nhóm trang bị hoặc hệ phù hiệu khi cần
```

| Lớp | Việc cần tìm ở đây |
|---|---|
| `*Catalog` | Tạo, fork, cập nhật, xuất bản, bỏ draft; quyền, transaction, khóa, version, audit và data review |
| `*CatalogQueries` | Chọn snapshot, lọc ruleset/mùa/patch, tìm kiếm, lịch sử, public reads và media usages |
| `*ContentRules` | Kiểm tra nội dung, asset hợp lệ, trường còn thiếu và điều kiện xuất bản |
| `*RevisionContent` | Ghi gameplay/bản dịch và dựng view từ revision |
| `*PatchChanges` | Ghi và đọc thay đổi của một đối tượng tại patch, tách khỏi bản thân snapshot |
| `ItemCategoryCatalog`, `EnchantmentBranchCatalog` | Nhóm trang bị và hệ phù hiệu, bao gồm metadata và thứ tự |

Điểm bắt đầu để đọc là [`ItemCatalog`](../wiki-service/src/main/java/com/wikiaov/item/internal/catalog/application/ItemCatalog.java),
rồi mở cộng tác viên trong cùng thư mục. Không có một superclass dùng hooks để ép cả bốn catalog
vào chung quy trình. Đồ thị công thức Item, nhánh Enchantment, màu/cấp Arcana và archive/removal
của Spell tiếp tục do module tương ứng kiểm soát.

`*ContentRules` là lớp application vì có thể đọc metadata hoặc gọi `MediaAssets`. Chính sách
[`CatalogTranslations`](../wiki-service/src/main/java/com/wikiaov/platform/CatalogTranslations.java)
chỉ gom validation bản dịch thực sự giống nhau; module vẫn chọn error code và giữ thứ tự kiểm tra.

### Tìm và sửa một catalog

1. Facade đọc giao cho Queries kiểm tra page/size, ruleset và scope mùa/patch. `CatalogPatchScope`
   xác định phạm vi; `CatalogSnapshots` chọn snapshot phù hợp. `includeUnchanged` điều khiển việc
   mang trạng thái đã xuất bản từ patch trước sang, không suy ngược quá khứ bằng snapshot tương lai.
2. Queries đọc bản dịch, tìm code/tên, giữ thứ tự danh mục và dựng view qua RevisionContent.
   Việc tách lớp không có nghĩa mọi đường đọc đã chuyển thành phân trang tại database.
3. Khi cập nhật, khóa identity trước khi đọc draft; riêng Item khóa đồ thị công thức trước identity.
   Kiểm tra draft và expected version có trước validation nội dung.
4. Translation revision không được đổi mechanics. Baseline độc lập mới được đổi mốc quan sát.
   Nếu content và context không đổi thì không tăng version hoặc ghi audit cập nhật.
5. Publish kiểm tra context, trường bắt buộc và nội dung trước khi chuyển trạng thái. Publication
   sequence, audit và việc đánh dấu patch cần rà soát thuộc cùng transaction.

Public reads dùng gameplay context theo thị trường/thời gian, chỉ chọn bản đã xuất bản và áp dụng
locale fallback. Kết quả admin không được dùng thay cho kết quả public. Spell vẫn hỗ trợ dữ liệu cũ
chưa biết patch và bổ sung bằng chứng loại bỏ sau; không tự suy ra patch lịch sử.

## Hero: biên tập, import và snapshot theo từng phần

Các chức năng Hero được tìm từ [thư mục nội bộ Hero](../wiki-service/src/main/java/com/wikiaov/hero/internal/).
Những lớp `HeroAuthoring`, `HeroCatalog`, `HeroComparisons`, `HeroImports`, `HeroImportJobs`,
`HeroMediaQueries`, `HeroSkillImages`, `SkinBadges` và `HeroPatchChanges` diễn đạt các use case riêng;
không gộp thêm chúng vào một service giữ toàn bộ repository Hero.

| Nhóm | Nơi sửa theo chức năng |
|---|---|
| `authoring`, `catalog`, `comparison` | Biên tập/vòng đời Hero, tra cứu danh mục và so sánh revision |
| `importing` | Preview/apply, job bền vững, phiên upload và worker import |
| `skills`, `skins`, `media` | Kỹ năng/ảnh kỹ năng, snapshot trang phục và ảnh/binding |
| `badges`, `reference`, `change`, `alias` | Nhãn trang phục, tìm tham chiếu, lịch sử thay đổi và mã bí danh |
| `profile`, `ratings`, `stats`, `sections` | Các phần snapshot và lifecycle/source có phạm vi dùng chung |

### Sáu loại snapshot

[`HeroSections`](../wiki-service/src/main/java/com/wikiaov/hero/internal/sections/persistence/HeroSections.java)
điều phối theo `HeroSection` qua contract nội bộ `HeroSectionSnapshots`. Mỗi loại có repository và
cách đọc/ghi của mình tại `hero/internal/<phần>/persistence`:

| Nhóm | Capability | Nội dung |
|---|---|---|
| `profile` | `HeroProfileSnapshots` | Tên, mô tả, vai trò và bản dịch hồ sơ |
| `ratings` | `HeroRatingSnapshots` | Đánh giá tổng quan và thang đánh giá |
| `stats` | `HeroStatSnapshots` | Thông số chiến đấu |
| `skills` | `HeroSkillSnapshots` | Kỹ năng, trạng thái, hiệu ứng và bản dịch |
| `skins` | `HeroSkinSnapshots` | Trang phục, bản dịch và quan hệ ảnh/nhãn |
| `media` | `HeroMediaSnapshots` | Các binding ảnh của snapshot |

`HeroSectionLifecycle` dùng chung thao tác tạo/publish phần snapshot, kiểm tra quyền sở hữu và vòng
đời. `HeroSectionSources` quản lý nguồn tham khảo có thứ tự. Chúng làm việc qua Spring Data
repository; không dùng một chuỗi SQL hoặc switch CRUD tổng quát để ghi mọi loại section.

`authoring/persistence/HeroStore` phục vụ identity/revision qua repository JPA. Các nhóm `catalog`,
`reference`, `change` và `alias` sở hữu persistence cho truy vấn đọc, tìm tham chiếu, lịch sử thay đổi
và mã bí danh. Một adapter Criteria có nhiều điều kiện tìm kiếm không phải lý do để chuyển CRUD
thông thường trở lại `EntityManager`.

### Lịch sử thay đổi tướng

`change/persistence/HeroPatchHistory` giữ việc ghi append-only và đọc lịch sử theo lô. Sáu loại
chi tiết thay đổi dùng sáu entity/repository cụ thể; lớp cha chỉ chia sẻ mapping trường chung qua
`@MappedSuperclass`. Không gộp toàn bộ entity bằng `TABLE_PER_CLASS`: cột `old_value`/`new_value`
của chỉ số là số, còn của kỹ năng là text, nên UNION toàn bộ hàng không có cùng kiểu dữ liệu.

Khi có change set, đọc chi tiết dùng tối đa chín truy vấn: header, assessment, bản dịch và sáu bảng
chi tiết. Số truy vấn không tăng theo số change set; mỗi bảng được đọc một lần cho toàn bộ ID.
Danh mục chỉ cần loại thay đổi vẫn dùng một UNION projection hẹp gồm UUID và mã loại, không lấy
các cột giá trị khác kiểu. Bản dịch ưu tiên locale yêu cầu, rồi `vi-VN`, rồi locale theo thứ tự chữ.
Chi tiết giữ thứ tự `sortOrder`, loại bảng và ID; assessment tổng thể tiếp tục tách khỏi từng thay đổi.

Các entity cụ thể là `@Immutable`, dùng ID được gán sẵn với ngữ nghĩa persist cho bản ghi mới;
trigger PostgreSQL vẫn bảo vệ append-only. Assessment là dữ liệu riêng có version và không biến
thao tác đánh giá tổng thể thành sửa lịch sử đã ghi.

### Preview rồi áp dụng import

1. `HeroImports` kiểm tra context/field và lập preview. `HeroImportRevisions` chọn baseline/draft
   đúng chế độ: correction ở đúng patch, gameplay update dựa trên snapshot trước patch. Không có
   dữ liệu nền thì kế hoạch không thể áp dụng; không lấy bản tương lai bù vào.
2. `HeroImportContent` áp dụng `SKIP`/`FILL_EMPTY`/`OVERWRITE`, chuẩn hóa JSON và alias, giữ ảnh,
   bản dịch của locale khác và nguồn hiện có. `HeroImportWarnings` phân biệt thiếu nội dung xuất
   bản với cảnh báo về ý nghĩa lịch sử của lần nhập.
3. Apply khóa Hero rồi preview lại. Kiểm tra revision ID/version và khả năng áp dụng có trước no-op,
   nên một preview đã cũ không được chấp nhận chỉ vì nội dung gửi lên trùng nhau.
4. `HeroImportDraftWriter` ghi các phần thay đổi với version mới nhất sau từng bước; media đọc lại
   draft trước khi cập nhật. Import chuẩn bị draft, không tự xuất bản hoặc biến mọi khác biệt thành
   changelog đã xác minh.

Các job import và phiên upload có trạng thái bền vững riêng. Tách package không thay đổi chính sách
khôi phục, checkpoint, quyền hoặc transaction của các job này.

## Patch: thứ tự chung, lịch thị trường và phát hành

[`PatchAuthoring`](../wiki-service/src/main/java/com/wikiaov/patch/internal/authoring/application/PatchAuthoring.java)
giữ quyền và transaction, không giữ repository. Facade giao việc cho các nhóm:

| Nhóm/lớp | Trách nhiệm |
|---|---|
| `ruleset/application/RulesetAdministration` | Tạo thị trường, ruleset và khoảng gán ruleset cho thị trường |
| `authoring/application/PatchDrafts` | Tạo patch/variant, gán mùa, xuất bản và audit tương ứng |
| `authoring/application/SeasonPatchPlacement` | Chọn điểm chèn patch trong thứ tự chung sau khi giữ khóa ruleset |
| `context/application/PatchAdminCatalog` | Các bảng ruleset, patch/variant/release và assignment của admin |
| `release/application/PatchReleaseWorkflow` | Quy tắc schedule/confirm release trong transaction của facade |
| `season/application/RankedSeasons` | Thứ tự mùa dùng chung và lịch mùa riêng của từng thị trường |
| `context/application/ResolveGameplayContext`, `PatchQueries` | Context biên tập, context gameplay có hiệu lực và public catalog |
| `review/application/PatchDataReviewService` | Hoàn tất/mở lại rà soát nhập liệu, độc lập trạng thái publish/release |

Các repository JPA sở hữu CRUD, query có kiểu và khóa bản ghi. `GameplayContextRepository` trả về
projection `GameplayContext`, `AuthoringContext`, `PatchReleaseReference`; application không tự
chuyển `Map<String,Object>` từ SQL thành context.

`SeasonCalendarRules` trong `season/domain` kiểm tra độ chính xác ngày/giờ, thứ tự, khoảng chồng lấn
và việc lịch mùa còn chứa các release đã ghi. Application ánh xạ vi phạm sang lỗi Patch hiện hành.
Ngày kết thúc bao gồm cả ngày theo timezone thị trường; ranh giới timestamp vẫn loại trừ cuối khoảng.

Ba chi tiết persistence cần được giữ:

- `SeasonOrderLock` là adapter nhỏ cho `LOCK TABLE`: vẫn khóa được thứ tự mùa khi bảng chưa có bản
  ghi. Đây là phần `EntityManager` còn lại có mục đích đặc thù, không phải wrapper CRUD.
- `PatchReleaseStore` phối hợp **region → ruleset → variant/release** qua repository. Sau khi chờ
  khóa ruleset phải đọc scalar projection mới; một entity đã managed có thể còn ordinal/status cũ.
  Truy vấn assignment bao gồm đầu khoảng, loại trừ cuối; timeline từ chối cả thời điểm/ordinal bằng nhau.
- Chèn ordinal dịch chuyển từ lớn xuống nhỏ và flush từng bước để không va chạm unique constraint.
  Bản dịch patch dùng entity khóa ghép với ngữ nghĩa insert-only, nên locale trùng vẫn báo conflict.

Release có ngày nhưng chưa có giờ ở trạng thái `DRAFT`. Khi confirm, kiểm tra thị trường và ngày
địa phương, publication, mùa, assignment và timeline trước khi ghi thời điểm áp dụng thực tế. Release
đã confirm là no-op sau các kiểm tra/khóa hiện có. Không dùng ngày tạo nội dung thay ngày game áp dụng.

`context/application/PublicationOverview` kết hợp ba read component: `MarketPublicationOverview`
đọc ruleset/assignment và trạng thái thị trường, `SeasonPublicationOverview` dựng lịch mùa,
`PatchPublicationOverview` dựng review/variant/release timeline. Facade giữ quyền/transaction và
thời điểm đọc; không chuyển chín repository sang một `OverviewStore` tổng quát khác.

`context/application/AdminTimestamp` giữ định dạng UTC với đúng ba chữ số millisecond cho các field map admin
vốn trả về JDBC timestamp. Public DTO dùng `Instant` không bị đổi serializer toàn cục.

## Media: quản lý asset, upload và dựng view

```text
media/internal/
├── asset/        application/persistence cho asset identity và version
├── upload/       application/persistence cho vé, phiên upload và avatar
├── ingestion/    application/domain cho kiểm tra ảnh, deduplicate và nhận object
├── query/        application cho lookup, usage, URL và response view
├── provenance/   persistence cho nguồn ảnh
├── storage/      application/port và infrastructure cho object storage
└── shared/       application cho guard ghi và metadata audit có phạm vi rõ ràng
```

`MediaSupport` đã được chia thành ba trách nhiệm: `MediaAssetAccess` tải/flush identity và chuyển
lỗi optimistic locking; `MediaAssetViews` đọc version/provenance để dựng response khi được yêu
cầu; `MediaWritePolicy` là các guard/helper tĩnh không thực hiện IO. Lookup đơn thuần không cần
kéo theo toàn bộ dựng chi tiết asset.

Đọc [`MediaIngestion`](../wiki-service/src/main/java/com/wikiaov/media/internal/ingestion/application/MediaIngestion.java)
để hiểu stat/inspect/deduplicate/copy và transaction ghi version. Object storage được gọi ngoài
transaction DB; version thành công được gắn key bất biến. Upload thông thường vẫn là presigned
upload tới `incoming/`, sau đó complete xác thực và tạo object `assets/`; bytes không đi qua controller.
Module khác dùng `MediaAssets` và báo usage qua public contract, không đọc bảng Media trực tiếp.

## Thuật ngữ, tham chiếu và hồ sơ người dùng

| Chức năng | Nơi sở hữu và cách đọc |
|---|---|
| Danh mục gợi ý và resolve tham chiếu | `terminology/internal/reference/application`: admin/public catalog, loader và tìm chiêu; public chỉ lấy nội dung phù hợp gameplay context |
| Cấu hình thuật ngữ/tham chiếu | `terminology/internal/settings/application`: `ReferenceCatalog` giữ quyền, version, khóa cấu hình, transaction và audit; `ReferenceSettingsContent` thay/đọc nội dung có thứ tự và bản dịch |
| Hồ sơ người dùng | `user/internal/profile/application/UserProfiles`: self/admin reads, quyền, kiểm tra avatar, optimistic version và audit; entity `Profile` sở hữu thay đổi nội dung |

Tham chiếu cấu hình được đọc theo snapshot `REPEATABLE_READ`. Khi lưu, validation có trước khóa/
version check; xóa và ghi lại entry/bản dịch, tăng version cấu hình và audit thuộc cùng transaction.
Không để helper dựng nội dung tự mở transaction hoặc bỏ qua kiểm tra version của facade.

Hồ sơ chưa lưu dùng `ProfileDefaults` đã được kiểm tra qua `ProfileInput`. Đăng nhập vẫn do Access/
Keycloak quản lý; hồ sơ không nhận identity hoặc quyền từ dữ liệu người dùng nhập. Avatar mới phải
là upload hoàn tất thuộc người gọi; kiểm tra avatar có trước tạo/cập nhật hồ sơ.

## Cache và cấu hình triển khai

`CatalogCacheEpochRepository` dùng scalar query đọc epoch và phép tăng nguyên tử ở DB. Cache key
vẫn dựa trên epoch có thẩm quyền ở database, kể cả khi Redis mất kết nối. `CatalogCacheEpoch` đăng
ký tối đa một lần tăng trong transaction và xử lý suspend/resume; flush thay đổi domain trước khi
khóa epoch giúp giữ thứ tự khóa. Không dùng entity cache làm nguồn đọc giá trị fence hiện tại.

Cấu hình Spring nằm trong `src/main/resources/config/`; formatter ở `config/format/`, tài nguyên
container local ở `infra/local/`, script phát triển ở `scripts/dev/`. Maven Wrapper và `compose.yaml`
giữ tại gốc service. Chi tiết đường dẫn, biến môi trường và cách chạy theo README/ADR-013; không di
chuyển Flyway đã áp dụng hoặc đổi volume chỉ để sắp xếp thư mục.

## Bất biến và kiểm chứng khi sửa tiếp

- Controller đi qua facade giữ quyền/transaction. Helper kế thừa transaction đang chạy, không tự
  tạo một transaction làm tách rời thay đổi dữ liệu, audit hoặc data review.
- Giữ thứ tự kiểm tra lỗi, khóa, ownership, expected version và no-op. Đổi tên helper không cho
  phép đảo version conflict/content validation hay bỏ lần đọc mới sau khi chờ khóa.
- Giữ snapshot đã publish bất biến, locale fallback, một draft/ruleset và chính sách chọn publication
  sequence. Snapshot khác nhau chưa tự chứng minh một thay đổi trong game.
- Không giữ transaction DB trong lúc gọi HTTP/object storage. Domain tiếp tục độc lập framework;
  module khác chỉ đi qua public contract.
- Đặt một dòng trống giữa khối field với constructor và giữa các phương thức/constructor, kể cả
  abstract method. Trong hàm, nhóm các pha
  validation, đọc/khóa, quyết định, ghi/audit và trả kết quả bằng một dòng trống. Mã AI tạo cũng phải
  được người viết rà các nhóm có ý nghĩa; formatter không tự suy ra chúng.

Từ `backend/wiki-service`, dùng JDK 21 và Docker cho các bài tích hợp:

```powershell
./mvnw.cmd spotless:apply
./mvnw.cmd clean verify
```

`wiki.build.directory` mặc định là đường dẫn `target` tuyệt đối của service. Nếu JDT/IDE cũng ghi
vào đó trong lúc test, chọn output Maven riêng thay vì dùng chung class đang bị biên dịch lại:

```powershell
$verificationDirectory = Join-Path $PWD.Path ".local-state/verification/target"
./mvnw.cmd "-Dwiki.build.directory=$verificationDirectory" clean verify
```

Thư mục cuối cần giữ tên `target` để ArchUnit 1.4.2 nhận diện đúng `target/test-classes/` khi dùng
`DoNotIncludeTests`. Báo cáo ở `.local-state/verification/target/surefire-reports/`; không cần sửa hoặc
nới lỏng kiểm tra kiến trúc để tách output Maven khỏi IDE.

Trên Unix dùng `sh mvnw`. Các kiểm tra kiến trúc gồm `ModuleArchitectureTests` và
`LayerArchitectureTests`; kiểm tra HTTP/OpenAPI tiếp tục bảo vệ đường dẫn, quyền và validation.
Các nhóm hồi quy đáng đọc gồm catalog workflow/content, Hero import và section lifecycle, Patch
workflow/repository/calendar, Media API, ReferenceSettings, UserProfile và CatalogCacheEpoch.
`AdminTimestampTests` đối chiếu định dạng map admin với serializer timestamp cũ.

Hướng dẫn này không gán kết quả của một lần chạy cũ cho cây mã nguồn hiện tại. Khi bàn giao, đối
chiếu đúng lần chạy và commit, xem số failure/error/skipped trong `<build directory>/surefire-reports/`
của lần chạy đó; mặc định là `target/surefire-reports/`. OpenAPI artifact hiện vẫn ở
`target/openapi/wiki-v1.json` và `target/openapi-mvc/` kể cả khi override build directory; CI giữ
đường dẫn mặc định. Giữ source/configuration ổn định và không chạy hai build cùng ghi một output.
Unit test có mock không thay thế kiểm tra JPA mapping, Spring wiring, transaction và khóa trên
PostgreSQL. Một integration test bị bỏ qua vì thiếu Docker chưa được kiểm chứng.
