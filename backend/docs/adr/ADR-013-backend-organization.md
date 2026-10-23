# ADR-013: Tổ chức backend và ranh giới trách nhiệm

Ngày: 2026-10-22. Trạng thái: Chấp nhận theo yêu cầu cải tổ backend và tích hợp hai nhánh clean code,
API docs.

## Bối cảnh

Backend đã có các module theo tính năng và nhiều luồng nhập liệu, xuất bản, Media, lịch patch.
Một số application service chứa đồng thời truy vấn, quy tắc nội dung và ghi revision; quy tắc bản dịch
bị lặp giữa các catalog. Cấu hình Spring, formatter và tài nguyên dependency local nằm gần các file
gốc của service, khiến người mới khó phân biệt code ứng dụng với thiết lập phát triển.

Hai nhánh bổ sung việc tách cộng tác viên application và interface mô tả HTTP. Cần một cấu trúc
thống nhất có kiểm tra tự động, đồng thời giữ nguyên nghiệp vụ, dữ liệu và các lệnh local đang dùng.
Yêu cầu cải tổ tiếp theo ưu tiên nhóm theo chức năng trước tầng, dùng Spring Data JPA cho thao tác
thông thường và loại bỏ các wrapper tổng quát chỉ chuyển SQL hoặc entity sang một lớp khác.

## Quyết định

### Giữ module theo tính năng, một ứng dụng triển khai

Giữ một Maven project và một JAR. Mỗi module đặt public contract tại package gốc; code triển khai
nằm trong `internal`. Không truy cập entity, repository hoặc lớp nội bộ của module khác.

```text
feature/
├── public contracts
└── internal/
    ├── web/                     HTTP contract, controller và binding giữ ổn định
    ├── application/             HTTP commands/response DTOs, lỗi cấp module giữ FQN
    ├── domain/                  content records đã serialize và chính sách chung có chủ đích
    ├── capability-a/
    │   ├── application/         use case, cộng tác viên và port IO phù hợp
    │   ├── domain/              quy tắc thuần riêng của chức năng
    │   ├── persistence/         repository, projection và truy vấn thuộc chức năng
    │   │   └── entity/          entity thuộc chức năng
    │   └── infrastructure/      adapter hệ thống ngoài của chức năng
    └── capability-b/            chỉ tạo các tầng thực sự cần
```

Thứ tự chính là `internal/<chức năng>/<tầng>`, không phải `internal/<tầng>/<chức năng>`. Hero có
`authoring`, `catalog`, `importing`, `skills`, `skins`, `media`, `change` và các phần snapshot; Patch có
`season`, `ruleset`, `authoring`, `release`, `context`, `review`; bốn catalog có `catalog`, `change`,
`reference` và `metadata` khi cần. Media tách `asset`, `upload`, `ingestion`, `query`, `provenance`,
`storage` và chính sách ghi dùng chung. Terminology tách `reference`/`settings`; User có `profile`.

Đây là quy ước cho module lớn, không yêu cầu mọi chức năng có đủ tầng hoặc tạo `Interface`/`Impl`
cho mỗi lớp. Module nhỏ còn gắn kết như Access có thể giữ cấu trúc tầng hiện tại. Application vẫn có
thể dùng repository/entity của chính module; các capability không trở thành module triển khai riêng.

`internal/web` và các HTTP command/response DTO đã có được giữ tại FQN ổn định có chủ đích. Đổi
package DTO có thể đổi tên schema khi `springdoc.use-fqn=true`; di chuyển content record có thể
ảnh hưởng định dạng JSON đã lưu. Các domain record dùng chung giữa những chức năng của một module
và error enum cấp module cũng có thể giữ ở vị trí cũ. Không dùng các vị trí tương thích này làm nơi
đổ mọi file chưa phân loại hoặc tạo thêm một tầng `shared` không rõ người sở hữu.

Facade application tiếp tục giữ `@PreAuthorize`, transaction và thứ tự điều phối. Controller gọi
facade, không gọi thẳng cộng tác viên để vượt quyền hoặc transaction. Các lớp query, content rules,
revision writer, import planner và release workflow chỉ được tách khi có trách nhiệm rõ ràng.
Truy vấn đặc thù bằng `EntityManager`/JDBC thuộc adapter persistence có phạm vi hẹp; AWS/HTTP
client thuộc adapter và được gọi qua cổng phù hợp. Không giữ transaction DB trong khi thực hiện
HTTP hoặc object storage.

### Persistence theo chức năng và nhu cầu thực tế

CRUD, truy vấn cố định, projection, phân trang và khóa bản ghi thông thường dùng Spring Data JPA:
repository method, `@Query`, `@Lock` hoặc Specifications. Mỗi entity/repository có một chức năng sở
hữu. Read model có thể ghép dữ liệu từ các capability cùng module, nhưng facade không giữ mọi
repository và không gom lại chúng vào một `OverviewStore` chỉ để đổi tên lớp.

Không cung cấp API tổng quát `rows(sql)`, `write(sql)`, `insert(Object)` hoặc `lock(Class,id)` cho
application. Việc chuyển nguyên API đó vào `internal/persistence` chưa tạo được ranh giới hữu ích.
`PatchAuthoring` điều phối các use case ruleset/authoring/release; `PublicationOverview` kết hợp ba
read component cho thị trường, lịch mùa và timeline patch, mỗi phần tự sở hữu dữ liệu/phép chiếu cần
thiết. Các snapshot Hero có sáu capability và repository riêng, dùng lifecycle/source chung có giới hạn.

Custom repository fragment với Criteria được giữ cho truy vấn động thực sự phức tạp, chẳng hạn tìm
tham chiếu kỹ năng theo nhiều điều kiện. Adapter native nhỏ chỉ phục vụ thao tác mà JPA thông thường
không thay thế đúng được: `SeasonOrderLock` khóa bảng để vẫn tuần tự hóa khi chưa có mùa nào.
Không mở rộng ngoại lệ này thành wrapper CRUD. Khi chờ khóa có thể làm dữ liệu đã managed bị cũ,
đọc scalar projection mới thay vì tin vào first-level cache; tăng ordinal theo thứ tự giảm và flush
từng bước tiếp tục bảo vệ unique constraint.

### Chia sẻ chính sách thuần có cùng ý nghĩa

`CatalogTranslations` tập trung quy tắc kiểm tra bản dịch thực sự dùng chung giữa các catalog:
locale, giới hạn số bản dịch, tên và độ dài nội dung. Chính sách trả về vi phạm, không ném lỗi của
một module cụ thể. Module gọi chính sách tiếp tục chọn `ApiErrorCode` của mình, giữ thứ tự kiểm tra
và error detail hiện hành.

Không gộp các workflow catalog chỉ vì trông giống nhau. Đồ thị công thức Item, bằng chứng loại bỏ
Spell và lịch phát hành Patch vẫn do module sở hữu. Lựa chọn snapshot và context chỉ dùng contract
chia sẻ đã được kiểm chứng, không suy diễn bản vá hoặc dữ liệu tương lai.

### Định dạng và cách viết hàm

Eclipse profile dùng chung qua Spotless, hook và IDE giữ bốn space, giới hạn 120 cột, không viết lại
comment. Có một dòng trống giữa khối field với constructor, giữa constructor/phương thức, kể cả
phương thức abstract ở repository interface, và giữ tối đa một dòng trống liên tiếp.

Bên trong hàm, người viết chia các pha có ý nghĩa bằng một dòng trống: validation, đọc/khóa, quyết
định, ghi/audit và kết quả. Giữ các câu lệnh cùng ý nghĩa gần nhau; không chèn dòng trống sau từng
câu lệnh. Khi chi tiết làm luồng use case khó đọc, tách một bước có tên và trách nhiệm rõ ràng. Quy
tắc này áp dụng cả mã do AI tạo; formatter không tự suy ra ranh giới nghiệp vụ.

### Cấu hình và thiết lập có nơi sở hữu rõ ràng

- Cấu hình Spring tại `src/main/resources/config/application*.yml`. Spring Boot tìm thư mục
  `classpath:/config/` theo cơ chế chuẩn; tên profile và biến môi trường giữ nguyên.
- Formatter tại `config/format/eclipse-formatter.xml`; Maven và hook cùng trỏ tới file này.
- Realm Keycloak và cấu hình SeaweedFS local tại `infra/local/keycloak/` và
  `infra/local/seaweedfs/`. `compose.yaml` vẫn ở gốc service; giữ tên dịch vụ, volume và cổng.
- Launcher Windows tại `scripts/dev/start-local.ps1`, hỗ trợ `-EnvironmentFile` và `-DryRun`.
  `.env` được đọc dưới dạng giá trị literal, không thực thi biểu thức hoặc nội suy shell. Biến đã
  export trong process có ưu tiên hơn file. `DB_*` tường minh giữ nguyên; chỉ khi chưa có mới dùng
  `POSTGRES_*` làm fallback cho kết nối local.
- Dry run chỉ hiển thị câu lệnh và tên biến cần thiết, không in giá trị hoặc secret. Môi trường
  process được khôi phục sau khi launcher kết thúc. Maven/IDE chạy trực tiếp không tự đọc `.env`.
- `wiki.build.directory` mặc định là `${project.basedir}/target`. Có thể cấp đường dẫn tuyệt đối
  khác cho lần verify để tách output Maven khỏi JDT/IDE đang biên dịch vào `target`.

Không đổi schema, reset volume hoặc chuyển secret thật vào Git để phục vụ việc tổ chức thư mục.
Các giá trị mẫu local không được tái sử dụng ở production.

### Cổng kiểm tra bảo vệ cấu trúc và hợp đồng

- Spring Modulith `ModuleArchitectureTests` kiểm tra ranh giới module và dependency cycle.
- `LayerArchitectureTests` kiểm tra domain không phụ thuộc Spring/JPA/JDBC/AWS, application hoặc
  adapter; controller không truy cập persistence/JDBC/AWS; application không dùng trực tiếp
  `EntityManager`, JDBC, AWS SDK hoặc `HttpClient`.
- Kiểm thử workflow bảo vệ thứ tự validation, quyền, lock, no-op, version, audit và xuất bản.
  Việc tách lớp không được thay đổi các bất biến này.
- Interface `*Api` sở hữu annotation mô tả HTTP và constraint tham số được kế thừa. Controller giữ
  mapping và binding. Kiểm thử MVC và tích hợp đối chiếu OpenAPI với endpoint thực, bao gồm phân
  quyền, validation và response; CI kiểm tra và lưu bản đặc tả đã sinh.
- Kiểm tra cấu hình, launcher và formatter dùng công cụ hiện có. Không giảm kiểm thử hoặc bỏ qua
  validation chỉ để đáp ứng một quy tắc hình thức.

## Hệ quả và đánh đổi

Người đọc có thể đi từ controller đến facade rồi mở đúng cộng tác viên cần hiểu. IO nằm tại ranh
giới dễ tìm; quy tắc thuần dùng lại được mà không kéo theo framework. Nhiều file hơn là chi phí của
việc tách trách nhiệm; không tiếp tục chia nhỏ nếu chỉ tạo các wrapper chuyển tiếp.

`compose.yaml` gốc và lệnh Maven cũ tiếp tục hoạt động. IDE cần tải lại project sau khi di chuyển
cấu hình; công cụ tự đọc đường dẫn cũ phải được cập nhật. Dữ liệu Docker, `.env` riêng và migrations
đã áp dụng không bị thay đổi bởi refactor.

Chính sách kiến trúc vẫn cho phép application dùng persistence của chính module để tránh thêm port
một-một không có lợi ích. Nếu sau này cần thay datastore hoặc tách deployable, đánh giá riêng ranh
giới đó bằng ADR mới và bằng chứng kiểm thử.

## Kiểm chứng

Từ `backend/wiki-service`, dùng JDK 21 đầy đủ:

```powershell
./mvnw.cmd spotless:apply
./mvnw.cmd clean verify
./scripts/dev/test-start-local.ps1
./scripts/dev/start-local.ps1 -DryRun
```

Nếu IDE cùng ghi vào `target`, từ gốc service dùng một output Maven riêng:

```powershell
$verificationDirectory = Join-Path $PWD.Path ".local-state/verification/target"
./mvnw.cmd "-Dwiki.build.directory=$verificationDirectory" clean verify
```

Thư mục cuối giữ tên `target` vì ArchUnit 1.4.2 dùng mẫu `target/test-classes/` để nhận diện và loại
test khỏi import `DoNotIncludeTests`. Báo cáo của lệnh trên ở
`.local-state/verification/target/surefire-reports/`. Không thay hoặc nới lỏng rule kiến trúc để xử lý
việc chọn đường dẫn output.

`verify` đầy đủ cần Docker cho các bài tích hợp. Đối chiếu số test thực sự chạy và bị skip trong
`<build directory>/surefire-reports/` của chính lần chạy, mặc định là `target/surefire-reports/`;
không gán kết quả cũ cho cây mã nguồn vừa thay đổi. Các test OpenAPI hiện vẫn ghi artifact vào
`target/openapi/wiki-v1.json` và `target/openapi-mvc/`; override build directory không đổi các đường
dẫn artifact này. CI giữ output mặc định và các đường dẫn hiện có.

Không chạy nhiều build cùng ghi một output hoặc tiếp tục sửa source/configuration chung trong lúc
verify. Không xem một test bị skip là đã kiểm chứng. Dry run không khởi động
ứng dụng và không thay thế kiểm thử đăng nhập, upload hoặc kết nối dependency đang chạy.
