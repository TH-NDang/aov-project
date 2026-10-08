# WikiAOV Backend — API dự án

**Base path:** `/api/wiki/v1` (tiền tố theo service, xem mục 3.6 của `01-BAN-DAC-TA-DU-AN.md`)  
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

---

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

## 30. Tạo logical MediaAsset

```http
POST /api/wiki/v1/admin/media/assets
```

Scope:

```text
media:write
```

Request:

```json
{
  "semanticType": "HERO_PORTRAIT",
  "source": {
    "label": "...",
    "url": "https://..."
  }
}
```

Response có `assetId`.

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

Response:

```json
{
  "uploadId": "...",
  "objectKey": "incoming/...",
  "method": "PUT",
  "uploadUrl": "https://...presigned...",
  "expiresAt": "..."
}
```

Caller upload trực tiếp object storage.

Không xem request content type là trusted final MIME.

---

## 32. Complete upload

```http
POST /api/wiki/v1/admin/media/uploads/{uploadId}/complete
```

Backend:

1. stat object;
2. bounded read/decode;
3. kiểm tra actual MIME;
4. kiểm tra dimensions/pixel count/size policy;
5. SHA-256;
6. tạo `MediaAssetVersion` READY;
7. ghi provenance/audit.

Response:

```json
{
  "assetId": "...",
  "versionId": "...",
  "state": "READY",
  "mimeType": "image/webp",
  "width": 4096,
  "height": 6400,
  "sha256": "..."
}
```

Storage lỗi tạm thời -> `503 STORAGE_UNAVAILABLE`.

---

## 33. Activate MediaAssetVersion

```http
POST /api/wiki/v1/admin/media/assets/{assetId}/versions/{versionId}/activate
```

Chỉ dùng khi version là cùng semantic asset.

Kết quả:

```text
MediaAsset.currentVersionId -> versionId
```

Không làm HeroRevision thay đổi.

---

## 34. Register existing object

Nếu bạn đã có asset được import vào object storage trước:

```http
POST /api/wiki/v1/admin/media/imports/register
```

Request chứa controlled `objectKey`, asset/semantic context; backend vẫn validate bytes và tạo version metadata.

Không nhận arbitrary external URL rồi coi nó là runtime object.

---

## 35. Media usage reverse lookup

```http
GET /api/wiki/v1/admin/media/assets/{assetId}/usages
```

Query:

```text
scope=CURRENT|DRAFT|HISTORICAL|ANY
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
      "revisionId": "M5",
      "propertyRole": "PORTRAIT",
      "scope": "CURRENT"
    }
  ]
}
```

Usage index/projection không thay source-of-truth bindings.

---

## 36. Media deletion/deprecation

Baseline không hard-delete asset đang được tham chiếu.

Có thể expose:

```http
POST /api/wiki/v1/admin/media/assets/{assetId}/deprecate
```

Nếu có CURRENT references và policy không cho phép:

```text
409 MEDIA_ASSET_IN_USE
```

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
  "title": "Conflict",
  "status": 409,
  "detail": "The revision was modified by another request.",
  "instance": "/api/wiki/v1/admin/heroes/...",
  "code": "REVISION_VERSION_CONFLICT",
  "requestId": "...",
  "parameters": {
    "currentVersion": 8
  },
  "errors": []
}
```

### Stable fields

- HTTP status: transport/error class.
- `code`: machine-readable business/technical error identity.
- `parameters`: structured rendering/debug data.
- `errors[].path`: field/path validation error.
- `requestId`: correlation.
- `detail`: fallback/debug text, không dùng làm branch key.

---

## 45. Error taxonomy

### Common

```text
INVALID_REQUEST
INVALID_QUERY_PARAMETER
PAYLOAD_TOO_LARGE
UNSUPPORTED_MEDIA_TYPE
UNAUTHENTICATED
FORBIDDEN
INTERNAL_ERROR
```

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
MEDIA_ASSET_NOT_FOUND
MEDIA_VERSION_NOT_FOUND
MEDIA_VERSION_NOT_READY
MEDIA_ASSET_IN_USE
MEDIA_UPLOAD_EXPIRED
MEDIA_OBJECT_NOT_FOUND
INVALID_MEDIA_OBJECT
STORAGE_UNAVAILABLE
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
```

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
