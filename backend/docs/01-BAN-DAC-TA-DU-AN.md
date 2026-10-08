# WikiAOV Backend — Bản đặc tả dự án

**Trạng thái:** Tài liệu đặc tả hiện hành (canonical)  
**Phạm vi:** Backend `wiki-service` (AOV Wiki). Mục 3 mô tả bối cảnh toàn hệ thống; frontend và các service khác chỉ được mô tả ở mức ranh giới.  
**Tài liệu liên quan:** `02-DATABASE-DU-AN.md`, `03-API-DU-AN.md`

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
```

Chi tiết cấu hình thư viện (annotation processing của Lombok/MapStruct, quy ước Flyway) xem `NOTE-SPRING-BOOT-4.md`. Nếu NOTE mâu thuẫn với bộ 01/02/03 (tên package, kiểu ID, API base path, cấu trúc package), bộ 01/02/03 được ưu tiên.

### 2.3 Không thuộc phạm vi bắt buộc ban đầu

Các thành phần sau không phải điều kiện để backend đầu tiên hoàn thành:

- Kubernetes;
- Spring Cloud Gateway (dùng reverse proxy, xem mục 3.6);
- Eureka/service registry;
- Config Server;
- Kafka;
- Redis;
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
| **Cộng đồng** | Bài viết, bình luận, thảo luận, hồ sơ người dùng, báo cáo/kiểm duyệt | `community-service` | Sau |
| **Giải đấu** | Giải, đội, lịch thi đấu, kết quả trận, cấm/chọn tướng | `community-service` | Sau |
| **Livestream** | Danh sách kênh, trạng thái đang live, nhúng player | `community-service` | Sau |

Frontend là monorepo React + TypeScript + Vite (pnpm workspace, Turborepo) trong thư mục `frontend/`:

| App | Vai trò | Gọi tới |
|---|---|---|
| `aov-wiki` | Trang AOV Wiki (public) | `wiki-service` |
| `aov-stream` | Trang livestream | `community-service` (sau); tên/ảnh tướng từ `wiki-service` |
| `admin-aov` | Trang quản trị cho biên tập viên | Admin API của `wiki-service`; sau thêm `community-service` |

UI dùng chung nằm ở `packages/ui` (`@aov/ui`, shadcn/ui). Trang cộng đồng và giải đấu chưa có app; khi triển khai sẽ thêm app mới hoặc mở rộng app hiện có.

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
community-service   Cộng đồng + Giải đấu + Livestream — triển khai sau
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
  │ 3 app tĩnh│     │ Spring Boot  │      │ Spring Boot (sau) │  │ MinIO / S3     │
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
              ── /media/**     → minio:9000    (bucket wiki-media, chỉ prefix assets/, chỉ GET)

wiki-service  ──→ postgres  (database: wiki)
              ──→ minio     (S3 API, credential có quyền ghi)
              ──→ keycloak  (chỉ lấy JWKS để xác minh token)
```

Container:

| Container | Vai trò | Ghi chú |
|---|---|---|
| `reverse-proxy` | TLS, routing, phục vụ file tĩnh của các app frontend | Caddy tự cấp chứng chỉ TLS, cấu hình ngắn |
| `wiki-service` | Spring Boot JAR | Một instance là đủ ở giai đoạn đầu |
| `postgres` | Database `wiki`; về sau thêm `keycloak`, `community` | Mỗi database một user DB riêng |
| `minio` | Lưu bytes media | Bucket `wiki-media` |
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
admin-aov      public client, Authorization Code + PKCE — biên tập viên đăng nhập trang quản trị
aov-wiki       public client, PKCE — chỉ cần khi có tính năng người dùng cuối đăng nhập (sau)
aov-stream     public client, PKCE — chỉ cần khi có tính năng người dùng cuối đăng nhập (sau)
wiki-importer  confidential client, client credentials — script import dữ liệu gọi admin API
```

- Audience theo service: `wiki-service`, `community-service`. Mỗi service chỉ chấp nhận token có audience của mình.
- `wiki-service`: public GET không cần token; admin API cần scope theo mục 20.
- `community-service` (sau): tài khoản người dùng cuối. Biên tập viên và người dùng cuối nằm cùng IdP, khác nhau ở role/scope.
- Actor identity thống nhất toàn hệ thống là `(issuer, subject)`, nên một người vừa biên tập wiki vừa đăng bài cộng đồng vẫn là một danh tính.
- Không service nào lưu mật khẩu. Hồ sơ hiển thị (tên, avatar) thuộc `community-service`, khóa theo `(issuer, subject)`.
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

**Bối cảnh lịch sử.** Trận đấu lưu `region` và `patchVariantId`/thời điểm diễn ra. Nhờ resolver theo thời gian của wiki (`at=`), trang trận đấu về sau vẫn hiển thị đúng phiên bản tướng tại thời điểm thi đấu.

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
| `local` | Phát triển | `docker compose` chạy postgres, minio, keycloak; `wiki-service` chạy từ IDE; các app frontend chạy `pnpm dev` |
| `test` | Integration test | Testcontainers (PostgreSQL, MinIO); JWT giả lập trong test, không cần Keycloak |
| `prod` | Thật | Một VPS, Docker Compose, reverse proxy TLS, backup PostgreSQL + MinIO |

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

Hero chỉ bind tới `MediaAsset.id`, không bind trực tiếp tới MinIO object key.

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

Region đại diện thị trường/server/phạm vi phát hành.

Ví dụ:

```text
VN
TH
TW
ID
```

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
READY
DEPRECATED
BLOCKED
```

và retention phù hợp với lịch sử.

---

## 13. Object storage và MinIO

### 13.1 Nguyên tắc

PostgreSQL lưu metadata và reference.

Object storage lưu bytes.

Không lưu artwork lớn trực tiếp trong bảng hero/item bằng BYTEA.

### 13.2 Abstraction

Domain/application chỉ biết abstraction:

```text
ObjectStorage
```

Adapter local/dev:

```text
MinioObjectStorage
```

Production có thể thay bằng S3-compatible adapter khác mà không đổi Hero domain.

### 13.3 Object key

Database lưu `objectKey`, không lưu URL môi trường cụ thể như `http://localhost:9000/...`.

Object key/version phải hỗ trợ immutable delivery.

### 13.4 Upload flow

Giai đoạn đơn giản có thể:

```text
Admin/API caller
 -> Spring Boot
 -> ObjectStorage
```

Hướng tối ưu hơn:

```text
request upload
 -> backend cấp upload session / presigned PUT
 -> caller upload trực tiếp object storage
 -> complete upload
 -> backend stat/validate/hash/decode
 -> MediaAssetVersion READY
```

Upload thành công ở object storage không đồng nghĩa media version đã READY.

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
├── compose.yaml            dependency local: postgres, minio, keycloak
│
├── scripts/
│   ├── dev/
│   ├── import/
│   └── maintenance/
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
    │   │   ├── access/
    │   │   └── platform/
    │   │
    │   └── resources/
    │       ├── application.yml
    │       ├── application-local.yml
    │       ├── application-test.yml
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

Quy tắc dependency nội bộ:

```text
web -> application
application -> domain
persistence -> domain/application ports khi áp dụng
infrastructure -> ports/config cần implement
```

Domain không phụ thuộc Spring MVC/MinIO cụ thể.

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

### 20.4 Secrets

Không commit:

- JWT secrets/private keys;
- database password;
- MinIO/S3 credential;
- production token;
- cookie/session secret.

---

## 21. Error specification

Error backend phải có `code` ổn định.

Ví dụ:

```json
{
  "status": 409,
  "code": "VERSION_CONFLICT",
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
- response không lộ SQL, stack trace, secret hoặc internal path.

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
MinIO
Keycloak   (khi bật admin API)
```

`compose.yaml` trong `backend/wiki-service/` chạy dependency local (Spring Boot Docker Compose support tự khởi động khi chạy app ở local). Topology đầy đủ xem mục 3.4 và 3.10.

Application config chia theo environment:

```text
application.yml
application-local.yml
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
- MinIO local.

### Phase 2 — Media foundation

- MediaAsset;
- MediaAssetVersion;
- upload/register object;
- validation;
- activation;
- reverse usage contract.

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

