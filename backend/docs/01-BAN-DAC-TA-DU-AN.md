# WikiAOV Backend — Bản đặc tả dự án

**Trạng thái:** Tài liệu đặc tả hiện hành (canonical)
**Phạm vi:** Backend `wiki-service` (AOV Wiki). Mục 3 mô tả bối cảnh toàn hệ thống; frontend và các service khác chỉ được mô tả ở mức ranh giới.
**Tài liệu liên quan:** `02-DATABASE-DU-AN.md`, `03-API-DU-AN.md`


### Trạng thái triển khai domain core

`wiki-service` đã bổ sung Patch context và Hero vertical slice trên foundation hiện có:

- Patch: ruleset, gán ruleset cho region theo khoảng `[validFrom, validTo)`, patch family,
  translation, variant, publish metadata và schedule release. Không seed ruleset/patch game chưa xác minh.
- Hero: identity, composition revision và sáu section độc lập; tạo/fork/sửa/publish/discard,
  optimistic version, audit cùng transaction, giữ nguyên section đã publish khi không sửa.
- Public: danh sách/chi tiết/manifest Hero theo region, fallback locale độc lập gameplay,
  section resources bất biến, ETag cho current reads, reverse media usage.
- Patch history: ghi change set có chủ đích sau khi Hero GAME_PATCH revision được publish;
  query theo Hero và theo patch qua public contracts của module. Không tạo diff tự động.

Publish Hero yêu cầu profile có role/translation, ratings theo scale đã khai báo, ít nhất một stat,
ít nhất một skill và đủ HEAD/PORTRAIT/SPLASH usable đúng semantic type. Skin set rỗng hợp lệ.
Mọi skill phải có translation cho các locale của profile. Source được giữ theo section; derived rating
phải có source mô tả cách suy ra. Hệ thống chưa có workflow phê duyệt nguồn bắt buộc cho mọi field.

GAME_PATCH revision phải có variant cùng ruleset; variant phải publish trước Hero. Metadata/changelog
có thể publish trước thời điểm rollout. Content correction giữ applicability của source; không tự
phát sinh change set. Change set được ghi riêng, cần `patch:write`; STAT/ROLE/VISUAL được đối chiếu
snapshot, SKILL kiểm tra stable key và giá trị thay đổi; mô tả mechanic vẫn cần biên tập viên xác minh.

Item/Spell/Arcana/Enchantment đã có catalog authoring/API theo các phần bổ sung bên dưới; GameMode
vẫn là phase mở rộng. Danh mục tham chiếu dùng scalar projection, đọc Media theo lô và Redis tùy chọn
theo ADR-012. Chưa có projection materialized, full-text search hoặc tự sinh game data.

---

## 1. Mục đích tài liệu

Tài liệu này mô tả **toàn bộ đặc tả backend WikiAOV (`wiki-service`) ở mức dự án**: vị trí của nó trong toàn hệ thống, hệ thống giải quyết bài toán gì, phạm vi nào được hỗ trợ, các domain chính, cách các domain liên hệ với nhau, cách phiên bản/lịch sử hoạt động, các workflow quan trọng, ranh giới module, cấu trúc code, storage, security, cache, observability, testing và hướng triển khai.

Tài liệu này **không** mô tả chi tiết từng bảng/cột database hoặc toàn bộ request/response HTTP. Hai phần đó nằm ở:

- `02-DATABASE-DU-AN.md` — source of truth cho schema logic, ownership, constraints, index, migration và transaction-related data rules;
- `03-API-DU-AN.md` — source of truth cho endpoint, request/response, error, pagination/filtering, auth scope và cache semantics của API.

Nếu có mâu thuẫn:

1. ý nghĩa domain và workflow ưu tiên tài liệu này;
2. chi tiết dữ liệu ưu tiên `02-DATABASE-DU-AN.md`;
3. chi tiết giao tiếp HTTP ưu tiên `03-API-DU-AN.md`.

---

## 2. Tổng quan dự án

WikiAOV backend là hệ thống dữ liệu và nội dung cho Liên Quân/Arena of Valor, tập trung vào các nhóm dữ liệu gameplay, lịch sử thay đổi, media và quản trị nội dung.

Backend phải hỗ trợ các nhu cầu chính:

- tra cứu tướng và toàn bộ dữ liệu liên quan;
- tra cứu trang bị, bảng ngọc, phù hiệu, phụ trợ và các domain gameplay khác;
- lưu và công bố dữ liệu theo revision, không ghi đè lịch sử;
- mô tả patch/version game và các thay đổi theo từng domain;
- hỗ trợ nhiều region với thời điểm áp dụng patch khác nhau;
- hỗ trợ nhiều locale mà không gắn locale cứng vào region;
- quản lý media theo logical asset và nhiều version chất lượng khác nhau;
- phân biệt thay đổi gameplay, chỉnh sửa nội dung WikiAOV và thay đổi kỹ thuật của media;
- cung cấp API public/read và API quản trị;
- giữ module/domain đủ độc lập để có thể tách service sau này nếu xuất hiện nhu cầu thật.

### 2.1 Mục tiêu kiến trúc

Backend được xây dưới dạng **Spring Boot modular monolith**:

- một ứng dụng triển khai;
- một runtime chính;
- PostgreSQL là database chính;
- object storage lưu bytes media;
- module tách theo domain và ownership;
- module khác chỉ dùng public contract, không truy cập repository/entity nội bộ;
- transaction nội bộ được giữ đơn giản trong giai đoạn đầu;
- không tách microservice chỉ vì domain có tên khác nhau.

### 2.2 Công nghệ nền

```text
Java 21 · Spring Boot 4.1.x · Maven Wrapper
Spring Data JPA · Flyway · PostgreSQL
Spring Security OAuth2 Resource Server · Spring Modulith
Lombok · MapStruct · Testcontainers
AWS SDK for Java 2.x (S3) — truy cập object storage
Spring Data Redis — cache read model tùy chọn, ADR-012
```

Chi tiết cấu hình thư viện (annotation processing của Lombok/MapStruct, quy ước Flyway) xem `NOTE-SPRING-BOOT-4.md`. Nếu NOTE mâu thuẫn với bộ 01/02/03 (tên package, kiểu ID, API base path, cấu trúc package), bộ 01/02/03 được ưu tiên.

### 2.3 Không thuộc phạm vi bắt buộc ban đầu

Các thành phần sau không phải điều kiện để backend đầu tiên hoàn thành:

- Kubernetes;
- Spring Cloud Gateway (dùng reverse proxy, xem mục 3.6);
- Eureka/service registry;
- Config Server;
- Kafka;
- Redis (hiện đã có tích hợp tùy chọn theo ADR-012, không bắt buộc để phục vụ API);
- nhiều deployable microservice;
- distributed transaction;
- event sourcing toàn hệ thống.

Có thể thêm sau khi có nhu cầu vận hành/thông lượng/scale rõ ràng.

---

## 3. Kiến trúc hệ thống và cấu trúc triển khai

Mục này mô tả **bức tranh toàn hệ thống**: có những khu vực sản phẩm nào, chia thành những deployable nào, chúng giao tiếp ra sao và triển khai trên hạ tầng nào.

Phần còn lại của tài liệu này, cùng `02-DATABASE-DU-AN.md` và `03-API-DU-AN.md`, chỉ đặc tả chi tiết **`wiki-service`**. Các service khác ở đây chỉ được cố định ở mức ranh giới, để việc làm AOV Wiki bây giờ không chặn đường các phần sau.

### 3.1 Khu vực sản phẩm

| Khu vực | Nội dung | Deployable | Trạng thái |
|---|---|---|---|
| **AOV Wiki** | Tướng (kỹ năng, trang phục), trang bị, phù hiệu, phụ trợ, bảng ngọc, chế độ chơi, lịch sử cập nhật | `wiki-service` | Triển khai ngay |
| **Cộng đồng** | Bài viết, bình luận, thảo luận, báo cáo/kiểm duyệt | `community-service` | Sau |
| **Giải đấu** | Nhập tay giải, đội/tuyển thủ, loạt/ván, cấm/chọn theo lượt (đội không chọn lại tướng đã dùng trong loạt, trừ ván cuối của BO), cấu hình, diễn biến trang bị và dòng thời gian ván gắn video chính thức | `community-service` | Triển khai giai đoạn nhập tay; [ADR-015](adr/ADR-015-manual-tournament-recording.md) |
| **Livestream** | Danh sách kênh, trạng thái đang live, nhúng player | `community-service` | Sau |

Frontend là monorepo React + TypeScript + Vite (pnpm workspace, Turborepo) trong thư mục `frontend/`:

| App | Vai trò | Gọi tới |
|---|---|---|
| `aov-wiki` | Trang AOV Wiki (public) | `wiki-service` |
| `aov-stream` | Trang xem giải đấu; livestream sẽ mở rộng sau | Public API của `community-service`; tham chiếu game từ `wiki-service` |
| `admin-aov` | Trang quản trị cho biên tập viên | Admin API của `wiki-service` và `community-service` |

UI dùng chung nằm ở `packages/ui` (`@aov/ui`, shadcn/ui). Giải đấu mở rộng trong `aov-stream`; trang cộng đồng và khả năng livestream vẫn triển khai sau.

### 3.2 Nguyên tắc chia deployable

Deployable được chia theo **đặc tính workload và loại người ghi dữ liệu**, không theo danh từ nghiệp vụ.

| Tiêu chí | AOV Wiki | Cộng đồng / Giải đấu / Livestream |
|---|---|---|
| Ai ghi dữ liệu | Biên tập viên, số lượng ít, có quyền | Người dùng cuối, số lượng lớn; cộng thêm admin |
| Tỉ lệ đọc/ghi | Đọc rất nhiều, ghi hiếm | Ghi thường xuyên |
| Cache | Dữ liệu publish theo revision immutable, cache mạnh | Thay đổi liên tục, cache ngắn |
| Rủi ro bảo mật | Bề mặt ghi chỉ dành cho admin | Spam, abuse, nội dung cần kiểm duyệt |
| Thời gian thực | Không cần | Live status, thông báo; có thể cần WebSocket/SSE |
| Tích hợp bên ngoài | Không bắt buộc | API nền tảng stream (YouTube, Twitch, Facebook Gaming…) |

Hệ quả: hệ thống có **hai deployable backend**.

```text
wiki-service        AOV Wiki                          — triển khai ngay
community-service   Nhập liệu giải đấu trước; Cộng đồng + Livestream triển khai sau
```

Ghi chú:

- `community-service` cũng là modular monolith, gồm các module `community`, `tournament`, `livestream`.
- Giải đấu đặt ở `community-service` vì giá trị chính của nó gắn với người dùng (theo dõi, bình luận trận, dự đoán). Dữ liệu giải đấu vẫn có thể do admin nhập.
- Nếu sau này một phần có lý do thật để tách tiếp (theo mục 26), ứng viên đầu tiên là **worker đồng bộ trạng thái livestream** (polling API bên ngoài theo lịch, lỗi mạng không được ảnh hưởng request người dùng).
- **Không** tách hero/item/spell/enchantment/arcana thành service riêng (xem mục 2.1).

### 3.3 Sơ đồ hệ thống mục tiêu

```text
                     Người dùng / Biên tập viên (trình duyệt)
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │  reverse-proxy (Caddy hoặc Nginx)   │
                  │  TLS · routing · giới hạn tần suất  │
                  └─────────────────────────────────────┘
        │                  │                      │                    │
        │ /, /stream/,     │ /api/wiki/**         │ /api/community/**  │ /media/**
        │ /admin/          │                      │                    │
        ▼                  ▼                      ▼                    ▼
  ┌───────────┐     ┌──────────────┐      ┌───────────────────┐  ┌────────────────┐
  │ frontend  │     │ wiki-service │      │ community-service │  │ Object storage │
  │ 3 app tĩnh│     │ Spring Boot  │      │ Spring Boot (sau) │  │ S3 storage     │
  │ (React)   │     └──────────────┘      └───────────────────┘  └────────────────┘
  └───────────┘            │                      │
                           ▼                      ▼
                    ┌──────────────┐      ┌───────────────┐
                    │ PostgreSQL   │      │ PostgreSQL    │
                    │ db: wiki     │      │ db: community │
                    └──────────────┘      └───────────────┘

  Dùng chung: Identity provider (Keycloak) — phát JWT, hai service xác minh qua JWKS.
```

- `wiki-service` ghi media vào object storage qua S3 API; trình duyệt chỉ đọc media qua `/media/**`.
- `community-service` gọi public API của `wiki-service` khi cần (mục 3.8), không đọc database `wiki`.

### 3.4 Topology giai đoạn hiện tại — chỉ AOV Wiki

```text
Trình duyệt
  │
  ▼
reverse-proxy ── /             → aov-wiki      (bản build tĩnh)
              ── /admin/       → admin-aov     (bản build tĩnh)
              ── /api/wiki/**  → wiki-service:8080
              ── /media/**     → object storage (bucket wiki-media, chỉ prefix assets/, chỉ GET)

wiki-service  ──→ postgres  (database: wiki)
              ──→ object storage (S3 API, credential có quyền ghi)
              ──→ keycloak  (chỉ lấy JWKS để xác minh token)
```

Container:

| Container | Vai trò | Ghi chú |
|---|---|---|
| `reverse-proxy` | TLS, routing, phục vụ file tĩnh của các app frontend | Caddy tự cấp chứng chỉ TLS, cấu hình ngắn |
| `wiki-service` | Spring Boot JAR | Một instance là đủ ở giai đoạn đầu |
| `postgres` | Database `wiki`; về sau thêm `keycloak`, `community` | Mỗi database một user DB riêng |
| object storage | Lưu bytes media | Bucket `wiki-media`; local dùng `seaweedfs`, production dùng dịch vụ S3-compatible (mục 13.2) |
| `keycloak` | Phát JWT | Cần từ khi bật admin API (Phase 3) |

Chạy bằng **Docker Compose trên một máy (VPS)** là đủ. Không dùng Kubernetes ở giai đoạn này.

### 3.5 Ánh xạ trang AOV Wiki → module trong `wiki-service`

| Mục trên trang AOV Wiki | Module | Ghi chú |
|---|---|---|
| Tướng | `hero` | |
| Kỹ năng | `hero` | Identity `(heroId, skillKey)`, nằm trong `SkillsRevision` của tướng |
| Trang phục (skin) | `hero` | Identity `(heroId, skinKey)`, nằm trong `SkinsRevision` của tướng |
| Trang bị | `item` | |
| Phù hiệu | `enchantment` | |
| Phụ trợ | `spell` | |
| Bảng ngọc | `arcana` | |
| Chế độ chơi | `gamemode` | |
| Cập nhật / patch notes | `patch` + `query` | Patch detail ghép thay đổi từ nhiều module |
| Mọi loại ảnh | `media` | Các module khác chỉ tham chiếu `MediaAsset.id` |

Kỹ năng và trang phục **không** là module riêng: chúng không có ý nghĩa khi tách khỏi tướng và được publish cùng `HeroRevision`. Nếu cần trang "tất cả trang phục" xuyên suốt các tướng, thêm read query trong module `hero` (ví dụ `HeroSkinQueries`), không tạo module `skin`.

### 3.6 Routing và API base path

- Mỗi service có một tiền tố riêng: `wiki-service` → `/api/wiki/v1/**`, `community-service` → `/api/community/v1/**`.
- Reverse proxy route theo tiền tố, **không rewrite path**. Service tự phục vụ đúng đường dẫn đầy đủ, nên URL trong OpenAPI `servers`, trường `instance` của ProblemDetail và URL thật luôn khớp nhau.
- Tiền tố riêng tránh đụng tên resource giữa các service (ví dụ `comments` của wiki và của cộng đồng).
- Frontend và API cùng origin nên production không cần CORS. Mỗi app build với `base` tương ứng (`/`, `/stream/`, `/admin/`). Ở local, mỗi app dùng `server.proxy` của Vite để chuyển `/api` và `/media` sang backend.
- Media public được phục vụ trực tiếp từ object storage/CDN theo URL có version (`/media/{assetId}/{assetVersionId}.{ext}`). Spring Boot không stream bytes ảnh.
- Proxy chỉ mở prefix `assets/` của bucket; object đang upload (`incoming/`) không bao giờ public.

### 3.7 Identity và phân quyền dùng chung

- Một identity provider (Keycloak), một realm cho toàn nền tảng.
- Client:

```text
admin-aov-backend confidential client — Direct Grant cho modal mật khẩu; Code + PKCE cho Google qua backend
admin-aov      public client cũ, không dùng trong luồng admin hiện tại
aov-wiki       public client, PKCE — chỉ cần khi có tính năng người dùng cuối đăng nhập (sau)
aov-stream     public client, PKCE — chỉ cần khi có tính năng người dùng cuối đăng nhập (sau)
wiki-importer  confidential client, client credentials — script import dữ liệu gọi admin API
```

- Audience theo service: `wiki-service`, `community-service`. Mỗi service chỉ chấp nhận token có audience của mình.
- `wiki-service`: public GET không cần token; admin API cần scope theo mục 20.
- `community-service` (sau): tài khoản người dùng cuối. Biên tập viên và người dùng cuối nằm cùng IdP, khác nhau ở role/scope.
- Actor identity thống nhất toàn hệ thống là `(issuer, subject)`, nên một người vừa biên tập wiki vừa đăng bài cộng đồng vẫn là một danh tính.
- Luồng admin qua backend theo ADR-007: mật khẩu chỉ chuyển tiếp tới Keycloak, refresh token nằm trong cookie HttpOnly; access token giữ trong bộ nhớ frontend.
- Không service nào lưu mật khẩu. Hồ sơ hiển thị (tên, avatar, giới thiệu, locale, múi giờ) thuộc module `user` trong `wiki-service`, khóa theo `(issuer, subject)`; dùng chung qua API theo ADR-008.
- Trước khi Keycloak sẵn sàng, admin API **không được** mở ra ngoài production.

### 3.8 Dữ liệu và giao tiếp giữa các service

**Database riêng cho từng service.** Có thể chung một PostgreSQL instance nhưng khác database và khác user DB. Không service nào đọc database của service khác.

**Tham chiếu dữ liệu wiki từ service khác** bằng ID ổn định:

```text
community.post_hero_tag.hero_id        = hero.id (UUID)
tournament.match_pick.hero_id          = hero.id (UUID)
```

`code` dùng cho URL thân thiện, không lưu làm khóa tham chiếu.

**Hiển thị tên/ảnh tướng** trong trang cộng đồng/giải đấu:

- Mặc định frontend tự ghép: `community-service` trả `heroId`, app frontend lấy tên/ảnh từ public API của `wiki-service` (đã có ETag/cache).
- Backend-to-backend chỉ khi cần **validate** (ví dụ pick/ban phải là tướng tồn tại), gọi public API của wiki với timeout và cache ngắn.

**Bối cảnh lịch sử.** Mỗi ván đấu lưu `region`, mùa/patch và snapshot metadata game đã sử dụng; một giải có thể đi qua nhiều patch. Chọn riêng mùa sẽ giải quyết patch public phù hợp và đóng băng UUID khi xuất bản. Mốc chưa biết phải ghi rõ, không đoán từ ngày tổ chức. Không đọc lại danh mục “hiện tại” để thay dữ liệu ván đã công khai. Xem [ADR-015](adr/ADR-015-manual-tournament-recording.md).

**Event.** Chưa cần message broker. Event nội bộ của `wiki-service` (Spring Modulith) không trở thành contract với service khác cho tới khi có nhu cầu thật; lúc đó dùng outbox + broker và chốt bằng ADR.

### 3.9 Cấu trúc thư mục dự án

Toàn bộ dự án nằm trong một thư mục gốc:

```text
aov-project/
├── backend/
│   ├── docs/                 Tài liệu backend: 01/02/03, NOTE-SPRING-BOOT-4.md, adr/
│   ├── wiki-service/         Spring Boot — AOV Wiki (đặc tả bởi bộ 01/02/03)
│   └── community-service/    Spring Boot — tạo khi bắt đầu cộng đồng/giải đấu/livestream
│
├── frontend/                 pnpm workspace + Turborepo
│   ├── apps/
│   │   ├── aov-wiki/         Trang AOV Wiki         (local: 5173)
│   │   ├── aov-stream/       Trang livestream       (local: 5174)
│   │   └── admin-aov/        Trang quản trị         (local: 5175)
│   └── packages/
│       ├── ui/               @aov/ui — shadcn/ui dùng chung
│       └── typescript-config/
│
├── infra/                    (tạo khi deploy) docker-compose production, reverse proxy, realm Keycloak, script backup
│
└── resources/                Tài nguyên thô đang thu thập (tạm thời, chưa hoàn chỉnh)
```

- Tài liệu dùng chung cho các service backend nằm ở `backend/docs/`. Mỗi service có thể có `README.md` riêng trong thư mục của nó.
- `resources/` là dữ liệu làm việc tạm thời, **không** phải nguồn dữ liệu chính thức và không được service đọc trực tiếp lúc chạy.
- Không tạo thư viện Java dùng chung giữa `wiki-service` và `community-service` ở giai đoạn đầu. Contract giữa các bên là **OpenAPI**.
- Frontend sinh TypeScript type từ OpenAPI của từng service (có thể đặt trong một package như `packages/api-client`).

### 3.10 Môi trường

| Môi trường | Mục đích | Cách chạy |
|---|---|---|
| `local` | Phát triển | `docker compose` chạy postgres, seaweedfs, keycloak; `wiki-service` chạy từ IDE; các app frontend chạy `pnpm dev` |
| `test` | Integration test | Testcontainers (PostgreSQL, SeaweedFS); JWT giả lập trong test, không cần Keycloak |
| `prod` | Thật | Một VPS, Docker Compose, reverse proxy TLS, backup PostgreSQL + object storage |

`staging` thêm khi có người dùng thật và cần thử bản phát hành trước.

CI/CD tối thiểu: GitHub Actions chạy test → build image → push registry → máy prod `docker compose pull && up -d`.

### 3.11 Cố ý chưa làm

| Thành phần | Lý do |
|---|---|
| Spring Cloud Gateway, service discovery | Hai service, reverse proxy route theo tiền tố là đủ |
| Message broker (Kafka/RabbitMQ) | Chưa có luồng event liên service |
| Tự host/transcode video | Livestream chỉ **nhúng player** của nền tảng stream; backend chỉ lưu metadata kênh và trạng thái live |
| Search engine riêng (Elasticsearch/OpenSearch) | PostgreSQL đủ cho tìm kiếm wiki; xem xét lại khi cộng đồng có lượng bài lớn |

### 3.12 Quyết định cần ghi ADR

```text
ADR-001  wiki-service là modular monolith
ADR-002  Chia hai deployable theo workload: wiki-service / community-service
ADR-003  Base path theo service, reverse proxy route theo tiền tố, không rewrite
ADR-004  Một identity provider, actor = (issuer, subject)
ADR-005  Livestream chỉ nhúng player, không host video
ADR-006  Object storage qua chuẩn S3 với AWS SDK for Java 2.x (đã ghi: docs/adr/ADR-006-object-storage-s3.md)
```

ADR đặt tại `docs/adr/` của repository tương ứng.

---

## 4. Phạm vi nghiệp vụ

Backend được tổ chức quanh các bounded domain chính.

### 4.1 Hero domain

Quản lý:

- Hero identity;
- mã ổn định của tướng;
- profile;
- role;
- bản dịch;
- overview ratings;
- combat stats;
- skills;
- skins;
- media bindings;
- revision/draft/publication lifecycle;
- lịch sử thay đổi gameplay của hero;
- reverse lookup media usage của hero.

Hero là domain đầu tiên cần triển khai đầy đủ và là mẫu chuẩn cho các domain catalog còn lại.

### 4.2 Media domain

Quản lý:

- logical media asset;
- media asset version;
- rendition/derivative;
- nguồn/provenance;
- metadata file;
- hash;
- MIME thực tế;
- dimensions;
- upload session;
- activation/deprecation;
- reverse usage projection.

Media domain không quyết định asset đó có ý nghĩa gameplay gì. Ví dụ:

> `MediaAsset A20` là file/artwork nào — thuộc media.
> `A20 đang là portrait của Nakroth` — thuộc hero.

### 4.3 Patch domain

Quản lý:

- GamePatch;
- PatchVariant;
- GameplayRuleset;
- Region;
- Locale reference/config nếu cần ở mức patch;
- RegionRulesetAssignment;
- PatchRelease;
- patch translation;
- common patch change index/projection.

Patch domain mô tả **một phiên bản game và phạm vi áp dụng**, không chỉ thay đổi của hero.

### 4.4 Item domain

Quản lý trang bị và revision của trang bị, bao gồm các thay đổi dạng:

- stats;
- price;
- passive;
- active;
- recipe;
- build path;
- patch changes.

### 4.5 Arcana domain

Quản lý bảng ngọc/arcana và các revision/change tương ứng.

### 4.6 Spell domain

Quản lý phụ trợ/summoner spell, không dùng tên `ability` để tránh nhầm với skill của hero.

### 4.7 Enchantment domain

Quản lý phù hiệu/enchantment và các nhánh/quy tắc liên quan.

### 4.8 GameMode domain

Quản lý chế độ chơi và metadata liên quan nếu cần.

### 4.9 Access domain

Quản lý tích hợp authentication/authorization ở backend:

- xác minh JWT;
- issuer/audience;
- actor context;
- mapping scope/permission;
- audit actor identity.

Không tự động đồng nghĩa với một auth server riêng.

### 4.10 Query/composition layer

Chỉ xuất hiện khi một use case cần ghép dữ liệu từ nhiều module.

Ví dụ:

```text
Patch detail
├── HeroPatchChangeQueries
├── ItemPatchChangeQueries
├── ArcanaPatchChangeQueries
├── SpellPatchChangeQueries
└── EnchantmentPatchChangeQueries
```

Query/composition layer không được bypass ownership bằng cách đọc repository nội bộ của các module.

---

## 5. Các yêu cầu chức năng cấp dự án

### FR-HERO-001 — Tra cứu Hero

Hệ thống phải cho phép đọc danh sách và chi tiết hero đã được công bố theo context phù hợp.

### FR-HERO-002 — Authoring Hero

Quản trị viên có quyền phải tạo hero, tạo/sửa draft, publish, discard và thực hiện content correction theo lifecycle quy định.

### FR-HERO-003 — Section revision

Hero revision phải có khả năng reuse các section không thay đổi thay vì copy toàn bộ dữ liệu.

### FR-HERO-004 — Hero history

Phải phân biệt được:

- gameplay change history;
- WikiAOV content revision history;
- media technical history.

### FR-MEDIA-001 — Media asset lifecycle

Hệ thống phải quản lý logical asset riêng với file version cụ thể.

### FR-MEDIA-002 — Quality upgrade

Thay một file bằng bản chất lượng cao hơn nhưng cùng artwork không được tự động tạo gameplay/content revision mới.

### FR-MEDIA-003 — Reverse usage

Quản trị phải truy được asset đang được tham chiếu ở đâu, tối thiểu phân biệt current/draft/historical usage.

### FR-PATCH-001 — Multi-domain patch

Một patch có thể thay đổi Hero, Item, Arcana, Spell, Enchantment, GameMode hoặc System data.

### FR-PATCH-002 — Hai chiều lịch sử

Phải hỗ trợ:

```text
Hero -> các patch từng thay đổi hero
Patch -> các đối tượng đã thay đổi trong patch
```

và pattern tương tự cho Item/Arcana/Spell/Enchantment.

### FR-REGION-001 — Region rollout

Cùng một gameplay patch có thể áp dụng ở các region khác ngày/giờ.

### FR-RULESET-001 — Gameplay ruleset

Các region có cùng gameplay phải có thể dùng chung ruleset/data thay vì duplicate dữ liệu theo region.

### FR-LOCALE-001 — Localization độc lập region

Locale không được suy ra cứng từ region. Ví dụ `region=VN` vẫn có thể yêu cầu `locale=en-US` nếu translation có sẵn.

### FR-API-001 — Stable error code

Lỗi backend phải có machine-readable `code` ổn định. Text message/detail không được là định danh logic của lỗi.

### FR-AUDIT-001 — Audit

Các thao tác quản trị quan trọng phải truy được actor, entity, thời điểm và loại thao tác.

### FR-STORAGE-001 — Object storage

Media bytes không lưu trong bảng domain Hero/Item; phải được lưu ở object storage thông qua abstraction của media module.

---

## 6. Mô hình domain tổng thể

```text
                                 GamePatch
                                     │
                               PatchVariant
                                     │
                              GameplayRuleset
                                     │
                                PatchRelease
                                     │
                                   Region

Hero ───────────── HeroPatchChangeSet ───────────── PatchVariant
 │
 └── HeroRevision
      ├── ProfileRevision
      ├── OverviewRevision
      ├── StatsRevision
      ├── SkillsRevision
      ├── SkinsRevision
      └── MediaBindingRevision
                            │
                            ▼
                       MediaAsset
                            │
                            ├── MediaAssetVersion
                            └── MediaRendition

Item ───────────── ItemPatchChangeSet ───────────── PatchVariant
Arcana ─────────── ArcanaPatchChangeSet ────────── PatchVariant
Spell ──────────── SpellPatchChangeSet ─────────── PatchVariant
Enchantment ────── EnchantmentPatchChangeSet ───── PatchVariant
```

Điểm quan trọng:

- `HeroRevision` không phải `GamePatch`;
- `MediaAssetVersion` không phải `HeroRevision`;
- `PatchRelease` không phải `PatchVariant`;
- `Region` không phải `Locale`;
- `Region` không nhất thiết tương ứng 1:1 với `GameplayRuleset`.

---

## 7. Hero domain specification

### 7.1 Hero identity

Hero có identity ổn định:

```text
Hero
├── id   UUID
└── code stable slug
```

Tên hiển thị không được dùng làm identity vì có thể:

- thay đổi;
- khác locale;
- sửa chính tả;
- khác cách romanization.

Ví dụ:

```text
id   = 05f3... UUID
code = nakroth
```

### 7.2 HeroRevision là composition

Một HeroRevision không cần copy toàn bộ nội dung của hero.

Ví dụ:

```text
HR20
├── Profile P3
├── Overview O5
├── Stats S9
├── Skills K13
├── Skins C4
└── MediaBindings M5
```

Patch mới chỉ thay skill:

```text
HR21
├── Profile P3       reused
├── Overview O5      reused
├── Stats S9         reused
├── Skills K14       NEW
├── Skins C4         reused
└── MediaBindings M5 reused
```

Lợi ích:

- lịch sử chính xác;
- tránh duplicate dữ liệu;
- biết section nào thực sự thay đổi;
- cache/read model có thể address section bằng revision identity;
- content correction không cần giả vờ mọi section đều thay đổi.

### 7.3 Hero profile

Profile chứa các thông tin semantic/biên tập như:

- localized name;
- title;
- summary;
- lore;
- roles;
- classification khác nếu cần.

### 7.4 Overview ratings

Các rating tổng quan được tách khỏi raw gameplay stats.

Ví dụ:

```text
survivability
attackDamage
skillEffect
difficulty
```

Đây là dữ liệu đánh giá/tóm tắt, không đồng nghĩa với raw HP/attack/armor.

### 7.5 Combat stats

Combat stats dành cho dữ liệu gameplay có giá trị số/cấu trúc thực tế, ví dụ:

- HP;
- physical attack;
- armor;
- magic defense;
- move speed;
- attack range/type;
- các raw stat khác khi có nguồn đáng tin cậy.

Không ép toàn bộ stat vào một object JSON không kiểm soát nếu domain đã ổn định đủ để mô hình hóa rõ ràng.

### 7.6 Skills

Skill identity phải ổn định theo hero và không dựa vào localized name.

Skill set revision chứa snapshot của skill presentation/gameplay data tại một thời điểm.

Có thể hỗ trợ:

- passive;
- active;
- other;
- formKey;
- displayOrder;
- icon MediaAsset;
- localized name/description;
- structured values/effects khi triển khai sâu hơn.

### 7.7 Skins

Skin identity tương tự skill identity: ổn định trong phạm vi hero.

Skin set revision có thể chứa:

- localized name;
- description;
- rarity/tier khi taxonomy được xác minh;
- acquisition note;
- image MediaAsset;
- display order.

### 7.8 Ba loại ảnh Hero

Hero phải hỗ trợ ít nhất ba media role:

```text
HEAD
PORTRAIT
SPLASH
```

Ý nghĩa:

- `HEAD`: ảnh nhỏ/icon/headshot;
- `PORTRAIT`: ảnh hero chính dùng cho card/chọn tướng;
- `SPLASH`: ảnh lớn/rộng có bối cảnh.

Hero chỉ bind tới `MediaAsset.id`, không bind trực tiếp tới object key.

---

## 8. Revision, version và history semantics

Hệ thống phải phân biệt rõ ít nhất bốn loại lịch sử.

### 8.1 Gameplay history

Trả lời:

> Trong game, đối tượng đã thay đổi gì qua các patch?

Nguồn chính:

```text
GamePatch
PatchVariant
<Domain>PatchChangeSet
<Domain>PatchChangeItem
```

### 8.2 Wiki content revision history

Trả lời:

> Dữ liệu WikiAOV đã được biên tập/sửa/publish như thế nào?

Ví dụ:

- sửa typo;
- bổ sung bản dịch;
- bổ sung nguồn;
- chỉnh mô tả;
- publish revision mới.

Không phải mọi content revision đều là game patch change.

### 8.3 Media technical history

Trả lời:

> Cùng logical asset đã có những file/version kỹ thuật nào?

Ví dụ:

```text
AV1: 512px PNG
AV2: 1024px PNG
AV3: 4K WebP
```

### 8.4 Patch release history

Trả lời:

> Patch variant được áp dụng ở region nào và lúc nào?

Ví dụ:

```text
PatchVariant GLOBAL
├── VN  -> 2026-09-28
├── TH  -> 2026-09-29
└── ID  -> 2026-09-29
```

---

## 9. Draft và publication lifecycle

Một đối tượng có authoring workflow phải tránh chỉnh thẳng dữ liệu public.

Hero là mẫu chuẩn:

```text
DRAFT
  │
  ├── publish -> PUBLISHED
  └── discard -> DISCARDED
```

Quy tắc:

- published revision không sửa trực tiếp;
- chỉnh tiếp phải tạo draft/revision mới;
- public pointer chỉ đổi khi publish transaction thành công;
- stale draft/version phải bị phát hiện;
- audit được ghi cùng transaction thay đổi state quan trọng;
- content correction có thể tạo revision mới mà không gắn game patch nếu gameplay không đổi.

### 9.1 Concurrent editing

Use case sửa draft cần optimistic concurrency token/version.

Hai editor cùng sửa không được âm thầm ghi đè nhau.

Ví dụ:

```text
Editor A đọc version 8
Editor B đọc version 8

A save -> version 9
B save với expectedVersion 8 -> VERSION_CONFLICT
```

---

## 10. Patch và thay đổi gameplay

### 10.1 GamePatch

`GamePatch` là identity/canonical concept của một bản cập nhật game.

Nó không bị gắn cứng vào một region.

### 10.2 PatchVariant

Một GamePatch có thể có một hoặc nhiều variant khi gameplay khác theo ruleset.

Ví dụ:

```text
Patch 1.62
├── Variant GLOBAL -> AOV-GLOBAL
└── Variant TW     -> AOV-TW
```

### 10.3 Multi-domain changes

Một PatchVariant có thể gồm:

```text
Hero changes
Item changes
Arcana changes
Spell changes
Enchantment changes
GameMode changes
System changes
```

Không ép chi tiết mọi domain vào một bảng change JSON chung nếu semantics khác nhau.

Mỗi domain sở hữu detailed change model của mình.

### 10.4 Hero patch change

Một hero change set nên biết tối thiểu:

- patchVariant;
- hero;
- fromRevision;
- toRevision;
- summary;
- categories;
- các change item chi tiết.

### 10.5 Change item

Change item có thể là structured change:

```text
field = cooldown
old   = 10 second
new   = 8 second
```

hoặc descriptive change khi không thể mô hình hóa hợp lý bằng giá trị cũ/mới.

Không tự động coi raw text diff là gameplay change. Diff chỉ là công cụ hỗ trợ review.

---

## 11. Region, Locale và GameplayRuleset

Ba khái niệm này độc lập.

### 11.1 Region

Region đại diện **thị trường/phạm vi phát hành** mà Wiki theo dõi lịch cập nhật và dữ liệu game.
Không đại diện nơi cư trú của người dùng, ngôn ngữ giao diện hoặc vị trí máy chủ vật lý.

#### 11.1.1 Danh mục thị trường khởi đầu

Ưu tiên xác định danh mục thị trường trước khi nhập dữ liệu theo khu vực. Phạm vi khởi đầu của dự án:

| Code | Thị trường | Tên sản phẩm tại thị trường | Locale gợi ý | Múi giờ tham chiếu | Nguồn chính thức |
|---|---|---|---|---|---|
| `VN` | Việt Nam | Liên Quân Mobile | `vi-VN` | `Asia/Ho_Chi_Minh` | [Garena Việt Nam](https://lienquan.garena.vn/) |
| `TH` | Thái Lan | RoV: Arena of Valor | `th-TH` | `Asia/Bangkok` | [RoV Thái Lan](https://www.rov.in.th/) |
| `TW` | Đài Loan | 傳說對決 | `zh-TW` | `Asia/Taipei` | [Garena Đài Loan](https://moba.garena.tw/) |
| `ID` | Indonesia | Garena AOV | `id-ID` | `Asia/Jakarta` | [Garena Indonesia](https://main.aov.garena.co.id/) |
| `GLOBAL` | Global (phạm vi quốc tế chờ xác định) | Arena of Valor | `en-US` | `UTC` | [Arena of Valor](https://www.arenaofvalor.com/) |

Đối chiếu nguồn ngày **13/10/2026**. Tên sản phẩm và nguồn dùng để nhận diện thị trường;
locale/múi giờ là lựa chọn cấu hình của dự án, không phải giới hạn ngôn ngữ hay địa lý do nhà phát hành công bố.
Indonesia có nhiều múi giờ; `Asia/Jakarta` chỉ là giá trị tham chiếu, không áp cho mọi người dùng.

Đây không phải danh sách toàn bộ thị trường AoV trên thế giới. `GLOBAL` là mục chuẩn bị cho phạm vi quốc tế,
được seed ở trạng thái khóa theo yêu cầu ngày 13/10/2026, không gom dữ liệu mọi quốc gia hoặc thay thế VN.
Locale `en-US` và múi giờ `UTC` của Global chỉ là cấu hình dự phòng của dự án. Trước khi mở Global hoặc thêm thị trường khác,
cần xác minh phạm vi phát hành, nguồn cập nhật và lịch rollout tương ứng. Không suy ra một region riêng
chỉ từ quốc gia của người chơi, ngôn ngữ bản dịch hoặc đội tuyển tham dự giải đấu.

#### 11.1.2 Quy tắc sử dụng

- Migration `V004__create_regions.sql` tạo danh mục: `VN` ACTIVE, `TH`/`TW`/`ID`/`GLOBAL` LOCKED, có lý do chưa hỗ trợ.
- ACTIVE tại bước này chỉ cho phép chọn phạm vi dữ liệu VN hiện có trên Admin, không xác nhận đã triển khai
  patch resolver. Admin hiện dùng adapter dữ liệu VN; Wiki triển khai bộ chọn ở giai đoạn sau.
- Mã region ổn định; dùng UUID làm khóa chính theo quy ước chung. Không hard-code danh sách region trong frontend.
- Có tên trong danh mục không đồng nghĩa Wiki đã có đủ dữ liệu. Khi triển khai API gameplay theo patch, chỉ mở lựa chọn đọc khi đã có
  ruleset assignment và dữ liệu hiệu lực phù hợp; không tự lấy dữ liệu VN thay cho thị trường chưa sẵn sàng.
- Market có thể dùng chung ruleset nhưng khác lịch phát hành. Không mặc định mỗi thị trường là một ruleset riêng.
- `Region.timezone` phục vụ lịch phát hành; `user_profile.profile.time_zone` là lựa chọn cá nhân độc lập.
- Không suy ra region từ locale/múi giờ trình duyệt. Người dùng phải chọn thị trường muốn tra cứu;
  locale và múi giờ trong hồ sơ không bị đổi theo lựa chọn đó.
- Admin hiển thị cả mục khóa với lý do, không cho chọn. Backend từ chối resolve mục khóa hoặc code không tồn tại
  bằng `422 UNSUPPORTED_REGION`. Chưa cung cấp API bật/tắt; mở thị trường cần triển khai adapter/dữ liệu và cập nhật cấu hình có kiểm soát.

### 11.2 Locale

Locale đại diện ngôn ngữ/cách trình bày nội dung.

Ví dụ:

```text
vi-VN
en-US
th-TH
zh-TW
```

Không được coi:

```text
region=VN => locale bắt buộc vi-VN
```

### 11.3 GameplayRuleset

Ruleset đại diện bộ gameplay/data áp dụng.

Ví dụ:

```text
AOV-GLOBAL
AOV-TW
AOV-TEST
```

Nhiều region có thể dùng chung ruleset.

Các mã ruleset và ánh xạ minh họa bên dưới là ví dụ mô hình, không xác nhận rằng các bản phát hành
VN/TH/TW/ID hiện có gameplay giống hoặc khác nhau. Assignment thực tế cần đối chiếu dữ liệu patch.

### 11.4 RegionRulesetAssignment

Region có thể ánh xạ tới ruleset theo thời gian.

Ví dụ:

```text
VN -> AOV-GLOBAL
TH -> AOV-GLOBAL
TW -> AOV-TW
```

### 11.5 PatchRelease

PatchRelease trả lời:

> Variant nào có hiệu lực ở region nào vào lúc nào?

Ví dụ:

```text
PatchVariant GLOBAL
VN effectiveAt = 2026-09-28T...
TH effectiveAt = 2026-09-29T...
```

Nhờ vậy không cần duplicate toàn bộ gameplay data chỉ vì rollout khác ngày.

---

## 12. Media domain specification

### 12.1 MediaAsset

`MediaAsset` là logical/semantic asset.

Ví dụ:

```text
A20 = portrait artwork X của hero Y
```

### 12.2 MediaAssetVersion

Một asset có nhiều source byte versions:

```text
A20
├── AV1  512px PNG
├── AV2  1024px PNG
└── AV3  4K WebP
```

### 12.3 MediaRendition

Rendition là derivative của một asset version, ví dụ resize/codec khác phục vụ delivery.

### 12.4 Cùng artwork, chất lượng cao hơn

Nếu:

- cùng artwork;
- cùng semantic meaning;
- chỉ tăng resolution;
- đổi codec;
- tối ưu compression;

thì:

```text
same MediaAsset
new MediaAssetVersion
```

Không tạo HeroRevision/gameplay change chỉ vì quality upgrade.

### 12.5 Artwork thay đổi semantic

Nếu game thay artwork chính thức/crop có ý nghĩa hiển thị khác:

```text
new MediaAsset
new MediaBindingRevision khi binding thay đổi
```

Nếu thay đổi là một phần của patch chính thức thì có thể có visual patch change tương ứng.

### 12.6 Reverse media usage

Phải truy được asset đang được dùng ở đâu.

Usage scope tối thiểu:

```text
CURRENT
DRAFT
HISTORICAL
```

Source of truth vẫn thuộc module sử dụng asset; media usage index chỉ là projection/index phục vụ tra cứu nếu được xây.

### 12.7 Deletion policy

Không hard-delete asset đang được current/historical revision tham chiếu một cách tùy tiện.

Ưu tiên lifecycle:

```text
ACTIVE       dùng bình thường, nhận version mới, được bind
DEPRECATED   giữ cho lịch sử, không được bind mới
BLOCKED      rút xuống (ví dụ lý do pháp lý), không được phục vụ/bind
```

và retention phù hợp với lịch sử.

### 12.8 Trạng thái version và version đang dùng

- `MediaAssetVersion.state`: `READY` (đã kiểm tra, nằm ở key bất biến), `DEPRECATED`, `BLOCKED`.
- Version **đang được phục vụ** là `MediaAsset.currentVersionId`; không có trạng thái `ACTIVE` riêng cho version.
- Version đầu tiên của asset được activate tự động; các version sau phải activate tường minh (03 mục 33), để bản upload mới không âm thầm thay ảnh đang hiển thị.
- Cùng bytes (cùng SHA-256) upload lại vào cùng asset → trả version đã có, không tạo version mới.
- Asset chỉ được module khác bind khi `ACTIVE` và đã có `currentVersionId` (`MediaAssetReference.usable()`).

---

## 13. Object storage

### 13.1 Nguyên tắc

PostgreSQL lưu metadata và reference.

Object storage lưu bytes.

Không lưu artwork lớn trực tiếp trong bảng hero/item bằng BYTEA.

### 13.2 Abstraction

Domain/application chỉ biết port:

```text
ObjectStorage
```

Adapter duy nhất:

```text
S3ObjectStorage   (AWS SDK for Java 2.x: S3Client, S3Presigner)
```

Mọi môi trường dùng cùng adapter qua API chuẩn S3; chỉ khác cấu hình `wiki.storage.*` (ADR-006):

| Môi trường | Storage | Ghi chú |
|---|---|---|
| `local` | SeaweedFS (`compose.yaml`) | `http://localhost:8333`, path-style; credential trong `infra/local/seaweedfs/s3.json` |
| `test` | SeaweedFS (Testcontainers) | Image pin version |
| `prod` | Dịch vụ S3-compatible, dự kiến Cloudflare R2 | Chốt khi deploy |

```yaml
wiki:
  storage:
    endpoint: ${STORAGE_ENDPOINT}          # local: http://localhost:8333
    region: ${STORAGE_REGION:us-east-1}
    bucket: ${STORAGE_BUCKET:wiki-media}
    path-style-access: ${STORAGE_PATH_STYLE:true}
    access-key: ${STORAGE_ACCESS_KEY}
    secret-key: ${STORAGE_SECRET_KEY}
    create-bucket-if-missing: false      # local: true
```

Quy tắc:

- không dùng SDK riêng của nhà cung cấp (MinIO SDK…); chỉ AWS SDK v2;
- chỉ dùng thao tác S3 cơ bản: `PutObject`, `HeadObject`, `GetObject`, `CopyObject`, `DeleteObject`, presigned `PUT`/`GET`;
- không dựa vào bucket versioning, object lock, event notification; version media do `MediaAssetVersion` và object key quản lý;
- image MinIO đã bị gỡ khỏi Docker Hub (09/2026) nên local/test dùng SeaweedFS; đổi storage chỉ cần đổi cấu hình;
- backup object storage là bắt buộc (`02-DATABASE-DU-AN.md` mục 41).

### 13.3 Object key

Database lưu `objectKey`, không lưu URL môi trường cụ thể như `http://localhost:8333/...`.

Object key/version phải hỗ trợ immutable delivery. Bố cục bucket:

```text
incoming/{uploadId}                   upload trực tiếp đang chờ kiểm tra, không bao giờ public
imports/...                           object do công cụ import đặt sẵn, không public
assets/{assetId}/{versionId}.{ext}    bytes đã kiểm tra, bất biến
```

- URL public: `/media/{assetId}/{versionId}.{ext}`; reverse proxy/CDN map `/media/` vào prefix `assets/` (mục 3.4). Prefix cấu hình bằng `wiki.media.public-base-url`.
- Khi copy sang `assets/`, backend ghi lại `Content-Type` theo định dạng đã xác minh và `Cache-Control: public, max-age=31536000, immutable`.
- Object `incoming/` được xóa sau khi upload thành công; object còn sót (upload bỏ dở, bị từ chối) dọn bằng **lifecycle rule của bucket** (ví dụ xóa `incoming/` sau 1 ngày), không viết job riêng.

### 13.4 Upload flow

Bytes không đi qua Spring Boot; backend chỉ cấp quyền và kiểm tra:

```text
request upload
 -> backend tạo upload session REQUESTED + presigned PUT vào incoming/{uploadId}
 -> caller upload trực tiếp object storage
 -> complete upload
 -> backend: stat -> đọc header + SHA-256 (stream) -> tìm bytes trùng -> copy sang assets/
 -> một transaction ngắn: đánh số version, MediaAssetVersion READY, đóng session, audit
```

Upload thành công ở object storage không đồng nghĩa media version đã READY.

- Không giữ transaction trong lúc gọi object storage (mục 19.2). Session chuyển `REQUESTED → VALIDATING` trong transaction riêng để hai request complete cùng lúc không cùng chạy (optimistic lock).
- Lỗi tạm thời (chưa upload xong, storage lỗi) đưa session về `REQUESTED` để thử lại; bytes không hợp lệ → `REJECTED` vĩnh viễn; quá hạn → `EXPIRED`.
- Complete gọi lại sau khi đã thành công trả đúng version cũ (an toàn khi mất response).
- Import hàng loạt: công cụ đặt file vào `imports/`, gọi `register` (03 mục 34); bytes được kiểm tra như upload, chạy lại import không tạo trùng.

### 13.5 Chính sách media

| Quy tắc | Giá trị mặc định (`wiki.media.*`) |
|---|---|
| Định dạng | PNG, JPEG, WebP (nhận diện bằng chữ ký file, không tin `Content-Type` client gửi) |
| Dung lượng tối đa | `max-upload-size: 25MB` |
| Số pixel tối đa | `max-pixels: 40000000` |
| Cạnh dài tối đa | `max-dimension: 16384` |
| Hiệu lực URL upload | `upload-url-validity: 15m` |
| Hạn complete | `upload-session-validity: 1h` |

- Backend **chỉ đọc header** để lấy định dạng và kích thước, không decode pixel: bộ nhớ không phụ thuộc kích thước ảnh, ảnh "bom giải nén" bị chặn từ header, và không cần thư viện ngoài (Java không tự đọc được WebP). Đổi lại, file JPEG hỏng phần dữ liệu ảnh có thể lọt qua; PNG/WebP bị cắt cụt vẫn bị phát hiện (trailer `IEND`, kích thước RIFF).
- Chưa có AVIF/GIF/SVG. SVG cố ý không nhận (có thể chứa script).
- Chưa tạo rendition (thumbnail/resize); phục vụ ảnh gốc. Rendition để Phase 6 khi có nhu cầu thật.

---

## 14. Cache specification ở backend

Cache không được dùng để che một domain model không có version/revision rõ ràng.

### 14.1 Immutable revision resources

Các resource address bằng immutable ID có thể cache lâu:

```text
StatsRevision S9
SkillsRevision K14
MediaAssetVersion AV25
```

Nếu nội dung thay đổi phải tạo ID/version mới, không sửa bytes/data sau lưng cache.

### 14.2 Current/resolver resources

Các endpoint kiểu:

```text
current hero
current patch for region
current media asset version
```

là mutable resolver và cần:

- cache ngắn;
- ETag/revalidation;
- invalidation sau publish/activate/release khi có application cache.

### 14.3 HTTP cache

Public GET có thể dùng:

- `ETag`;
- `Cache-Control`;
- conditional request;
- `304 Not Modified`.

### 14.4 Backend application cache

Ban đầu không bắt buộc Redis.

Có thể dùng:

- không cache application-level nếu PostgreSQL đủ nhanh;
- Caffeine khi một instance và profiling chứng minh cần;
- Redis khi nhiều instance cần shared cache và lợi ích đủ lớn.

### 14.5 Media cache

Media URL phải version/hash-based để bytes không bị overwrite dưới cùng URL.

Ví dụ:

```text
/media/A20/AV24.webp
/media/A20/AV25.webp
```

Version-addressed media có thể cache rất lâu ở CDN/browser layer.

---

## 15. Backend module architecture

### 15.1 Modules

Root package dự kiến:

```text
com.wikiaov
├── hero
├── media
├── patch
├── item
├── arcana
├── spell
├── enchantment
├── gamemode
├── query
├── user
├── access
└── platform
```

### 15.2 Ownership

Mỗi module sở hữu:

- domain model;
- Entity;
- Repository;
- application use cases;
- internal web adapter;
- migration liên quan (logical ownership dù Flyway chạy tập trung).

Không tạo `common-entity` cho nhiều domain.

### 15.3 Cross-module dependency

Cho phép:

```text
hero -> MediaQueries
hero -> PatchQueries
patch composition -> HeroPatchChangeQueries
```

Không cho phép:

```text
hero -> MediaRepository
patch -> HeroRepository
item -> HeroEntity
```

Cross-module dùng public interface/DTO/read contract.

### 15.4 Platform module

`platform` chỉ chứa concern kỹ thuật thật sự dùng chung:

- ProblemDetail/error representation;
- correlation/request ID;
- common configuration infrastructure;
- technical utility hạn chế.

Không chứa domain Entity hoặc business enum chỉ để tránh ownership.

---

## 16. Cấu trúc repository backend

```text
backend/wiki-service/
├── pom.xml
├── mvnw
├── mvnw.cmd
├── .mvn/
├── .gitignore
├── .env.example
├── compose.yaml            dependency local: postgres, seaweedfs, redis, keycloak
├── config/format/          eclipse-formatter.xml dùng chung Maven và hook
├── infra/local/            realm Keycloak và cấu hình SeaweedFS
│
├── scripts/
│   ├── dev/                launcher local và kiểm tra môi trường
│   ├── sync-user-roles.ps1
│   └── publish-arcana-baseline.ps1
│
└── src/
    ├── main/
    │   ├── java/com/wikiaov/
    │   │   ├── WikiAovApplication.java
    │   │   ├── hero/
    │   │   ├── media/
    │   │   ├── patch/
    │   │   ├── item/
    │   │   ├── arcana/
    │   │   ├── spell/
    │   │   ├── enchantment/
    │   │   ├── gamemode/
    │   │   ├── query/
    │   │   ├── user/
    │   │   ├── access/
    │   │   └── platform/
    │   │
    │   └── resources/
    │       ├── config/
    │       │   ├── application.yml
    │       │   ├── application-local.yml
    │       │   ├── application-prod.yml
    │       │   └── application-test.yml
    │       └── db/migration/
    │
    └── test/
        └── java/com/wikiaov/
            ├── architecture/
            ├── hero/
            ├── media/
            ├── patch/
            └── ...
```

Tài liệu không nằm trong thư mục service mà ở `backend/docs/` (mục 3.9).

Ban đầu dùng một Maven project và một deployable JAR.

Không tách Maven module chỉ để mô phỏng microservice nếu chưa có nhu cầu build boundary rõ ràng.

---

## 17. Cấu trúc package trong một module

Ví dụ `hero`:

```text
hero/
├── HeroQueries.java
├── HeroPatchChangeQueries.java
├── HeroMediaReferenceQueries.java
│
└── internal/
    ├── web/
    ├── application/
    ├── domain/
    ├── persistence/
    └── infrastructure/
```

Thư mục con (module `media` là mẫu):

```text
internal/
├── web/
│   ├── XxxAdminController.java
│   └── request/          body của request (record + Bean Validation)
├── application/
│   ├── service/          use case và lớp xử lý dùng chung (@PreAuthorize, transaction)
│   ├── port/             interface do infrastructure implement (ví dụ ObjectStorage)
│   └── response/         record use case trả về, controller trả thẳng ra JSON
├── domain/               Java thuần: quy tắc, enum, value object (chia thư mục con theo chủ đề)
├── persistence/
│   ├── XxxRepository.java   Spring Data repository
│   └── entity/           JPA entity (@Entity)
└── infrastructure/       cấu hình, adapter (S3, ...)
```

Quy tắc dependency nội bộ:

```text
web -> application
application -> domain, persistence (repository + entity), application/port
persistence/entity -> domain (enum, value object)
infrastructure -> application/port, config
```

- Domain không phụ thuộc JPA, Spring MVC hay AWS SDK.
- JPA entity nằm ở `persistence/entity` và vẫn giữ hành vi bảo vệ bất biến (ví dụ `MediaAsset.activate`); không expose entity ra API mà map sang record trong `application/response`.
- Request record chỉ có ở tầng web; use case nhận `Command` của chính nó.

---

## 18. Application use cases chính

### 18.1 Hero

```text
CreateHero
CreateHeroDraft
UpdateHeroProfileDraft
UpdateHeroOverviewDraft
UpdateHeroStatsDraft
UpdateHeroSkillsDraft
UpdateHeroSkinsDraft
UpdateHeroMediaBindingsDraft
PublishHero
DiscardHeroDraft
CreateContentCorrection
GetCurrentHero
GetHeroHistory
```

### 18.2 Media

```text
CreateMediaAsset
RequestMediaUpload
CompleteMediaUpload
RegisterExistingObject
ActivateMediaAssetVersion
DeprecateMediaAsset
FindMediaUsages
```

### 18.3 Patch

```text
CreateGamePatch
CreatePatchVariant
RecordHeroPatchChange
RecordItemPatchChange
RecordArcanaPatchChange
PublishPatchVariantMetadata
SchedulePatchRelease
ResolveEffectivePatch
```

### 18.4 Catalog domains khác

Item/Arcana/Spell/Enchantment áp dụng pattern tương tự:

- stable identity;
- revision;
- publication;
- patch change;
- localized data khi cần.

---

## 19. Transaction boundaries

### 19.1 Transaction nên bao gồm

Một use case publish có thể gồm:

- khóa/kiểm tra current state;
- validate expected version;
- chuyển draft state;
- cập nhật composition/current pointer;
- cập nhật publication version;
- ghi audit;
- commit atomically.

### 19.2 Transaction không nên giữ trong lúc gọi external I/O dài

Không giữ transaction database mở khi:

- upload file lớn;
- gọi object storage kéo dài;
- crawl web;
- gọi AI/OCR/video processing;
- gọi HTTP external không cần atomic DB lock.

Các workflow đó cần chia stage/status rõ ràng.

---

## 20. Security specification

### 20.1 Authentication

API quản trị dùng JWT Resource Server.

Backend xác minh tối thiểu:

- signature;
- issuer;
- audience;
- expiration;
- subject.

### 20.2 Authorization

Quyền nên theo capability, ví dụ:

```text
catalog:read
hero:write
hero:publish
media:write
patch:write
patch:publish
```

Không chỉ dựa vào UI hoặc một role string duy nhất.

### 20.3 Actor identity

Audit actor được định danh bởi:

```text
issuer + subject
```

Không tin actor ID do client gửi trong request body.

### 20.4 Vai trò (actor) và ánh xạ quyền

Backend chỉ kiểm tra **capability**. Vai trò là role tổng hợp (composite) trên identity provider; Keycloak bung vai trò thành client role của `wiki-service` trong token (`resource_access.wiki-service.roles`).

| Capability | Editor | Publisher | Patch manager | Admin | Importer |
|---|:-:|:-:|:-:|:-:|:-:|
| `catalog:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `<domain>:write`, `media:write` | ✓ | ✓ | | ✓ | ✓ |
| `<domain>:publish` | | ✓ | | ✓ | ✓ |
| `patch:write`, `patch:publish` | | | ✓ | ✓ | |
| `region:admin` | | | | ✓ | |

Realm local: `backend/wiki-service/infra/local/keycloak/wikiaov-realm.json`. Danh sách capability trong code: `com.wikiaov.access.Capabilities`.

Kiểm tra quyền theo ba lớp:

1. **URL** (`SecurityFilterChain`): GET public mở; `/api/wiki/v1/admin/**` cần `catalog:read`; còn lại từ chối.
2. **Use case**: `@PreAuthorize("hasAuthority('<capability>')")` trên từng application service.
3. **Domain policy**: luật phụ thuộc dữ liệu (ví dụ không tự duyệt draft của mình), ném `ApplicationException` với `ErrorKind.FORBIDDEN`.

Use case lấy người gọi qua port `CurrentActor`, không phụ thuộc trực tiếp Spring Security. Token client credentials (có claim `client_id`) là actor loại `SERVICE`.

### 20.5 Secrets

Không commit:

- JWT secrets/private keys;
- database password;
- S3 storage credential;
- production token;
- cookie/session secret.

---

## 21. Error specification

Error backend phải có `code` ổn định.

Ví dụ:

```json
{
  "status": 409,
  "code": "HERO_REVISION_VERSION_CONFLICT",
  "title": "Revision version conflict",
  "detail": "The draft has changed.",
  "context": {
    "currentVersion": 9
  }
}
```

Quy tắc:

- `code` là machine-readable contract;
- `detail/message` là fallback/debug information;
- business logic không so sánh chuỗi message;
- validation có thể có `errors[]` với `path`, `code`, `message`;
- response không lộ SQL, stack trace, secret hoặc internal path;
- mỗi module sở hữu enum mã lỗi riêng implement `ApiErrorCode`; mã duy nhất toàn hệ thống (có test kiểm tra);
- mọi lỗi, kể cả 401/403 từ security filter và lỗi đi qua `/error`, dùng chung `ProblemDetails` và `Cache-Control: no-store`.

Hình dạng đầy đủ, danh sách mã và cách khai báo: `03-API-DU-AN.md` phần G.

Backend có thể dùng một ngôn ngữ fallback nhất quán cho detail. Không cần duplicate toàn bộ localization UI ở backend chỉ để hiển thị message.

---

## 22. Observability

### 22.1 Logging

Log structured JSON ra stdout.

Các field hữu ích:

```text
requestId
traceId
module
operation
actorSubject
entityId
revisionId
errorCode
```

Không log token/password/cookie/secret.

### 22.2 Metrics

Theo dõi tối thiểu:

- HTTP latency/error rate;
- JVM;
- DB connection pool;
- publish failures;
- media validation failures;
- background/import job failures nếu có.

Không dùng entity ID làm metric label cardinality cao.

### 22.3 Tracing

Tracing trở nên quan trọng hơn khi có external call hoặc nhiều deployable service. Chuẩn bị correlation context từ sớm nhưng không cần dựng distributed tracing phức tạp trước khi có nhu cầu.

---

## 23. Testing strategy

### 23.1 Unit test

Dùng cho:

- domain rules;
- publish eligibility;
- change classification;
- locale/ruleset resolution logic;
- value object validation.

### 23.2 Integration test

Dùng PostgreSQL thật qua Testcontainers cho:

- migration;
- unique/foreign key;
- transaction;
- locking;
- repository query;
- concurrent edit/publish.

### 23.3 Architecture test

Kiểm tra module boundaries, ví dụ bằng Spring Modulith/ArchUnit phù hợp.

### 23.4 Acceptance test naming

Không dùng toàn dự án chỉ `AT-01`, `AT-02`.

Nên namespace:

```text
AT-HERO-DRAFT-001
AT-HERO-PUBLISH-001
AT-MEDIA-UPLOAD-001
AT-MEDIA-VERSION-001
AT-PATCH-CHANGE-001
AT-PATCH-RELEASE-001
```

---

## 24. Local development

Môi trường local tối thiểu:

```text
Spring Boot
PostgreSQL
SeaweedFS  (object storage S3-compatible)
Keycloak   (khi bật admin API)
```

`compose.yaml` trong `backend/wiki-service/` chạy dependency local (Spring Boot Docker Compose support tự khởi động khi chạy app ở local). Topology đầy đủ xem mục 3.4 và 3.10.

Application config trong `src/main/resources/config/` chia theo environment:

```text
application.yml
application-local.yml
application-prod.yml
application-test.yml
```

Production không phụ thuộc credential hard-code của local.

---

## 25. Migration và schema ownership

Flyway là source of truth cho schema migration.

Hibernate không tự thay đổi schema ở môi trường dùng chung.

Migration phải phản ánh ownership module dù chạy trong một database/app.

Chi tiết schema, table, constraint, index, lock và migration convention nằm trong `02-DATABASE-DU-AN.md`.

---

## 26. Quy tắc mở rộng sang service riêng sau này

Một module chỉ nên được tách thành deployable service khi xuất hiện lý do thật, ví dụ:

- scale độc lập;
- resource profile rất khác;
- fault isolation;
- security boundary;
- ownership/team độc lập;
- deployment cadence khác biệt;
- workload async/nặng như video/OCR/import.

Tách service không chỉ là chuyển package sang repository khác. Phải giải quyết:

- data ownership;
- API/event contract;
- timeout;
- retry;
- authentication;
- observability;
- migration;
- consistency.

Worker xử lý media/video/import có khả năng là ứng viên tách trước các catalog nhỏ như arcana/spell.

---

## 27. Thứ tự triển khai backend đề xuất

### Phase 1 — nền tảng

- Spring Boot project;
- module boundaries;
- PostgreSQL;
- Flyway;
- common error representation;
- JWT Resource Server skeleton;
- logging/requestId;
- Object storage local (SeaweedFS).

### Phase 2 — Media foundation

- `ObjectStorage` port + `S3ObjectStorage` (AWS SDK for Java 2.x);
- MediaAsset;
- MediaAssetVersion;
- upload/register object;
- validation;
- activation;
- reverse usage contract (`MediaUsageProvider`), usage lookup và deprecate.

Đã triển khai (migration `V002`, API 03 phần E). `media_rendition` và `media_usage_index` chưa tạo: chưa có nhu cầu.

### Phase 3 — Hero vertical slice

- Hero identity;
- section revisions;
- draft/publication;
- three media bindings;
- public/admin queries;
- audit;
- history.

### Phase 4 — Patch model

- GamePatch;
- PatchVariant;
- Ruleset;
- Region assignment;
- PatchRelease;
- HeroPatchChange.

### Phase 5 — Catalog expansion

- Item;
- Arcana;
- Spell;
- Enchantment;
- GameMode.

### Phase 6 — optimization/operations

Chỉ sau profiling/nhu cầu:

- HTTP cache tinh chỉnh;
- Caffeine/Redis;
- background worker;
- container orchestration;
- service split.

### Phase 7 — ngoài `wiki-service`

- `community-service`: cộng đồng, giải đấu, livestream (mục 3.1–3.8);
- dùng chung identity provider và reverse proxy đã dựng cho wiki.

---

## 28. Những nguyên tắc không được phá khi triển khai

1. Không dùng localized name làm identity.
2. Không coi region và locale là cùng khái niệm.
3. Không duplicate gameplay theo region nếu chỉ khác release time/language.
4. Không coi mọi Wiki revision là gameplay patch change.
5. Không coi media quality upgrade là Hero gameplay/content change.
6. Không sửa published immutable section sau lưng revision ID.
7. Không overwrite media bytes dưới URL/version đã coi là immutable.
8. Không cho module khác dùng trực tiếp repository/entity nội bộ.
9. Không dùng `common-entity` để phá ownership.
10. Không hard-delete lịch sử chỉ để database nhỏ hơn mà chưa có retention policy.
11. Không để client gửi actor identity và tin trực tiếp.
12. Không dùng error message text làm logic key.
13. Không thêm Redis/Kafka/Kubernetes chỉ vì kiến trúc mẫu có chúng.
14. Không giữ DB transaction mở trong external I/O dài.
15. Không tạo một bảng JSON change chung cho mọi domain khi semantics khác nhau rõ ràng.
16. Không để service khác đọc trực tiếp database của `wiki-service`; giao tiếp qua public API.
17. Không public object storage ngoài prefix media đã READY; object đang upload không bao giờ có URL public.

---

## 29. Quan hệ giữa 3 tài liệu canonical

### `01-BAN-DAC-TA-DU-AN.md`

Trả lời:

> Backend WikiAOV là gì, có những domain/use case nào và phải vận hành theo những nguyên tắc nào?

### `02-DATABASE-DU-AN.md`

Trả lời:

> Các khái niệm trên được lưu bằng bảng/quan hệ/constraint/index/transaction data rule như thế nào?

### `03-API-DU-AN.md`

Trả lời:

> Các use case/read model trên được expose qua HTTP như thế nào?

Không tạo thêm một bộ docs version song song. Git history và quyết định thay thế trong commit/ADR khi cần chịu trách nhiệm lưu lịch sử thiết kế.

---

## 30. Thuật ngữ

Phần này chỉ dùng để tra cứu sau khi đã hiểu hệ thống.

### ADR

**Architecture Decision Record** — bản ghi một quyết định kiến trúc/domain, lý do, context và trade-off.

### FR

**Functional Requirement** — yêu cầu chức năng hệ thống phải đáp ứng.

### BR

**Business Rule** — invariant/quy tắc nghiệp vụ phải đúng bất kể implementation.

### AT

**Acceptance Test** — ca kiểm thử nghiệm thu chứng minh requirement/rule hoạt động đúng.

### `code`

Mã ổn định, dễ đọc của domain object.

Ví dụ:

```text
hero.id   = UUID
hero.code = nakroth
```

`code` không thay thế UUID foreign key chính và không phải localized display name.

### issuer

Hệ thống đã phát identity/token.

Ví dụ:

```text
https://auth.example
```

### subject

ID của principal/user trong issuer đó.

Identity audit đầy đủ dùng:

```text
(issuer, subject)
```

### Revision

Một version semantic/content được giữ lịch sử thay vì sửa trực tiếp bản đã publish.

### Section Revision

Revision độc lập của một phần trong Hero composition, ví dụ StatsRevision hoặc SkillsRevision.

### MediaAsset

Logical/semantic asset, độc lập file bytes cụ thể.

### MediaAssetVersion

Một version source bytes cụ thể của MediaAsset.

### MediaRendition

Derivative/resized/converted output của một media source version.

### GamePatch

Identity của một bản cập nhật game.

### PatchVariant

Biến thể gameplay của GamePatch cho một ruleset cụ thể.

### GameplayRuleset

Bộ luật/data gameplay dùng chung bởi một hoặc nhiều region.

### PatchRelease

Việc một PatchVariant có hiệu lực tại một region và thời điểm cụ thể.

### Region

Phạm vi thị trường/server/phát hành.

### Locale

Ngôn ngữ/cách biểu diễn nội dung.

### Current pointer

Reference tới revision/version đang được coi là hiện hành trong một context; current pointer là mutable, revision target nên immutable sau publish.

---

## 31. Tiêu chí để coi backend specification được triển khai đúng

Một implementation được xem là đi đúng đặc tả khi tối thiểu:

- module ownership được kiểm soát;
- database có migration tái lập được;
- Hero hỗ trợ section-based revision composition;
- three hero media roles hoạt động;
- media quality upgrade không làm gameplay history sai;
- patch hỗ trợ multi-domain changes;
- region rollout không duplicate gameplay không cần thiết;
- locale độc lập region;
- draft/publication có concurrency control;
- audit actor đáng tin cậy;
- error có stable code;
- object storage được abstract khỏi Hero/Item domain;
- public historical/current read không trộn draft;
- cache semantics không phụ thuộc việc overwrite immutable resource;
- integration/architecture/acceptance test bao phủ các invariant quan trọng.


## Bổ sung: chuẩn hóa Hero và import theo trường nghiệp vụ

Phạm vi triển khai ưu tiên Hero; chưa mở rộng Item/Arcana/Spell/Enchantment. Admin tách cấu hình game và thư viện ảnh khỏi Sổ nhân vật. Lưu trữ JSON cũ không còn trong menu; giữ file và đường dẫn để chuyển dữ liệu, không tự xóa.

Hero identity/revision được chuyển sang JPA repository, giữ khóa ghi theo Hero và expectedVersion. Sáu section snapshot đã dùng JPA; truy vấn lịch sử và phân giải ngữ cảnh chuyên biệt vẫn giữ SQL; không coi việc đổi persistence là thay đổi quy tắc publish.

Import JSON/CSV ánh xạ mã tướng vào UUID hiện hữu; backend cung cấp danh mục trường cho phép. Luồng preview không ghi dữ liệu; apply kiểm tra revision/version và ghi draft trong một transaction cho mỗi tướng. Chính sách theo trường gồm bổ sung chỗ trống, ghi đè và bỏ qua. Ô trống không xóa nội dung. Mảng kỹ năng/trang phục hiện thay cả danh sách khi ghi đè; không tự suy diễn merge. Không tự publish. Các trường chưa hỗ trợ không được tạo mới.

Mùa xếp hạng thuộc thị trường, có mã ổn định, tên hiển thị, khoảng thời gian [startsAt, endsAt), năm/số mùa tùy chọn. Mùa không thay thế patch/ruleset; một mùa chứa nhiều release. Không suy ra rulesetOrdinal từ tên mùa.

Upload ảnh trong biểu mẫu tái sử dụng Media API. Link HTTPS có thể tải trực tiếp từ trình duyệt khi nguồn cho CORS; không gửi credential API tới nguồn ảnh. Nguồn chặn CORS phải dùng file local ở giai đoạn này. Worker nhập URL chưa được triển khai, không mở API proxy tải URL tùy ý.

## Nhập liệu theo mốc đã biết và patch

Luồng admin: thị trường → mùa → patch/release → chọn loại nhập → ánh xạ → duyệt → lưu draft. Tạo tướng mới và import bắt buộc có release thuộc mùa đã khai báo; ruleset phải khớp release. Không suy ra thời điểm game cập nhật từ ngày nhập dữ liệu.

- BASELINE: snapshot độc lập tại patch được chọn, cause DATA_BASELINE. Không kế thừa snapshot mới hơn hoặc tự tạo changelog. Có thể bổ sung mốc lịch sử của tướng đã tồn tại; các section chưa biết để trống trong draft và phải hoàn thiện trước publish.
- PATCH_UPDATE: so sánh với snapshot đã publish gần nhất trước patch đích, hoặc tiếp tục draft GAME_PATCH đúng patch. Không có mốc trước thì INSUFFICIENT_DATA, không cho apply; hướng dẫn dùng BASELINE. Khác biệt giữa hai mốc không tự chứng minh thay đổi thuộc patch nào; changelog vẫn phải biên tập và kiểm chứng riêng.
- CORRECTION: chỉ sửa snapshot tại đúng patch đích, cause IMPORT_CORRECTION; không tạo sự kiện thay đổi game.
- Nếu đã có draft thuộc patch/loại nhập khác trong cùng ruleset, yêu cầu hoàn tất hoặc bỏ draft đó; không âm thầm chuyển ngữ cảnh.
- Baseline mới luôn có effectiveFromPatchVariantId. Dữ liệu legacy có mốc null được giữ nguyên, nhưng không dùng làm mốc so sánh cho luồng import mới vì chưa biết thời điểm quan sát.
- Mốc quá khứ bổ sung không ghi lại các snapshot về sau. Mốc tương lai chưa được chọn làm dữ liệu hiện tại trước lịch rollout. Tướng chưa có trong kho không đồng nghĩa mới ra mắt.
- Khi cần chèn patch quá khứ vào chuỗi đã có, chọn beforeVariantId cùng ruleset. Backend khóa ruleset và dịch thứ tự các variant sau, giữ nguyên ID và thứ tự tương đối; lịch release vẫn phải phù hợp thời gian. Không tự sửa lịch đã khai báo.


### Import tướng chạy nền

Tác vụ import được lưu ở backend sau bước xác nhận. Người dùng có thể đóng hoặc tải lại web và xem lại tiến trình bằng cùng tài khoản. Mỗi tướng có kết quả riêng; lỗi một tướng không hủy các tướng đã lưu. Backend tiếp tục tác vụ chưa hoàn tất sau khi khởi động lại. Chuẩn bị file và upload ảnh vẫn diễn ra trước khi gửi tác vụ. Xem ADR-009-DURABLE-HERO-IMPORT.md.

## Tổng quan phát hành và tiến độ dịch trong admin

Trang phiên bản hiển thị ruleset theo thị trường, mùa hiện tại và patch đang áp dụng; lịch gán ruleset giữ riêng để xem cả quá khứ/tương lai. Mùa hiện tại tính theo khoảng [startsAt, endsAt). Patch hiện tại yêu cầu thị trường/ruleset active, assignment đang hiệu lực, patch và variant PUBLISHED, release SCHEDULED và effectiveAt không ở tương lai. Không lấy patch nháp hoặc patch tương lai làm hiện tại.

Mùa mở rộng thành các release; patch mở bảng thay đổi được ghi nhận rõ ràng. Giai đoạn này provider thay đổi chỉ có Hero; chưa giả lập dữ liệu Item hoặc quái. Import DATA_BASELINE không tạo changelog.

Danh mục tướng dùng mùa/patch để lọc các thay đổi gameplay đã được biên tập trong hero_patch_change_set. Chọn mùa chỉ trả các tướng có change set thuộc patch của mùa đó; chọn thêm patch thu hẹp đúng patch, không kéo các tướng không đổi từ mốc trước vào kết quả. Một mùa có thể vừa tăng sức mạnh ở patch trước vừa giảm ở patch sau: giữ tất cả change set trong phạm vi để giao diện tổng hợp đúng loại thay đổi. Không chọn mùa/patch thì trả toàn bộ tướng, kèm change set gần nhất theo thứ tự gameplay cho từng ruleset nếu có. DATA_BASELINE, import, bản dịch, hiệu chỉnh hoặc draft GAME_PATCH không tự trở thành gameplay change; không suy đoán BUFF/NERF từ số liệu. Các phiên bản ruleset khác nhau hiển thị riêng. Icon thị trường chỉ biểu thị bản đã xuất bản đang được áp dụng thực tế; bản nháp không được gắn nhãn đang áp dụng.

Tìm mã hoặc tên được thực hiện ở backend trước phân trang; khi không lọc mùa/patch, tên lấy từ snapshot chưa bị hủy mới nhất của từng ruleset theo thứ tự gameplay rồi số revision, nhận cả các bản dịch đã có. Khi lọc mùa/patch, tên lấy từ đích của change set mới nhất trong phạm vi, không dùng tên của patch khác. Tạo bổ sung snapshot lịch sử sau này không làm tên cũ thay tên ở patch mới hơn. Tìm mã cho phép khoảng trắng thay dấu gạch nối, không thêm cơ chế suy đoán ngôn ngữ hoặc bỏ dấu. Lần sửa gần nhất lấy từ timestamp thực lưu: lớn nhất của hero.created_at và hero_revision.updated_at của tướng, gồm tạo, import, bản dịch và hủy nháp. Không dùng ngày patch, published_at hay thời điểm đọc để giả làm ngày sửa. Có thể sắp xếp theo mã hoặc ngày sửa giảm dần, giữ thứ tự mã/UUID khi bằng nhau.

Ngôn ngữ đọc theo locale hồ sơ người dùng, dự phòng vi-VN rồi bản có sẵn, có nhãn dự phòng. Ngôn ngữ nhập vẫn được chọn trong tạo/sửa/import. Tiến độ dịch dựa trên trường bắt buộc và trường tùy chọn đã có nội dung ở bất kỳ ngôn ngữ nào của cùng snapshot, gồm profile/kỹ năng/trang phục; mẫu số là bộ ngôn ngữ hỗ trợ của admin. Đủ nội dung không đồng nghĩa đã duyệt hoặc đã kiểm chứng nguồn; chưa triển khai workflow duyệt/stale translation trong đợt này.


## Mùa dùng chung và lịch thị trường (16/10/2026)

Quyết định này thay thế mô hình mùa thuộc region trong các mục bổ sung trước.
Mùa là danh mục chung, có mã, tên, năm/số mùa tùy chọn và ordinal. Ngày tạo, tên mã,
ngôn ngữ không quyết định thứ tự. Khi tạo có thể chèn trước một mùa hoặc nối cuối.
Patch variant gắn trực tiếp season_id; tạo patch theo mùa đồng thời tạo game_patch và
variant trong một transaction. Backend đặt ordinal xuyên suốt ruleset, chèn trước patch
trong cùng mùa hoặc cuối mùa (trước patch đầu mùa sau). Không sửa snapshot đã nhập.

Lịch mùa chuyển sang season_schedule (season_id, region_id, starts_at, ends_at), unique
mùa/thị trường và không chồng khoảng theo thị trường. Một mùa có nhiều lịch. Patch release
vẫn là ngày áp dụng theo thị trường, phải nằm trong lịch mùa của patch, đúng ruleset được
thị trường sử dụng, không đảo thứ tự gameplay. Mùa/patch chưa có lịch vẫn hiện ở admin.
Current tính theo thời gian server và thị trường, không theo ngày tạo hay ordinal lớn nhất.

V012 giữ ID và dữ liệu lịch cũ; mùa cũ khác ID không tự gộp khi chưa xác minh tương đương.
Mã mùa cũ bị trùng được thêm UUID để bảo toàn; variant chỉ tự gắn mùa nếu các release
của nó cùng một mùa. Trường hợp chưa rõ nằm ở nhóm patch cũ chưa gắn mùa.
Ruleset aov-vn đổi mã thành aov-standard, giữ ID; nếu cả hai mã tồn tại thì migration
báo xung đột và rollback, không tự gộp dữ liệu.

API: GET admin/seasons không cần regionId; POST nhận code, displayName, seasonYear?,
seasonNumber?, beforeSeasonId?. POST admin/seasons/{id}/schedules nhận regionId,
startsAt, endsAt. POST admin/season-patches nhận seasonId, rulesetId, beforeVariantId?,
patch:{code,translations:[{locale,title,summary,description?}]}, trả id của variant.
Quyền tạo mùa/patch/lịch mùa là patch:write, phát hành patch vẫn cần patch:publish.
Publication overview trả seasons chung, seasonSchedules riêng và variants.seasonId.

Nhập/tạo tướng chọn mùa và patch, không bắt chọn thị trường hay lịch phát hành.
GET admin/heroes/import/contexts?seasonId= trả context của variant DRAFT/PUBLISHED.
Request dùng contextId; alias releaseId và lookup lịch cũ được giữ cho job đã nhận trước
nâng cấp. Context mới có regionId/regionCode/effectiveAt null. Dữ liệu có thể soạn trước
khi phát hành; publish tướng vẫn yêu cầu variant đã publish. BASELINE vẫn chỉ là trạng thái
quan sát, không tự tạo lịch sử thay đổi. API contexts có regionId vẫn phục vụ client cũ.


## Độ chính xác ngày/giờ lịch phát hành (16/10/2026)

V013 giữ nguyên timestamp cũ. Release mới nhận đúng một trong effectiveAt (ISO instant)
và effectiveOn (YYYY-MM-DD). Ngày không có giờ được lưu DATE, effective_at null, status DRAFT;
không tự áp dụng vào nửa đêm. POST admin/patch-releases/{id}/confirm (patch:publish) xác nhận
đang áp dụng ở thời điểm server, chỉ khi ngày đã tới, đúng ruleset/lịch mùa và không đảo thứ tự.
Ghi confirmed_at và mốc kích hoạt nội bộ effective_at; không biến thời điểm xác nhận thành
thời điểm phát hành được nguồn công bố. Gọi lại xác nhận thành công là idempotent.
Overview trả effectiveAt null khi có effectiveOn, confirmedAt riêng; phase AWAITING_CONFIRMATION
trước xác nhận. Nguồn lịch sử chỉ biết ngày vẫn xem/nhập dữ liệu được mà không cần xác nhận
rằng patch cũ đang áp dụng hiện tại.

Lịch mùa nhận đúng một startsAt/startsOn và một endsAt/endsOn. startsOn/endsOn được lưu
DATE; ngày kết thúc không có giờ được hiểu bao gồm cả ngày đó. Khoảng kiểm tra chồng lấn
nội bộ dùng ranh giới ngày theo múi giờ thị trường, không phải giờ diễn ra đã xác minh.
Overview không trả các ranh giới suy ra như timestamp sự kiện. Lịch mùa chỉ có ngày có
phase RECORDED, không được tự khẳng định là current từ giờ suy ra.
Frontend hiển thị ngày nếu chỉ có DATE, ngày kèm giờ nếu có timestamp, không thêm nhãn
“Chưa rõ giờ”. Form có ngày và giờ tùy chọn; giờ nhập theo múi giờ thiết bị được hiển thị
ngay dưới ô. Ngày thuần không dịch theo múi giờ người xem.

### Lịch mùa chưa biết ngày kết thúc (V014)

Ngày kết thúc mùa là tùy chọn. Thiếu ngày kết thúc nghĩa là chưa xác định, không tự suy ra
mùa đang diễn ra vô thời hạn. POST lịch mùa cập nhật bản ghi hiện có theo mùa/thị trường,
cho phép bổ sung ngày kết thúc sau. Ràng buộc chống chồng lấn áp dụng cho các lịch đủ hai mốc.
Patch có thể ghi nhận trước khi có lịch mùa; khi lịch mùa đã có, kiểm tra các mốc đã biết.
Form lịch dùng panel bên phải trên desktop, từ dưới trên mobile; bộ chọn lịch thống nhất,
chỉ hiện nhập giờ khi chọn Thêm giờ. Ngày không có giờ vẫn giữ độ chính xác theo ngày.
### Bản nháp thiếu dữ liệu khi import

Bản nháp được thiếu vai trò tướng và mô tả kỹ năng. Mô tả chưa có được lưu chuỗi rỗng,
không tự tạo nội dung. Tên, mã nhận diện, kiểu dữ liệu và tính hợp lệ của ảnh vẫn được kiểm tra.
Preview trả cảnh báo rõ vai trò còn thiếu, mã kỹ năng và ngôn ngữ thiếu mô tả. Khi xuất bản,
backend bắt buộc vai trò và mô tả kỹ năng, trả errors[] gồm đường dẫn trường thiếu.
Quy định này thay thế yêu cầu vai trò bắt buộc ngay khi tạo/import bản nháp trước đây.
### Khôi phục upload import

Khi xác nhận import, lưu phiên chuẩn bị trên backend trước khi upload ảnh. Phiên giữ dữ liệu đã ánh xạ, đường dẫn gốc, dấu vân tay SHA-256 của file và tiến trình từng ảnh. Đóng web tạm dừng upload; mở lại cùng tài khoản để tiếp tục, chọn lại folder/ZIP ban đầu cho ảnh còn thiếu. Không tải lại ảnh đã complete. Tác vụ đã nhận vẫn chạy nền như ADR-009. Không khôi phục hồi tố các lượt upload trước tính năng này.

### Đối chiếu bản nháp và nguồn dữ liệu thu thập

Admin được đối chiếu hai snapshot của cùng tướng/ruleset, kể cả bản nháp. Mặc định đối chiếu
với sourceRevisionId được lưu khi tạo bản nháp. Snapshot độc lập không có nguồn trả trạng thái
BASELINE_ONLY; không xem toàn bộ nội dung là thay đổi của patch. Chọn nguồn tường minh chỉ
thực hiện đối chiếu, không sửa applicability, không tạo changelog và không chứng minh nguyên nhân.
Các dòng kỹ năng, trang phục, chỉ số và bản dịch được ghép theo mã ổn định/locale; đổi thứ tự
bản dịch không được tính là thay đổi nội dung. Sources dùng kiểm chứng nguồn, không tính vào diff gameplay.

Import nhận thêm overviewRatings và combatStats theo cấu trúc section do backend cho phép,
áp dụng chính sách FILL_EMPTY/OVERWRITE/SKIP trên cả object. Các section không được ánh xạ giữ nguyên.
Rating quy đổi từ đếm thanh ảnh phải có derived=true và nguồn giải thích phương pháp, trong scale
GAME_OVERVIEW_10 (0–10); không gắn nhãn số liệu chính thức. Không tự điền chỉ số hoặc đơn vị không biết.
Metadata kỹ năng SOURCE_SNAPSHOT có thể giữ bảng cấp chiêu, nhãn/giá trị gốc, màu và reviewFlags;
cảnh báo nguồn được giữ và hiển thị khi import, không tự suy luận dạng chiêu chưa thu thập.

Nếu baseline ban đầu còn nháp đã chọn nhầm mùa/patch, admin có thể xác nhận đổi mốc quan sát
trong cùng ruleset. Chỉ áp dụng với DATA_BASELINE độc lập chưa có sourceRevisionId và chưa có bất kỳ
snapshot PUBLISHED nào trong cùng ruleset. Thao tác giữ nguyên section/ảnh, kiểm tra version và ghi audit;
không tự chuyển hàng loạt hoặc sửa mốc của lịch sử đã xuất bản.

### Không gian ảnh nhân vật

Portrait, Head và Cover được quản lý trên backend, nhóm theo tướng và các trang phục liên quan.
Mỗi chủ thể/vai trò có một ảnh chính và nhiều ảnh ứng viên; giữ nguyên mọi file khác tên, gồm
`-1`, `-2`, không tự bỏ ảnh vì bytes giống nhau. Chọn ảnh chính không làm mất ảnh cũ. Danh sách
hiển thị cả trường hợp chưa có ảnh để biên tập viên bổ sung; nguồn và ghi chú đọc từ Media.

Ảnh theo section revision của tướng, cùng quy tắc bản nháp/xuất bản hiện có. Chỉnh ảnh của snapshot
đã xuất bản phải tạo bản nháp cập nhật hình ảnh, không sửa lịch sử. Thư viện chọn snapshot chưa hủy
mới nhất theo thứ tự gameplay rồi revisionNo, không theo ngày tạo hoặc revisionNo đơn lẻ.

Tên tướng và trang phục dùng các bản dịch hiện có. Bậc/nhãn trang phục có mã ổn định dùng chung,
nhưng tên hiển thị và icon riêng cho từng ngôn ngữ. Có thể thêm bản dịch chưa có icon, giữ nguyên
các bản dịch khác. Khi thiếu ngôn ngữ yêu cầu, dự phòng cả cặp tên/icon từ vi-VN, en-US rồi locale
đầu tiên; UI ghi rõ ngôn ngữ thực tế. Một bản dịch đã tồn tại nhưng thiếu icon hiển thị ô trống,
không ghép icon của ngôn ngữ khác. Loại chưa phân loại là UNKNOWN, không suy luận bậc/sự kiện.

Nhập ảnh tài nguyên đi qua Media presigned upload/complete. Chỉ ánh xạ mã tướng/skin chính xác,
giữ ảnh chính đang có và lưu các ứng viên vào bản nháp; không tự xuất bản. Không sửa dữ liệu trong
resources. Báo cáo và checkpoint cục bộ cho phép tiếp tục mà không upload lại file đã hoàn tất.

### Nhóm bậc và chủ đề trang phục

Nhãn trang phục có một nhóm hiển thị chính, loại RANK (bậc) hoặc THEME (sự kiện/chủ đề).
Đây là cách tổ chức thư viện để tìm và biên tập, không thay thế rarity_code của trang phục và
không tự xác minh loại UNKNOWN/RARITY/EVENT của nhãn. Có thể tạo, đổi tên theo ngôn ngữ và chuyển
nhãn sang nhóm khác. Nhãn chưa phân nhóm nằm trong nhóm tổng hợp Chưa phân nhóm.

Các nhóm ban đầu dựa trên những họ mã nguồn rõ ràng; mã chưa nhận diện giữ nguyên chưa phân nhóm.
Tên và icon của mọi bản dịch nhãn đang có được giữ nguyên. Chuyển nhóm dùng optimistic version
của nhãn, không sửa các bản dịch hoặc nội dung snapshot tướng. Nhóm được phân trang độc lập;
mở nhóm mới tải các nhãn, mở nhãn mới tải trang phục liên quan.

Bảng ảnh hiển thị bậc/nhãn trên dòng trang phục và không có cột icon đi tới trang ở cuối bảng.
Chọn ảnh hoặc trang phục mở khung chi tiết ngay tại chỗ, bên phải trên desktop và từ dưới trên
mobile. Chỉ nút mở trang đầy đủ trong chi tiết mới điều hướng. Chi tiết cho chuyển Head/Portrait/
Cover và chuyển tướng/trang phục cùng revision bằng dải ảnh chính; không đưa các ảnh bổ sung
vào dải chuyển nhanh. Ảnh bổ sung được chọn từ bảng vẫn mở đúng file đã chọn. Khi đang sửa hoặc
upload, việc chuyển ảnh vẫn bảo vệ dữ liệu chưa lưu.

## Kho trang bị — đợt triển khai quản trị đầu tiên

Item, Arcana, Spell và Enchantment dùng dữ liệu backend thật. Mỗi module sở hữu identity UUID,
mã ổn định, snapshot gameplay theo ruleset và bản dịch riêng theo revision/locale. Tên, tóm tắt,
mô tả, tên chỉ số, tên biến thể và nội dung nội tại/kích hoạt thuộc bản dịch; giá, cấp, tọa độ,
công thức ghép và số liệu không được thay đổi theo ngôn ngữ hiển thị.

Tạo mới cho phép lưu nháp thiếu dữ liệu và trả `missingFields`. Xuất bản kiểm tra ảnh đã upload,
trường bắt buộc và patch quan sát cùng ruleset đã xuất bản nếu đã biết mốc. Riêng Trang bị và
Phụ trợ đang có, dữ liệu nền DATA_BASELINE đủ nội dung được xuất bản với patch chưa xác định;
không buộc gán vào một mùa hoặc ngày giả định. Bảng ngọc/Phù hiệu vẫn cần mốc quan sát trước
khi xuất bản. Bản đã xuất bản bất biến; sửa tiếp
phải fork bản nháp với nguyên nhân rõ ràng. Dữ liệu nền không tự tạo thay đổi gameplay quá khứ.

Correction/bản dịch kế thừa mốc chưa rõ từ baseline đã xuất bản. GAME_PATCH luôn cần patch cụ
thể. Danh mục hiện hành và tham chiếu dùng baseline chưa rõ làm dự phòng ordinal 0; snapshot
có patch hiệu lực được ưu tiên hơn, bản của patch tương lai chưa thay thế hiện hành. Có nguồn
lịch sử sau này thì tạo snapshot ở patch thật và ghi change set với baseline làm nguồn, không
đổi ngữ cảnh snapshot đã xuất bản. Hồ sơ phụ trợ lưu trữ REMOVED/legacy không thuộc dự phòng này.

Trang bị có danh mục nhóm được dịch, vị trí hàng/cột bắt đầu từ 0 và công thức ghép bằng UUID
trang bị thành phần cùng số lượng. Chưa xác minh giữ UNKNOWN, không suy diễn từ mô tả hoặc
quan hệ gợi ý cũ. Tọa độ chưa biết giữ null. Ghi công thức được tuần tự hóa để kiểm tra chu trình.

Phù hiệu tham chiếu danh mục nhánh riêng, có tên/mô tả/đối tượng phù hợp được dịch, icon, nền và
màu hiển thị. Các nút có cấp I/II/III và thứ tự trong cấp. Bảng ngọc có màu, cấp và chỉ số số học;
nhãn chỉ số được dịch. Phụ trợ có hồi chiêu, mở khóa, trạng thái khả dụng, trạng thái biến thể,
điểm tích trữ và ảnh tham khảo; mô tả từng trạng thái tách khỏi gameplay.

Ảnh được upload trực tiếp qua quy trình Media hiện có, giữ nguồn và ghi chú; module sở hữu chỉ
kiểm tra `MediaAssets` và báo tham chiếu qua `MediaUsageProvider`. Nhập tài nguyên lần đầu giữ
bản nháp để người quản trị xem xét nguồn, dữ liệu chưa biết và ngữ cảnh trước khi xuất bản.

### Phụ trợ lưu trữ chưa rõ patch

Phụ trợ có legacy=true và availability=REMOVED được xuất bản không có patch quan sát,
trừ revision GAME_PATCH. Đây là hồ sơ lưu trữ, không phải snapshot gameplay đang áp dụng;
các yêu cầu nội dung khác khi xuất bản vẫn giữ nguyên. Dữ liệu lưu trữ không tự trở thành
thay đổi của patch và không được fallback như dữ liệu từ trước mọi patch.

Khi có nguồn xác nhận, người có spell:publish được ghi sự kiện REMOVED riêng, liên kết
revision đã xuất bản, patch đã xuất bản cùng ruleset, URL nguồn HTTP(S) và ghi chú.
Sự kiện không sửa revision đã xuất bản, không suy diễn chỉ số trước/sau, có audit và
chống ghi trùng cùng phụ trợ/patch. Hồ sơ lưu trữ được trả qua endpoint riêng.

### Timeline và phân loại thay đổi

Timeline kéo ngang để duyệt, chọn patch để lọc, không kéo đổi lịch sử đã xác nhận.
Patch không có thay đổi ở một domain không tạo bản sao dữ liệu; snapshot trước được kế thừa.
Dữ liệu nền là trạng thái đã quan sát, tách khỏi thêm mới trong game. Không suy ra buff/nerf từ dấu của chỉ số.
Kho trang bị dùng DATA_BASELINE, ADDED, UPDATED, REMOVED, BUFF, NERF, BALANCE, REWORK, FIX.
Các phân loại xác nhận có snapshot, nguồn và tóm tắt dịch riêng, không lấy sửa bản dịch/hiệu chỉnh làm game patch.
Tướng tách phân loại từng kỹ năng/chỉ số khỏi đánh giá tổng thể tướng trong patch; chưa đánh giá giữ null.

### Rà soát patch và xem dữ liệu kế thừa

- Trạng thái nhập liệu `IN_PROGRESS` / `COMPLETE` độc lập xuất bản và lịch áp dụng game. Biên tập viên xác nhận hoàn tất sau khi rà soát tất cả nhóm; thêm snapshot gameplay hoặc ghi nhận thay đổi mới tự mở lại rà soát. Bản dịch và sửa nội dung không tự mở lại.
- Bộ lọc có hai chế độ: chỉ thay đổi, hoặc toàn bộ dữ liệu tại mốc. Chế độ đầy đủ kế thừa snapshot đã xuất bản gần nhất không vượt quá patch đích, không lấy dữ liệu tương lai. Nhãn không thay đổi chỉ dùng sau xác nhận hoàn tất; trước đó ghi rõ kế thừa, chưa ghi nhận thay đổi.
- Timeline từng nhóm ẩn patch hoàn tất không có thay đổi/dữ liệu nền. Timeline cấu hình vẫn giữ mọi mốc để quản lý. Mùa nằm trên tiêu đề timeline; patch là các thẻ bên dưới, có nút tạo mùa/patch theo quyền.
- Mốc đang áp dụng lấy từ lịch phát hành thị trường đã xác nhận, không suy ra từ việc xuất bản dữ liệu.


## Thuật ngữ và tham chiếu dùng chung (2026-10-20)

Module `terminology` sở hữu định nghĩa thuật ngữ, bản dịch, tên gọi khác và cách trình bày tham chiếu;
không sở hữu dữ liệu gameplay của tướng hoặc trang bị. Admin đọc cấu hình backend; API công khai sẵn sàng để wiki dùng cùng dữ liệu. Frontend wiki chỉ dùng thử và đã gỡ phần tích hợp thử theo yêu cầu.
Biên tập dùng quyền hiện có `hero:write` cùng `catalog:read`; cấu hình được công khai sau khi lưu,
không gắn với mùa/patch. Ghi nhận audit và kiểm tra `expectedVersion` để ngăn ghi đè.

Danh mục admin có thể sử dụng bản nháp để biên tập. Danh mục công khai chỉ kết hợp tham chiếu tướng,
trang bị đã xuất bản và có hiệu lực trong thị trường được chọn, thông qua contract
`terminology.PublicReferenceProvider`. Không trả đường dẫn admin hoặc tùy chỉnh của đối tượng chưa
công khai. Thiếu lịch gameplay không ngăn đọc các thuật ngữ chung.

Tab **Thử hiển thị** dùng chung trình soạn mô tả, có thanh định dạng và chọn tham chiếu, chọn ngôn ngữ
và ngữ cảnh admin/wiki. Nội dung thử không lưu vào dữ liệu game. JSON Vite cũ chỉ còn nguồn chuyển
đổi tùy chọn: đọc vào nháp, kiểm tra rồi lưu backend, không tự ghi đè hoặc xóa file cũ.


### Thư viện icon kỹ năng chưa đủ thông tin (2026-10-20)

Hero có thư viện ảnh kỹ năng độc lập với snapshot gameplay. Có thể nhập tất cả icon và biến thể từ tài nguyên
ngay khi chưa thu thập tên/mô tả hoặc dạng kỹ năng. Mỗi ảnh giữ tướng, slot nguồn, số biến thể, tên file
và asset Media; skillKey chỉ gán khi identity kỹ năng đã tồn tại. Không tạo chiêu, chỉ số, bản dịch hoặc
lịch sử patch giả để chứa ảnh. Snapshot đã xuất bản không bị đổi bởi thao tác nhập thư viện.

Khi đọc ở admin, icon đã gán trong snapshot được ưu tiên; ảnh thư viện chỉ là gợi ý/fallback có nhãn
phân biệt, không được xem là bằng chứng ảnh đã áp dụng trong patch lịch sử. Những ảnh chưa ghép vẫn
hiện trong thư viện tướng và được báo tham chiếu Media để không bị xem là asset bỏ trống.

### Tham chiếu trực tiếp kỹ năng (2026-10-20)

Bộ chọn `@` tìm kỹ năng trực tiếp trên nhiều tướng, không cần chọn tướng trước. Có thể gõ
`chiêu 1 airi`, `airi chiêu 1`, `edras chiêu 2 1` hoặc `edras chiêu 1 2`; số sau slot là biến thể nguồn.
Tên tướng/kỹ năng được tìm không dấu. Lệnh nhóm `Kỹ năng`, `Chiêu`, `Chiêu thức`, `Skill` mở danh sách
có phân trang. Không tải toàn bộ snapshot hoặc mọi kỹ năng vào danh mục chung.

Identity tham chiếu là `<heroUUID>.<skillKey>`; tên, mô tả, icon và tướng sở hữu lấy từ cùng revision.
Tìm kiếm chỉ gợi ý kỹ năng trong revision hiện hành của ngữ cảnh. Khi đọc token đã lưu, có thể tìm
revision hợp lệ gần nhất còn chứa skillKey đó; không lấy bản nháp hoặc patch tương lai cho wiki.
Ảnh thư viện chỉ fallback ở admin khi ghép duy nhất theo skillKey hoặc slot+biến thể chuẩn, có nhãn
nguồn `LIBRARY`; public chỉ dùng ảnh gắn trong revision. Không suy đoán dạng từ tên hoặc thứ tự mảng.


### Nguồn ảnh, credit và liên hệ (28/10/2026)

Media lưu nguồn độc lập với bytes và các revision nội dung. Nguồn gồm loại, tên nơi cung cấp,
URL đối chiếu, chủ sở hữu/tên cần credit (`ownerName`), trang liên hệ công khai của bên cung cấp
(`contactUrl`), thời điểm quan sát nếu biết và ghi chú nội bộ. Tên website cung cấp không tự đồng
nghĩa với chủ sở hữu. Nguồn ở phiên bản ảnh được ưu tiên; chỉ dùng nguồn cấp asset khi phiên bản
chưa có nguồn riêng. Public chỉ nhận các trường credit, không nhận ghi chú/path nội bộ.

Import đọc các manifest được dẫn từ `resources/Lien-Quan-v3/note/`; đối chiếu SHA-256 để giữ nguồn
qua đổi tên file. Ảnh đã xử lý/tái tạo giữ nhãn riêng. Portrait qua Figma là ảnh chụp Liên Quân do
người dùng cung cấp, chủ sở hữu/credit Garena / Liên Quân Mobile theo xác nhận của người dùng;
Figma giữ vai trò nguồn gói file. Năm ảnh phụ trợ từ `phu-tro.zip` cũng là ảnh Liên Quân theo
xác nhận của người dùng, giữ credit Garena và không tự suy ra ngày chụp.
Nguồn chưa rõ giữ trạng thái bằng nhãn “Chưa xác minh nguồn”,
không tự tạo URL hoặc ngày thu thập. Ngày chỉ biết đến ngày được giữ trong ghi chú import, không
chuyển thành thời điểm quan sát chính xác giả định.

Upload mới nhận nguồn ngay ở phiên cấp ticket, lưu bền cùng session và gắn vào version trong
transaction complete. Retry complete không thêm nguồn lặp. Admin có `media:write` được bổ sung
nguồn cho version đã tồn tại mà không upload lại bytes hoặc xuất bản lại nội dung.

Wiki có biểu tượng “Nguồn ảnh” tại các khung ảnh có tương tác nguồn, hoạt động bằng click/touch
và bàn phím. Từ khung này mở `/contact` cùng asset/version của ảnh. Trang Liên hệ nhận tên,
email, loại yêu cầu và nội dung; lưu cho quản trị viên xử lý, không tự gửi email. Thông tin liên
hệ của người gửi không được đưa vào credit công khai. Chỉ người có `media:write` xem/đánh dấu
đã xử lý yêu cầu. Chặn quá 5 lần gửi/10 phút theo địa chỉ kết nối trên mỗi instance; không tin
header proxy do client tự cung cấp.
