# WikiAOV Backend — API dự án

**Base path:** `/api/wiki/v1` (tiền tố theo service, xem mục 3.6 của `01-BAN-DAC-TA-DU-AN.md`; phiên bản theo mục 1.1)  
**Format:** JSON UTF-8; lỗi dùng `application/problem+json`.  
**Phạm vi:** Public read APIs + authenticated admin APIs cho backend hiện hành.  
**Tài liệu liên quan:** `01-BAN-DAC-TA-DU-AN.md`, `02-DATABASE-DU-AN.md`

---

## 1. Nguyên tắc API

1. API phục vụ domain/use case, không expose JPA Entity.
2. UUID là ID kỹ thuật; `code` có thể dùng cho lookup thân thiện nhưng không thay identity chính trong DB.
3. Public API không lộ draft/audit/source nội bộ nếu không chủ đích.
4. Admin API cần JWT + scopes.
5. Lỗi branch theo stable `code`, không branch theo text `detail`.
6. `region`, `locale`, `ruleset` có ý nghĩa khác nhau.
7. Caller thường gửi `region` + `locale`; backend tự resolve ruleset/active patch.
8. Historical/current context phải xuất hiện rõ trong response khi ảnh hưởng dữ liệu.
9. Revision-addressed resource đã publish là immutable và cache-friendly.
10. Current/resolver endpoint là mutable, dùng ETag/conditional request.

### 1.1 API versioning

Phiên bản nằm trong path và được Spring MVC 7 native API versioning đọc ra:

```text
/api/wiki/v1/heroes
 0    1   2
          └── segment 2 = phiên bản (v1 → 1)
```

- Controller map `ApiPaths.ROOT + "/heroes"` (`ROOT = /api/wiki/{apiVersion}`) và khai báo `version = "1"`.
- Phiên bản hỗ trợ: `1`. Phiên bản khác (`v2`…) trả `400 INVALID_API_VERSION`, không âm thầm rơi về v1.
- Chỉ đọc phiên bản cho path dưới `/api/wiki/`; actuator và `/error` không bị ảnh hưởng.
- Thêm phiên bản mới: đăng ký trong `ApiVersioningConfiguration`, thêm mapping `version = "2"` cạnh mapping v1. Không đổi URL chỉ vì nâng Spring Boot, sửa lỗi hay thêm field.
- Security và cache áp dụng cho mọi phiên bản (`/api/wiki/*/admin/**`).

Request chặt chẽ:

- Field JSON lạ bị từ chối (`fail-on-unknown-properties`) → `400 INVALID_REQUEST`, `errors[].code = UNKNOWN_FIELD`.
- Query parameter ngoài whitelist hoặc lặp lại (`QueryParameters.requireOnly`) → `400 INVALID_QUERY_PARAMETER`.

---

### 1.2 Tài khoản quản trị hiện tại

`GET /api/wiki/v1/admin/me` yêu cầu JWT hợp lệ và capability `catalog:read`.
Không nhận query parameter. Trả `Cache-Control: no-store` cùng đối tượng:

```json
{
  "issuer": "http://localhost:8081/realms/wikiaov",
  "subject": "subject-from-token",
  "type": "HUMAN",
  "displayName": "Biên tập viên",
  "capabilities": ["catalog:read", "media:write"]
}
```

Danh tính và quyền lấy từ JWT đã được backend xác minh; `displayName` có thể null.
Không trả access token hoặc refresh token. Token thiếu/không hợp lệ trả `401 UNAUTHENTICATED`;
thiếu quyền truy cập quản trị trả `403 FORBIDDEN`. Frontend dùng endpoint này để xác nhận
phiên đăng nhập sau luồng mật khẩu hoặc Google của Keycloak qua backend (ADR-007).

### 1.3 Đăng nhập admin qua Keycloak gateway

Các endpoint dưới đây dùng base path `/api/wiki/v1/auth`, luôn trả `Cache-Control: no-store`.
Mọi POST yêu cầu `Origin` khớp `ADMIN_ORIGIN` và `X-AOV-Auth: 1`.
Cookie không dùng để xác thực các API admin khác.

| Method/path | Request | Response |
|---|---|---|
| GET /config | Không query | `{ "googleEnabled": false }` |
| POST /login | `{ "username": "editor", "password": "..." }` | Access token + thời hạn; đặt refresh cookie |
| POST /refresh | Refresh cookie, không body | Access token mới + thời hạn; cập nhật refresh cookie |
| POST /logout | Refresh cookie, không body | 204 sau khi revoke thành công; xóa cookie |
| POST /google | Không body | `{ "state": "...", "authorizationUrl": "..." }`; đặt cookie ràng buộc flow |
| GET /google/callback | state, code hoặc error; tùy chọn error_description, session_state, iss | Kiểm tra state một lần và cookie, đổi code, đặt refresh cookie, 303 về trang hoàn tất cố định |

Response token: `{ "accessToken": "...", "expiresIn": 300 }`. Không có refresh token trong JSON.
Refresh cookie: `aov_admin_refresh`, HttpOnly, SameSite=Lax, Secure (trừ local), path `/api/wiki/`;
Max-Age theo refresh_expires_in từ IdP. Không có Domain. Không nhận query ở các endpoint trừ callback.
Tên đăng nhập tối đa 254 ký tự, mật khẩu tối đa 1024 ký tự; không lưu và không log các giá trị này.

- 401 AUTH_INVALID_CREDENTIALS: sai thông tin hoặc tài khoản cần hoàn tất bước xác minh ở Keycloak.
- 401 AUTH_SESSION_EXPIRED: thiếu, hết hạn hoặc không xác minh được phiên.
- 403 FORBIDDEN: thiếu catalog:read; không cấp refresh cookie mới.
- 403 AUTH_ORIGIN_REJECTED: Origin/header chống CSRF không hợp lệ.
- 429 AUTH_RATE_LIMITED: vượt giới hạn thử; chờ một phút. Local limiter: 30 lần/IP/phút,
  10 lần/tên tài khoản/phút, refresh 120 lần/IP/phút, tạo Google flow 10 lần/IP/phút.
- 503 AUTH_PROVIDER_UNAVAILABLE: IdP hoặc cấu hình client chưa sẵn sàng.
- 503 AUTH_GOOGLE_DISABLED: Google chưa bật.
- 400 AUTH_INVALID_STATE: Google state thiếu ràng buộc, hết hạn hoặc dùng lại.

Callback hợp lệ nhưng bị từ chối/hủy sẽ chuyển về trang hoàn tất với trạng thái lỗi cố định;
không chuyển thông báo thô của IdP hoặc token vào URL. Popup báo hoàn tất cho opener bằng
postMessage kiểm tra origin, source và state. Frontend sau đó gọi refresh để lấy access token.
State/verifier được lưu tối đa 5 phút, chỉ dùng một lần, xem giới hạn nhiều replica trong ADR-007.

### 1.4 Hồ sơ người dùng dùng chung (ADR-008)

Base `/api/wiki/v1`, Bearer JWT đã xác minh. Tất cả response `no-store`.

| Method/path | Quyền | Ý nghĩa |
|---|---|---|
| GET /users/me | Tài khoản HUMAN | Hồ sơ cá nhân hoặc giá trị khởi tạo version 0 |
| PUT /users/me | Tài khoản HUMAN | Tạo/sửa hồ sơ của chính subject trong token |
| GET /admin/users?search=&page=0&size=20 | catalog:read + user:read | PageSlice, tìm tên không phân biệt hoa thường; size 1–100 |
| GET /admin/users/{id} | catalog:read + user:read | Chi tiết hồ sơ |
| PUT /admin/users/{id} | catalog:read + user:write, HUMAN | Sửa hồ sơ đã tồn tại |
| POST /users/me/avatar-uploads | HUMAN | `{fileName, contentType, sizeBytes}` → ticket PUT tới storage |
| POST /users/me/avatar-uploads/{uploadId}/complete | Chủ upload, HUMAN | `{assetId, avatarUrl}` sau khi media xác minh |

Body PUT: `{displayName, biography, locale, timeZone, avatarAssetId, expectedVersion}`.
Avatar null để gỡ. `expectedVersion` bắt buộc; 0 chỉ khi tạo. Không nhận issuer, subject hay capability từ body.
Tên tối đa 80 ký tự, giới thiệu 1000, locale 35, múi giờ 64. Response hồ sơ gồm
`id, displayName, biography, locale, timeZone, avatarAssetId, avatarUrl, version, createdAt, updatedAt`.
Không có hồ sơ: id và thời gian null; GET không ghi DB. Avatar URL ký sẵn hết hạn sau 15 phút, không lưu bền.

Ticket: `{uploadId, assetId, method, uploadUrl, headers, expiresAt}`. Browser gửi đúng headers tới storage,
không kèm Authorization/cookie của admin. Complete không tự gắn ảnh; PUT hồ sơ mới là bước áp dụng.
Các lỗi upload dùng error code của media. Người khác không được complete hoặc gắn upload không thuộc mình.
Danh sách admin chỉ có hồ sơ đã lưu, không đồng bộ danh sách tài khoản Keycloak.

- 404 USER_PROFILE_NOT_FOUND: không có UUID hồ sơ.
- 409 USER_PROFILE_CONFLICT: version cũ; tải lại rồi xem xét trước khi lưu, không tự retry ghi đè.
- 422 USER_PROFILE_INVALID: nội dung, locale hoặc múi giờ không hợp lệ.
- 422 USER_AVATAR_INVALID: avatar chưa READY/ACTIVE, không đúng loại hoặc không thuộc người sửa.
- 401/403: token hoặc quyền không phù hợp. Không công khai danh sách hồ sơ.
## 2. Common request context

### Region

Public gameplay read thường nhận:

```text
region=VN
```

Backend dùng region + thời điểm để resolve:

```text
RegionRulesetAssignment
-> active PatchRelease
-> PatchVariant
-> GameplayRuleset
```

### Locale

```text
locale=vi-VN
```

Locale chỉ quyết định translation/format, không đổi gameplay revision.

Ví dụ hoàn toàn hợp lệ:

```text
region=VN&locale=en-US
```

### Time

Public current endpoint mặc định `now`.

Historical API có thể cho phép:

```text
at=2026-09-28T05:00:00Z
```

chỉ ở endpoint/use case thật sự cần. Không cho caller tùy ý backdate admin write.

---

## 3. Common response context

Các response current gameplay nên có context tương đương:

```json
{
  "context": {
    "region": "VN",
    "requestedLocale": "en-US",
    "actualLocale": "en-US",
    "ruleset": {
      "id": "...",
      "code": "AOV-GLOBAL"
    },
    "patch": {
      "id": "...",
      "code": "patch-1-62"
    },
    "patchVariantId": "...",
    "effectiveAt": "2026-09-28T05:00:00Z"
  }
}
```

Nếu fallback locale:

```text
requestedLocale = en-US
actualLocale = vi-VN
fallbackApplied = true
```

Không thay ruleset/region chỉ vì fallback locale.

---

# PHẦN A — PUBLIC HERO API

## 4. Danh sách Hero

```http
GET /api/wiki/v1/heroes
```

Query:

```text
region=VN
locale=vi-VN
page=0
size=20
q=nakroth
role=ASSASSIN
sort=code,asc
```

Response conceptual:

```json
{
  "context": {
    "region": "VN",
    "requestedLocale": "vi-VN",
    "ruleset": { "code": "AOV-GLOBAL" },
    "patch": { "code": "patch-1-62" }
  },
  "items": [
    {
      "id": "...",
      "code": "nakroth",
      "name": "Nakroth",
      "roles": ["ASSASSIN"],
      "head": {
        "assetId": "...",
        "assetVersionId": "...",
        "url": "https://..."
      }
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 120,
  "totalPages": 6
}
```

Không trả toàn bộ skills/skins trong list.

---

## 5. Hero detail aggregate

```http
GET /api/wiki/v1/heroes/{heroId}?region=VN&locale=vi-VN
```

Endpoint tiện dụng, backend compose public view hiện hành.

Có thể trả:

```text
profile
overviewRatings
combatStats
skills
skins
media
context
revision metadata
```

Dùng cho caller muốn một request đơn giản.

Backend vẫn giữ section revisions bên dưới; endpoint này không biến domain trở lại blob.

---

## 6. Hero manifest

```http
GET /api/wiki/v1/heroes/{heroId}/manifest?region=VN&locale=vi-VN
```

Mục đích:

- response nhỏ;
- cho biết current HeroRevision;
- cho biết section revision IDs;
- cho biết current MediaAssetVersion IDs;
- cho phép caller chỉ tải resource đã đổi;
- làm ETag resolver tốt.

Response:

```json
{
  "heroId": "...",
  "heroRevisionId": "HR21",
  "context": {
    "region": "VN",
    "rulesetCode": "AOV-GLOBAL",
    "activePatchVariantId": "PV162G"
  },
  "sections": {
    "profile": "P3",
    "overviewRatings": "O5",
    "combatStats": "S9",
    "skills": "K13",
    "skins": "C4",
    "mediaBindings": "M5"
  },
  "mediaAssets": {
    "head": {
      "assetId": "AH",
      "currentVersionId": "AHV2"
    },
    "portrait": {
      "assetId": "AP",
      "currentVersionId": "APV4"
    },
    "splash": {
      "assetId": "AS",
      "currentVersionId": "ASV1"
    }
  }
}
```

---

## 7. Immutable Hero section endpoints

Dùng revision ID được manifest trả.

### Profile

```http
GET /api/wiki/v1/heroes/{heroId}/profile-revisions/{revisionId}?locale=vi-VN
```

### Overview ratings

```http
GET /api/wiki/v1/heroes/{heroId}/overview-rating-revisions/{revisionId}
```

### Combat stats

```http
GET /api/wiki/v1/heroes/{heroId}/combat-stat-revisions/{revisionId}
```

### Skills

```http
GET /api/wiki/v1/heroes/{heroId}/skill-set-revisions/{revisionId}?locale=vi-VN
```

### Skins

```http
GET /api/wiki/v1/heroes/{heroId}/skin-set-revisions/{revisionId}?locale=vi-VN
```

### Media bindings

```http
GET /api/wiki/v1/heroes/{heroId}/media-binding-revisions/{revisionId}
```

Published section revision là immutable. Nếu revision ID không thuộc hero trong path -> 404.

---

## 8. Hero patch history

```http
GET /api/wiki/v1/heroes/{heroId}/changes
```

Query:

```text
region=VN
locale=vi-VN
page=0
size=20
```

Response conceptual:

```json
{
  "hero": {
    "id": "...",
    "code": "nakroth",
    "name": "Nakroth"
  },
  "items": [
    {
      "patch": {
        "id": "...",
        "code": "patch-1-62",
        "effectiveAt": "..."
      },
      "patchVariantId": "...",
      "fromHeroRevisionId": "HR20",
      "toHeroRevisionId": "HR21",
      "changedSections": ["COMBAT_STATS", "SKILLS"],
      "summary": "...",
      "changes": [
        {
          "type": "HERO_STAT_CHANGE",
          "statKey": "HP",
          "oldValue": 3500,
          "newValue": 3600,
          "changeKind": "BUFF"
        },
        {
          "type": "HERO_SKILL_CHANGE",
          "skillKey": "skill-1",
          "aspect": "COOLDOWN",
          "oldValue": 10,
          "newValue": 8,
          "unit": "SECOND",
          "changeKind": "BUFF"
        }
      ]
    }
  ]
}
```

Chỉ game semantic changes xuất hiện. Sửa typo/content correction không xuất hiện ở đây.

---

# PHẦN B — PUBLIC PATCH API

## 9. Danh sách patches

```http
GET /api/wiki/v1/patches
```

Query:

```text
region=VN
locale=vi-VN
page=0
size=20
```

Trả patch families cùng release/effective metadata của region yêu cầu.

---

## 10. Patch detail

```http
GET /api/wiki/v1/patches/{patchId}?region=VN&locale=vi-VN
```

Trả:

- patch identity/translation;
- variant dùng cho region;
- release/effectiveAt;
- counts theo domain;
- summary.

---

## 11. Mixed-domain patch changes

```http
GET /api/wiki/v1/patches/{patchId}/changes
```

Query:

```text
region=VN
locale=vi-VN
domain=HERO          # optional
page=0
size=50
```

Normalized summary response:

```json
{
  "patch": {
    "id": "...",
    "code": "patch-1-63"
  },
  "variantId": "...",
  "effectiveAt": "...",
  "items": [
    {
      "domain": "HERO",
      "subject": {
        "id": "...",
        "code": "nakroth",
        "displayName": "Nakroth",
        "thumbnail": { "assetId": "...", "url": "..." }
      },
      "categories": ["COMBAT_STATS", "SKILLS"],
      "changeKinds": ["BUFF"],
      "changeCount": 2,
      "changeSetId": "..."
    },
    {
      "domain": "ITEM",
      "subject": {
        "id": "...",
        "code": "item-x",
        "displayName": "..."
      },
      "categories": ["STATS"],
      "changeCount": 1,
      "changeSetId": "..."
    }
  ]
}
```

Detail change schema không bị ép giống nhau giữa Hero và Item.

---

## 12. Domain-specific patch change detail

Có thể dùng một dispatcher endpoint:

```http
GET /api/wiki/v1/patches/{patchId}/changes/{changeSetId}
```

Response có discriminator `domain` và domain-specific detail.

Hoặc expose đường dẫn rõ owner:

```http
GET /api/wiki/v1/heroes/{heroId}/changes/{changeSetId}
GET /api/wiki/v1/items/{itemId}/changes/{changeSetId}
```

Khuyến nghị: public list dùng normalized patch feed; detail dùng owner-domain endpoint để semantics rõ.

---

# PHẦN C — PUBLIC CATALOG PATTERN

## 13. Item

```http
GET /api/wiki/v1/items
GET /api/wiki/v1/items/{itemId}
GET /api/wiki/v1/items/{itemId}/changes
```

Context vẫn `region/locale`.

Nếu Item revision được section hóa sau này, có manifest/revision resource tương tự Hero.

---

## 14. Arcana

```http
GET /api/wiki/v1/arcana
GET /api/wiki/v1/arcana/{arcanaId}
GET /api/wiki/v1/arcana/{arcanaId}/changes
```

---

## 15. Spell

```http
GET /api/wiki/v1/spells
GET /api/wiki/v1/spells/{spellId}
GET /api/wiki/v1/spells/{spellId}/changes
```

`spell` là phụ trợ.

---

## 16. Enchantment

```http
GET /api/wiki/v1/enchantments
GET /api/wiki/v1/enchantments/{enchantmentId}
GET /api/wiki/v1/enchantments/{enchantmentId}/changes
```

---

# PHẦN D — ADMIN HERO API

Tất cả `/api/wiki/v1/admin/**` cần Bearer JWT và `catalog:read` tối thiểu, cộng scope ghi tương ứng.

## 17. Admin list/status

```http
GET /api/wiki/v1/admin/heroes
GET /api/wiki/v1/admin/heroes/{heroId}
GET /api/wiki/v1/admin/heroes/{heroId}/revisions
GET /api/wiki/v1/admin/heroes/{heroId}/revisions/{revisionId}
```

Admin detail có thể trả:

```text
active draft
published revisions
section refs
ruleset
publication sequence
cause
source revision
effective patch variant
actor metadata
```

Không dùng public endpoint để preview draft.

---

## 18. Tạo Hero

```http
POST /api/wiki/v1/admin/heroes
```

Scope:

```text
hero:write
```

Request:

```json
{
  "code": "nakroth",
  "initialLocale": "vi-VN",
  "name": "Nakroth",
  "rulesetId": "..."
}
```

Thành công tạo:

- Hero identity;
- draft HeroRevision đầu;
- draft Profile section tối thiểu;
- audit.

`code` trùng -> `409 HERO_CODE_EXISTS`.

---

## 19. Tạo draft/fork HeroRevision

```http
POST /api/wiki/v1/admin/heroes/{heroId}/drafts
```

Request:

```json
{
  "rulesetId": "...",
  "sourceRevisionId": "...",
  "cause": "GAME_PATCH",
  "effectiveFromPatchVariantId": "...",
  "changeNote": "Prepare patch 1.63"
}
```

Nếu không chỉ định source, backend resolve published revision phù hợp.

Một hero/ruleset chỉ có một draft editable tại một thời điểm trong baseline model.

---

## 20. Đọc Hero draft

```http
GET /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}
```

Response chứa composition refs và authoring metadata.

```json
{
  "id": "...",
  "heroId": "...",
  "rulesetId": "...",
  "state": "DRAFT",
  "version": 7,
  "cause": "GAME_PATCH",
  "effectiveFromPatchVariantId": "...",
  "sections": {
    "profile": "P3",
    "overviewRatings": "O5",
    "combatStats": "S9-DRAFT",
    "skills": "K13-DRAFT",
    "skins": "C4",
    "mediaBindings": "M5"
  }
}
```

---

## 21. Update Profile section

```http
PUT /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/profile
```

Request có `expectedDraftVersion` + full Profile section content.

Nếu section chưa fork khỏi published revision, backend tạo draft section revision mới rồi đổi composition của draft.

---

## 22. Update Overview ratings

```http
PUT /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/overview-ratings
```

Payload:

```json
{
  "expectedDraftVersion": 7,
  "scaleCode": "GAME_OVERVIEW_10",
  "survivability": 6,
  "attackDamage": 8,
  "skillEffects": 7,
  "difficulty": 5,
  "derived": false,
  "changeNote": "..."
}
```

---

## 23. Update Combat stats

```http
PUT /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/combat-stats
```

```json
{
  "expectedDraftVersion": 8,
  "values": [
    {
      "statKey": "HP",
      "baseValue": 3600,
      "growthPerLevel": 250,
      "unit": "POINT"
    }
  ],
  "changeNote": "..."
}
```

Full replace của section trong draft; không merge field mơ hồ.

---

## 24. Update Skills

```http
PUT /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/skills
```

Request full skill set snapshot, bao gồm stable `skillKey`.

Không đổi key chỉ vì rename skill.

Media icon tham chiếu `MediaAsset.id`.

---

## 25. Update Skins

```http
PUT /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/skins
```

Stable `skinKey`, translation, art asset reference và metadata.

---

## 26. Update Hero media bindings

```http
PUT /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/media-bindings
```

Request:

```json
{
  "expectedDraftVersion": 10,
  "bindings": {
    "HEAD": "asset-head-id",
    "PORTRAIT": "asset-portrait-id",
    "SPLASH": "asset-splash-id"
  },
  "changeNote": "Use new official splash artwork"
}
```

Nếu chỉ nâng quality của cùng logical asset, **không gọi endpoint này**; Media version API xử lý.

---

## 27. Publish Hero draft

```http
POST /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/publish
```

Scope:

```text
hero:publish
```

Request:

```json
{
  "expectedVersion": 11,
  "changeNote": "Publish verified patch data"
}
```

Backend validate:

- draft editable/version đúng;
- section refs thuộc đúng hero;
- required profile/ratings/stats/skills/media theo policy;
- media assets active/usable;
- effective patch variant/ruleset hợp lệ nếu cause GAME_PATCH;
- provenance/source requirements;
- patch change set consistency nếu workflow yêu cầu.

Publish tạo immutable published composition.

---

## 28. Discard Hero draft

```http
POST /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/discard
```

Không xóa published/history.

---

## 29. Content correction không phải patch

Ví dụ sửa typo:

```text
Create draft from HR21
cause = CONTENT_CORRECTION
effectiveFromPatchVariantId giữ context cũ
fork Skills section
publish HR22
```

Không tạo `HeroPatchChangeSet`.

---

# PHẦN E — ADMIN MEDIA API

Quy ước chung của phần này:

- Mọi route cần `catalog:read` (luật URL); route thay đổi dữ liệu cần thêm `media:write` (kiểm tra ở use case).
- `version` trong response asset là optimistic lock; gửi lại dưới dạng `expectedVersion` khi activate/deprecate. Sai → `409 MEDIA_ASSET_VERSION_CONFLICT`, `context.currentVersion`.
- Field ảnh (`mimeType`, `width`, `height`, `sha256`) luôn lấy từ bytes, không từ khai báo của client.
- `url` là đường dẫn public bất biến `/media/{assetId}/{versionId}.{ext}` (01 mục 13.3).

## 30. Tạo logical MediaAsset

```http
POST /api/wiki/v1/admin/media/assets
```

Scope: `media:write`.

Request (`source` tùy chọn; `type` mặc định `OTHER`; `url` chỉ nhận http(s), chỉ lưu, không bao giờ fetch):

```json
{
  "semanticType": "HERO_PORTRAIT",
  "source": {
    "type": "OFFICIAL",
    "label": "Garena press kit",
    "url": "https://...",
    "observedAt": "2026-10-01T00:00:00Z",
    "note": "..."
  }
}
```

`201 Created`, `Location: .../admin/media/assets/{assetId}`, body là asset detail (mục 30.1) với `state = ACTIVE`, `version = 0`, `currentVersionId = null`.

### 30.1 Đọc asset

```http
GET /api/wiki/v1/admin/media/assets/{assetId}
GET /api/wiki/v1/admin/media/assets?semanticType=HERO_PORTRAIT&page=0&size=20
```

Detail:

```json
{
  "id": "...",
  "semanticType": "HERO_PORTRAIT",
  "state": "ACTIVE",
  "version": 3,
  "currentVersionId": "...",
  "versions": [
    {
      "id": "...", "versionNo": 2, "state": "READY",
      "mimeType": "image/webp", "width": 4096, "height": 6400, "sizeBytes": 1234567,
      "sha256": "...", "url": "/media/{assetId}/{versionId}.webp",
      "current": true, "createdAt": "...", "activatedAt": "..."
    }
  ],
  "provenance": [{ "id": "...", "versionId": null, "type": "OFFICIAL", "label": "...", "url": "..." }],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Danh sách trả `PageSlice` (mục 46), mỗi item có `currentUrl`, sắp xếp mới nhất trước.

---

## 31. Yêu cầu upload MediaAssetVersion

```http
POST /api/wiki/v1/admin/media/assets/{assetId}/version-uploads
```

Request:

```json
{
  "fileName": "portrait.webp",
  "contentType": "image/webp",
  "sizeBytes": 1234567
}
```

`201 Created`, `Location: .../admin/media/uploads/{uploadId}`:

```json
{
  "uploadId": "...",
  "assetId": "...",
  "objectKey": "incoming/...",
  "method": "PUT",
  "uploadUrl": "https://...presigned...",
  "headers": { "content-type": "image/webp" },
  "expiresAt": "...",
  "completeBefore": "..."
}
```

Caller upload trực tiếp object storage bằng `method`, gửi **đúng** `headers` (chữ ký bao gồm chúng). `expiresAt` là hạn của URL; `completeBefore` là hạn gọi complete.

Không xem request content type là trusted final MIME; đây chỉ là bước lọc sớm:

- `contentType` ngoài PNG/JPEG/WebP → `422 INVALID_MEDIA_OBJECT`, `context.reason = UNSUPPORTED_FORMAT`, `errors[0].path = contentType`.
- `sizeBytes` vượt giới hạn → `422 INVALID_MEDIA_OBJECT`, `context.reason = TOO_LARGE`, `context.maxBytes`.
- Asset không `ACTIVE` → `409 MEDIA_ASSET_NOT_ACTIVE`.

Trạng thái upload (dùng khi mất response, mục 55):

```http
GET /api/wiki/v1/admin/media/uploads/{uploadId}
```

trả `state` (`REQUESTED`, `VALIDATING`, `READY`, `REJECTED`, `EXPIRED`), `versionId`, `errorCode`, `completeBefore`.

---

## 32. Complete upload

```http
POST /api/wiki/v1/admin/media/uploads/{uploadId}/complete
```

Backend:

1. stat object;
2. đọc stream có giới hạn: chữ ký file, header, kích thước, SHA-256 (không decode pixel, 01 mục 13.5);
3. kiểm tra actual MIME;
4. kiểm tra dimensions/pixel count/size policy;
5. cùng SHA-256 đã có trên asset → trả version cũ (`duplicate = true`);
6. copy sang `assets/{assetId}/{versionId}.{ext}`, tạo `MediaAssetVersion` READY; version đầu tiên được activate tự động;
7. ghi provenance/audit.

`200 OK`:

```json
{
  "assetId": "...",
  "versionId": "...",
  "versionNo": 1,
  "state": "READY",
  "mimeType": "image/webp",
  "width": 4096,
  "height": 6400,
  "sizeBytes": 1234567,
  "sha256": "...",
  "url": "/media/{assetId}/{versionId}.webp",
  "current": true,
  "duplicate": false
}
```

Lỗi:

| Trường hợp | Response | Upload sau đó |
|---|---|---|
| Chưa có object (chưa PUT xong) | `422 MEDIA_OBJECT_NOT_FOUND` | vẫn mở, gọi lại được |
| Storage lỗi tạm thời | `503 STORAGE_UNAVAILABLE` | vẫn mở, gọi lại được |
| Bytes không hợp lệ | `422 INVALID_MEDIA_OBJECT`, `context.reason` ∈ `EMPTY`, `UNSUPPORTED_FORMAT`, `CORRUPT_IMAGE`, `TOO_LARGE`, `DIMENSION_TOO_LARGE`, `TOO_MANY_PIXELS` | `REJECTED`; gọi lại → `409 MEDIA_UPLOAD_REJECTED` |
| Quá `completeBefore` | `409 MEDIA_UPLOAD_EXPIRED` | `EXPIRED` |
| Request khác đang complete | `409 MEDIA_UPLOAD_IN_PROGRESS` | không đổi |
| Đã thành công trước đó | `200` cùng version | `READY` |

---

## 33. Activate MediaAssetVersion

```http
POST /api/wiki/v1/admin/media/assets/{assetId}/versions/{versionId}/activate
```

Request:

```json
{ "expectedVersion": 3 }
```

Chỉ dùng khi version là cùng semantic asset.

Kết quả (`200`, asset detail):

```text
MediaAsset.currentVersionId -> versionId
```

Không làm HeroRevision thay đổi. Activate version đang dùng là no-op. Version không thuộc asset → `404 MEDIA_VERSION_NOT_FOUND`; version không `READY` → `409 MEDIA_VERSION_NOT_READY`.

---

## 34. Register existing object

Nếu bạn đã có asset được import vào object storage trước:

```http
POST /api/wiki/v1/admin/media/imports/register
```

```json
{
  "assetId": "...",
  "objectKey": "imports/heroes/nakroth/portrait.webp",
  "source": { "type": "GAME_CLIENT", "label": "Client 1.62" }
}
```

- `objectKey` phải nằm dưới `imports/`, chỉ gồm chữ, số, `.`, `_`, `-`, `/`; khác đi → `400 INVALID_REQUEST`, `errors[0].code = NOT_ALLOWED`.
- Backend validate bytes như mục 32 và tạo version metadata; object nguồn được giữ nguyên.
- `201 Created` khi tạo version mới; `200 OK` với `duplicate = true` khi asset đã có đúng bytes này (chạy lại import an toàn).

Không nhận arbitrary external URL rồi coi nó là runtime object.

---

## 35. Media usage reverse lookup

```http
GET /api/wiki/v1/admin/media/assets/{assetId}/usages
```

Query:

```text
scope=CURRENT|DRAFT|HISTORICAL|ANY   (mặc định ANY)
```

Response:

```json
{
  "assetId": "...",
  "counts": {
    "current": 2,
    "draft": 1,
    "historical": 3
  },
  "items": [
    {
      "ownerDomain": "HERO",
      "ownerType": "HERO",
      "ownerId": "...",
      "revisionId": "...",
      "propertyRole": "PORTRAIT",
      "scope": "CURRENT"
    }
  ]
}
```

`counts` luôn tính trên toàn bộ usage; `scope` chỉ lọc `items`. Dữ liệu lấy trực tiếp từ các module sở hữu qua `MediaUsageProvider`; trước Phase 3 chưa module nào cung cấp nên kết quả rỗng.

---

## 36. Media deletion/deprecation

Baseline không hard-delete asset đang được tham chiếu.

```http
POST /api/wiki/v1/admin/media/assets/{assetId}/deprecate
```

```json
{ "expectedVersion": 3, "reason": "Replaced by the new official portrait" }
```

Nếu có CURRENT references:

```text
409 MEDIA_ASSET_IN_USE   (context.currentUsages)
```

Draft/historical reference không chặn deprecate. Asset đã `DEPRECATED`/`BLOCKED` → no-op. Sau khi deprecate, asset không nhận upload mới (`409 MEDIA_ASSET_NOT_ACTIVE`) và không được bind mới.

Historical asset/version chỉ purge khi retention policy chứng minh không cần tái tạo lịch sử.

---

# PHẦN F — ADMIN PATCH API

## 37. Tạo GamePatch

```http
POST /api/wiki/v1/admin/patches
```

Scope:

```text
patch:write
```

Request:

```json
{
  "code": "patch-1-63",
  "translations": [
    {
      "locale": "vi-VN",
      "title": "...",
      "summary": "..."
    }
  ]
}
```

---

## 38. Tạo PatchVariant

```http
POST /api/wiki/v1/admin/patches/{patchId}/variants
```

```json
{
  "rulesetId": "...",
  "variantCode": "GLOBAL",
  "rulesetOrdinal": 163
}
```

Ordinal phải unique/monotonic theo ruleset policy.

---

## 39. Record Hero patch change set

```http
POST /api/wiki/v1/admin/patch-variants/{variantId}/hero-changes
```

Request:

```json
{
  "heroId": "...",
  "fromHeroRevisionId": "HR20",
  "toHeroRevisionId": "HR21",
  "summaryTranslations": [
    {
      "locale": "vi-VN",
      "summary": "Điều chỉnh chỉ số và kỹ năng."
    }
  ],
  "changes": [
    {
      "type": "STAT",
      "statKey": "HP",
      "oldValue": 3500,
      "newValue": 3600,
      "unit": "POINT",
      "changeKind": "BUFF"
    }
  ]
}
```

Auto diff có thể gợi ý payload nhưng không tự public mà không review.

---

## 40. Item/Arcana/... patch changes

Tương tự:

```http
POST /api/wiki/v1/admin/patch-variants/{variantId}/item-changes
POST /api/wiki/v1/admin/patch-variants/{variantId}/arcana-changes
POST /api/wiki/v1/admin/patch-variants/{variantId}/spell-changes
POST /api/wiki/v1/admin/patch-variants/{variantId}/enchantment-changes
```

Mỗi endpoint nhận domain-specific change shape.

---

## 41. Publish PatchVariant metadata/changelog

```http
POST /api/wiki/v1/admin/patch-variants/{variantId}/publish
```

`publish` khác `release`.

Patch/changelog có thể published nhưng chưa effective ở region.

---

## 42. Schedule PatchRelease

```http
POST /api/wiki/v1/admin/patch-variants/{variantId}/releases
```

Request:

```json
{
  "regionId": "...",
  "effectiveAt": "2026-09-29T04:00:00Z",
  "announcedAt": "2026-09-28T10:00:00Z",
  "sourceUrl": "https://..."
}
```

Backend validate ruleset assignment của region tại effective time.

---

## 43. Region/ruleset admin

```http
GET  /api/wiki/v1/admin/regions
POST /api/wiki/v1/admin/regions

GET  /api/wiki/v1/admin/rulesets
POST /api/wiki/v1/admin/rulesets

POST /api/wiki/v1/admin/regions/{regionId}/ruleset-assignments
```

Các endpoint này quyền cao, không sửa thường xuyên.

---

# PHẦN G — ERROR CONTRACT

## 44. ProblemDetail shape

```json
{
  "type": "about:blank",
  "title": "Revision version conflict",
  "status": 409,
  "detail": "The revision was modified by another request.",
  "instance": "/api/wiki/v1/admin/heroes/...",
  "code": "HERO_REVISION_VERSION_CONFLICT",
  "requestId": "...",
  "context": {
    "currentVersion": 8
  }
}
```

`type` mặc định `about:blank` (có thể không xuất hiện). `errors` và `context` chỉ có khi có dữ liệu.

### Stable fields

- HTTP status: transport/error class.
- `code`: machine-readable business/technical error identity; duy nhất toàn hệ thống.
- `title`: tên ngắn của loại lỗi, cố định theo `code`.
- `context`: dữ liệu có cấu trúc giúp client xử lý, ví dụ `currentVersion`, `existingDraftId`.
- `errors[]`: `path` (dạng `content.skills[1].name`), `code`, `message`.
- `requestId`: correlation, do server sinh, trùng header `X-Request-Id`.
- `detail`: fallback/debug text, không dùng làm branch key.

Mọi response lỗi có `Cache-Control: no-store`. Lỗi xảy ra ngoài Spring MVC (filter, `/error`) cũng theo đúng hình dạng này.

### Cách khai báo mã lỗi (implementation)

- Mỗi module có một enum implement `ApiErrorCode` (`name`, `status`, `title`), ví dụ `HeroErrorCode`, `MediaErrorCode`; đặt trong `internal/application`.
- Mã chung nằm ở `PlatformErrorCode`. `platform` không import mã của module nghiệp vụ.
- Ném `ApiException(code, detail[, errors][, context])` từ application/web; không trả `ResponseEntity` lỗi thủ công.
- Test `ErrorCodeUniquenessTests` chặn hai module khai báo trùng mã.

---

## 45. Error taxonomy

### Common

```text
INVALID_REQUEST
INVALID_QUERY_PARAMETER
INVALID_API_VERSION
MISSING_API_VERSION
UNAUTHENTICATED
FORBIDDEN
RESOURCE_NOT_FOUND
METHOD_NOT_ALLOWED
NOT_ACCEPTABLE
PAYLOAD_TOO_LARGE
UNSUPPORTED_MEDIA_TYPE
INTERNAL_ERROR
```

### Mã trong `errors[]` (cấp field)

```text
REQUIRED            thiếu tham số bắt buộc
INVALID_VALUE       sai kiểu/định dạng
UNKNOWN_FIELD       field JSON không được phép
UNKNOWN_PARAMETER   query parameter ngoài whitelist
REPEATED_PARAMETER  query parameter lặp lại
NOT_BLANK, MIN, MAX, SIZE, PATTERN, ...   tên ràng buộc Bean Validation dạng UPPER_SNAKE
```

Module có thể thêm mã field riêng, ví dụ `HERO_PORTRAIT_REQUIRED` cho checklist publish.

### Hero

```text
HERO_NOT_FOUND
HERO_CODE_EXISTS
HERO_DRAFT_ALREADY_EXISTS
HERO_REVISION_NOT_EDITABLE
HERO_REVISION_VERSION_CONFLICT
HERO_SECTION_REFERENCE_INVALID
HERO_PROFILE_INCOMPLETE
HERO_STATS_INCOMPLETE
HERO_SKILLS_INCOMPLETE
HERO_MEDIA_BINDING_INCOMPLETE
```

### Media

```text
MEDIA_ASSET_NOT_FOUND          404
MEDIA_ASSET_NOT_ACTIVE         409  context.state
MEDIA_ASSET_VERSION_CONFLICT   409  context.currentVersion
MEDIA_ASSET_IN_USE             409  context.currentUsages
MEDIA_VERSION_NOT_FOUND        404
MEDIA_VERSION_NOT_READY        409  context.state
MEDIA_UPLOAD_NOT_FOUND         404
MEDIA_UPLOAD_EXPIRED           409  context.expiresAt
MEDIA_UPLOAD_REJECTED          409  context.reason
MEDIA_UPLOAD_IN_PROGRESS       409
MEDIA_OBJECT_NOT_FOUND         422
INVALID_MEDIA_OBJECT           422  context.reason
STORAGE_UNAVAILABLE            503
```

### Patch/region

```text
PATCH_NOT_FOUND
PATCH_VARIANT_NOT_FOUND
PATCH_NOT_READY
PATCH_ALREADY_PUBLISHED
PATCH_RELEASE_CONFLICT
PATCH_RELEASE_RULESET_MISMATCH
NO_ACTIVE_PATCH_FOR_REGION
NO_RULESET_ASSIGNMENT
UNSUPPORTED_REGION
UNSUPPORTED_LOCALE
```

---

# PHẦN H — PAGINATION / FILTER / SORT

## 46. Pagination

Baseline:

```text
page = 0
size = 20
max size = 100
```

Response:

```json
{
  "items": [],
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0
}
```

Không expose trực tiếp Spring `Page` JSON format vì có thể đổi theo framework/version.

Cursor pagination có thể thêm cho feeds lớn sau này.

---

## 47. Sorting

Chỉ whitelist sort keys.

Ví dụ Hero:

```text
code,asc
code,desc
publishedAt,desc
```

Không truyền arbitrary DB column từ query vào ORDER BY.

Luôn có tie-breaker ổn định bằng ID khi cần.

---

## 48. Search

`q` phải:

- trim;
- length limit;
- parameterized query;
- escape wildcard nếu semantics là literal search;
- không ghép SQL string.

Localized search cần locale context rõ.

---

# PHẦN I — AUTHORIZATION

## 49. Public API

Public read endpoint không cần token trừ khi policy sản phẩm đổi.

Nếu caller tự gửi invalid Bearer token và security filter xử lý, có thể nhận 401; client public không cần gửi token.

---

## 50. Admin scopes

Baseline:

```text
catalog:read
hero:write
hero:publish
media:write
patch:write
patch:publish
item:write
item:publish
arcana:write
arcana:publish
spell:write
spell:publish
enchantment:write
enchantment:publish
region:admin
```

Ánh xạ vai trò → capability và cách kiểm tra: `01-BAN-DAC-TA-DU-AN.md` mục 20.4.

Controller annotation chỉ là tầng đầu; application use case cần policy check cho action quan trọng.

---

# PHẦN J — CACHE / CONDITIONAL HTTP

## 51. Current/resolver endpoints

Ví dụ:

```http
GET /api/wiki/v1/heroes/{id}/manifest?region=VN&locale=vi-VN
```

Response:

```http
ETag: "..."
Cache-Control: public, max-age=0, must-revalidate
```

Caller gửi:

```http
If-None-Match: "..."
```

Nếu current representation không đổi -> `304 Not Modified`.

Sau unpublish/no active state, phải kiểm tra visibility trước khi trả 304.

---

## 52. Revision-addressed endpoints

Ví dụ:

```http
GET /api/wiki/v1/heroes/{heroId}/combat-stat-revisions/S9
```

S9 immutable sau publish nên có thể:

```http
Cache-Control: public, max-age=31536000, immutable
```

Tùy deployment/CDN policy thực tế.

Không overwrite response semantics của cùng revision ID.

---

## 53. Media URLs

Public URL nên versioned/hash-addressed:

```text
/media/{assetId}/{assetVersionId}/...
```

hoặc CDN URL tương đương.

Không overwrite cùng URL bằng bytes khác nếu muốn cache lâu.

---

# PHẦN K — VERSION / CONCURRENCY

## 54. Expected version

Admin mutation gửi:

```json
{
  "expectedVersion": 7
}
```

Mismatch:

```http
409 Conflict
```

```text
code = HERO_REVISION_VERSION_CONFLICT
```

Không auto retry write với version mới nếu chưa merge/review user changes.

---

## 55. Idempotency

Các POST publish/create không mặc định retry-safe.

Có thể bổ sung `Idempotency-Key` cho upload session/payment-like flows nếu thực tế cần.

Nếu mất response create draft/upload:

- query trạng thái server;
- không tạo mù lần nữa.

---

# PHẦN L — HTTP STATUS BASELINE

## 56. Status mapping

| Status | Dùng cho |
|---|---|
| 200 | GET/PUT/command thành công có response |
| 201 | tạo identity/draft/upload session/resource |
| 204 | command thành công không cần body nếu chọn convention này |
| 304 | conditional public GET không đổi |
| 400 | parse/schema/query syntax sai |
| 401 | authentication fail |
| 403 | thiếu quyền |
| 404 | resource không tồn tại/không visible |
| 409 | lifecycle/version/unique conflict |
| 413 | payload quá lớn |
| 415 | content type không hỗ trợ |
| 422 | request syntax đúng nhưng vi phạm business validation |
| 429 | rate limit nếu được triển khai |
| 500 | lỗi server không dự kiến |
| 503 | dependency tạm unavailable, ví dụ object storage |

---

## 57. Quy tắc cuối cùng của API

```text
Public current API -> resolve region/ruleset/patch
Locale -> chỉ translation
Historical patch changes -> game semantic history
Admin revision history -> WikiAOV editing history
Media version API -> technical asset history
Stable error code -> logic
Human detail -> fallback
Published revision ID -> immutable identity/cache token
```

Ba tài liệu `Cấu trúc dự án`, `Database dự án`, `API dự án` là bộ đặc tả backend hiện hành; khi kiến trúc thay đổi, cập nhật trực tiếp ba file này và dùng Git history/commit/ADR trong repository để lưu lý do thay đổi, không tạo song song bộ docs v1/v2 mới.
