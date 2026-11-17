# WikiAOV Backend — API dự án

**Base path:** `/api/wiki/v1` (tiền tố theo service, xem mục 3.6 của `01-BAN-DAC-TA-DU-AN.md`; phiên bản theo mục 1.1)  
**Format:** JSON UTF-8; chuỗi gửi lên được chuẩn hóa Unicode NFC trước khi lưu (mục 1 của `02-DATABASE-DU-AN.md`);
lỗi dùng `application/problem+json`.  
**Phạm vi:** Public read APIs + authenticated admin APIs cho backend hiện hành.  
**Tài liệu liên quan:** `01-BAN-DAC-TA-DU-AN.md`, `02-DATABASE-DU-AN.md`


### Hợp đồng domain core đang triển khai

Các mục bên dưới vẫn mô tả đích toàn backend; bảng này xác định phần đã có implementation.

| Nhóm | API hiện có |
|---|---|
| Patch authoring | POST admin/rulesets, admin/regions/{id}/ruleset-assignments, admin/patches, admin/patches/{id}/variants, admin/patch-variants/{id}/publish, admin/patch-variants/{id}/releases |
| Ruleset đọc | GET admin/rulesets |
| Hero admin | GET/POST admin/heroes; GET admin/heroes/publish-readiness; GET admin/heroes/{id}; GET admin/heroes/{id}/revisions; GET revision/draft detail; POST drafts; PUT sáu section; POST publish/discard |
| Hero public | GET heroes; heroes/{id}; heroes/{id}/manifest; heroes/{id}/changes |
| Immutable section | hero-profile-revisions, hero-overview-rating-revisions, hero-stats-revisions, hero-skills-revisions, hero-skins-revisions, hero-media-binding-revisions |
| Patch history | POST admin/patch-variants/{id}/hero-changes; POST admin/hero-changes/{changeSetId}/mechanics/{changeId}/previous; GET patches, patches/{id}, patches/{id}/changes |

Tất cả path trong bảng nối sau `/api/wiki/v1/`. POST tạo trả 201; publish variant trả 204;
Hero mutation/publish/discard trả 200 với composition revision mới nhất. Create Hero trả
`heroId` (identity) và `id` (draft revision); không nhầm hai ID này. Admin detail trả
`{revision, content}`; `revision.sections` có key profile/overviewRatings/combatStats/skills/skins/mediaBindings.
Admin list phân trang theo code mặc định; bộ lọc thay đổi gameplay/tìm kiếm được mô tả ở mục Danh mục tướng bên dưới. Revision history admin trả array, giữ thứ tự revision_no giảm dần.

Section PUT dùng payload phẳng, `expectedDraftVersion` và full section content; publish/discard dùng
`expectedVersion`. `changeNote` tùy chọn. `sources` có thể bỏ qua và mặc định array rỗng.
Profile: `{translations:[{locale,name,title?,summary?,lore?}],roles:["ASSASSIN"],positions?:["DRAGON"]}`.
`positions` nhận `TOP`, `MID`, `JUNGLE`, `DRAGON`, `SUPPORT`; bỏ trống nghĩa là chưa có vị trí đi.
Skills: `{skills:[{skillKey,kind,formKey?,displayOrder,iconAssetId?,stateIcons?,
translations:[{locale,name,description,summary?}],effects:[]}]}`. `summary` là tóm tắt dễ hiểu của kỹ năng (mục
"Tóm tắt kỹ năng — V073"). `stateIcons` là `[{assetId,label}]`, tối đa 10 mỗi
kỹ năng, asset semantic `HERO_SKILL_ICON`, nhãn 1–64 ký tự; nhãn không trùng (không phân biệt hoa thường), asset
không trùng nhau và không trùng `iconAssetId`, sai trả 422 `HERO_INVALID_CONTENT`. Bỏ trống nghĩa là danh sách rỗng;
đọc luôn trả mảng. Đọc Skills còn có `traits` và đọc Profile có `strengths`, `weaknesses`, `counterTips` theo locale
(ADR-029); PUT Skills/Profile giữ nguyên chúng, chỉ endpoint riêng ở mục Đánh giá tướng đổi được.
Skins: `{skins:[{skinKey,displayOrder,artAssetId?,rarityCode?,translations:[{locale,name,description?,acquisitionNote?}]}]}`.
Effect gồm effectType và metadata. Source gồm label, sourceUrl?, observedAt?, verificationState
(UNVERIFIED/VERIFIED), note?. Hero media bindings nhận HEAD/PORTRAIT/SPLASH asset UUID.

Create/fork và mutation yêu cầu scope như các mục nghiệp vụ. POST ruleset/assignment cần region:admin;
variant/release publish cần patch:publish. Không có API sửa một revision đã PUBLISHED.
Khi không chỉ định sourceRevisionId, fork chọn source theo gameplay applicability rồi publication sequence;
khi chưa có active context phải truyền source tường minh.

Public Hero list nhận region/locale/page/size/q/role/sort, chỉ sort code,asc hoặc code,desc. Sort khác, role lạ,
`q` quá 120 ký tự hay page/size ngoài giới hạn trả 400 INVALID_QUERY_PARAMETER.
Hero detail/manifest nhận region/locale. Section resource nhận locale, chỉ trả section đã có published
composition tham chiếu; nội dung không trả source/actor. Các resource section không resolve current media URL;
Hero detail/list resolve asset current version để ETag đổi khi media được nâng chất lượng.
Fallback locale: exact → vi-VN → locale đầu theo thứ tự chữ; response ghi actualLocale/fallbackApplied.

Patch APIs nhận region/locale, list và changes nhận page/size; changes hiện chỉ có provider HERO.
Không có provider domain khác trả INVALID_QUERY_PARAMETER. Patch detail trả metadata của release đã schedule
cho đúng region (có thể chưa effective). Hero changes chỉ gồm các release đã effective trong region tại now.
Changelog có type HERO_STAT_CHANGE/HERO_SKILL_CHANGE/HERO_ROLE_CHANGE/HERO_VISUAL_CHANGE/HERO_MECHANIC_CHANGE/HERO_OTHER_CHANGE;
request admin vẫn dùng discriminator STAT/SKILL/ROLE/VISUAL/MECHANIC/OTHER. Change summary fallback theo locale.
STAT dùng statKey/oldValue/newValue/unit, SKILL dùng skillKey/fieldKey/oldValue/newValue,
ROLE dùng roleCode/added, VISUAL dùng mediaRole/oldAssetId/newAssetId, MECHANIC dùng mechanicKey/description,
OTHER dùng description; tất cả cần changeKind. Khi đọc, dòng MECHANIC có thêm `previous`
(`{description, sourceUrl, recordedAt}` hoặc `null`): mô tả trước khi đổi ghi sau theo mục 39b. Change set là dữ liệu biên tập, không tự tạo khi publish.

Các API Hero/Patch chưa hỗ trợ query at, nên không nhận query này. Quy tắc resolver theo thời điểm
vẫn được thực hiện qua contract nội bộ GameplayContexts. Region update, catalog authoring khác,
patch change dispatcher chi tiết và counts tổng hợp đa domain chưa triển khai.

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
| POST /login | `{ "username": "editor", "password": "...", "otp": "123456" }`; `otp` tùy chọn | Access token + thời hạn; đặt refresh cookie |
| POST /refresh | Refresh cookie, không body | Access token mới + thời hạn; cập nhật refresh cookie |
| POST /logout | Refresh cookie, không body | 204 sau khi revoke thành công; xóa cookie |
| POST /google | Không body | `{ "state": "...", "authorizationUrl": "..." }`; đặt cookie ràng buộc flow |
| GET /google/callback | state, code hoặc error; tùy chọn error_description, session_state, iss | Kiểm tra state một lần và cookie, đổi code, đặt refresh cookie, 303 về trang hoàn tất cố định |

Response token: `{ "accessToken": "...", "expiresIn": 300 }`. Không có refresh token trong JSON.
Refresh cookie: `aov_admin_refresh`, HttpOnly, SameSite=Lax, Secure (trừ local), path `/api/wiki/`;
Max-Age theo refresh_expires_in từ IdP. Không có Domain. Không nhận query ở các endpoint trừ callback.
Tên đăng nhập tối đa 254 ký tự, mật khẩu tối đa 1024 ký tự; `otp` null hoặc đúng 6 chữ số, gửi tới Keycloak
dưới tên `totp` cho tài khoản đã bật xác thực hai bước (ADR-028). Không lưu và không log các giá trị này.

- 401 AUTH_INVALID_CREDENTIALS: sai thông tin, thiếu/sai mã xác thực hai bước hoặc tài khoản cần hoàn tất bước
  xác minh ở Keycloak. Keycloak trả `400` hoặc `401 invalid_grant` đều map về mã này.
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

Body PUT: `{displayName, biography, locale, timeZone, dateFormat?, currency, avatarAssetId, expectedVersion}`. `dateFormat` nhận `AUTO`, `DMY`, `MDY`, `YMD`; bỏ trống thì giữ nguyên giá trị đang lưu.
`currency` là mã ISO 4217 viết hoa và không bắt buộc; bỏ trống hoặc null thì giữ giá trị đã lưu.
Avatar null để gỡ. `expectedVersion` bắt buộc; 0 chỉ khi tạo. Không nhận issuer, subject hay capability từ body.
Tên tối đa 80 ký tự, giới thiệu 1000, locale 35, múi giờ 64. Response hồ sơ gồm
`id, displayName, biography, locale, timeZone, dateFormat, currency, avatarAssetId, avatarUrl, version, createdAt, updatedAt`.
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

### 1.5 Cài đặt bảo mật tài khoản (ADR-028)

Base `/api/wiki/v1/users/me/security`, Bearer JWT đã xác minh, chỉ tài khoản HUMAN (service account nhận
`403 FORBIDDEN`). Mọi response `no-store`, không nhận query parameter. Dùng chung cho các app công khai.

| Method/path | Request | Response |
|---|---|---|
| GET / | — | Tổng quan bảo mật |
| POST /password-change | `{language?}` hoặc không body | 201 phiếu mã đã gửi |
| POST /password-change/{challengeId}/confirm | `{code, newPassword, signOutOtherSessions?, language?}` | 200 `{otherSessions, signedOut}` sau khi Keycloak nhận mật khẩu |
| GET /sessions | — | Danh sách phiên, phiên hiện tại đứng đầu |
| DELETE /sessions/{sessionId} | — | 204 sau khi đăng xuất phiên khác |
| POST /sessions/sign-out-others | Không body | `{ "signedOut": 2 }` |
| DELETE /two-factor/recovery-codes | — | 204; chỉ khi đã tắt OTP |

Tổng quan:

```json
{
  "email": "reader@example.com",
  "emailVerified": true,
  "password": { "set": true, "updatedAt": "2026-11-09T03:00:00Z" },
  "passwordChangeAvailable": true,
  "twoFactor": {
    "enabled": true,
    "credentialId": "keycloak-credential-id",
    "label": "Điện thoại",
    "createdAt": "2026-11-09T03:05:00Z",
    "recoveryCodes": { "credentialId": "keycloak-credential-id", "remaining": 12, "total": 12, "createdAt": "2026-11-09T03:06:00Z" }
  }
}
```

`email` có thể null; `passwordChangeAvailable` false khi tài khoản không có email hoặc server chưa cấu hình gửi email.
`twoFactor.credentialId` là id credential OTP trong Keycloak, frontend dùng cho `kc_action=delete_credential:{id}`;
`recoveryCodes` null khi chưa tạo. Khi có nhiều OTP, trả cái tạo sớm nhất.

Đổi mật khẩu:

- Tạo phiếu trả `{challengeId, emailHint, expiresAt, resendAvailableAt}`; `emailHint` đã che (`r•••r@example.com`).
  Mã 6 chữ số, hạn 10 phút, phiếu mới vô hiệu phiếu cũ. Giới hạn 1 phiếu/60 giây, 5 phiếu/giờ mỗi tài khoản.
- `language` (`vi`/`en`, mặc định `vi`) chỉ chọn ngôn ngữ email. Xác nhận: `code` đúng 6 chữ số, `newPassword` 8–1024 ký tự;
  `signOutOtherSessions` mặc định true khi bỏ trống. `otherSessions` là `SIGNED_OUT`, `KEPT` hoặc `FAILED` (mật khẩu đã đổi
  nhưng chưa đăng xuất hết phiên khác; giao diện nhắc dùng nút đăng xuất thiết bị khác).
  Mật khẩu đi thẳng tới Keycloak, không lưu, không log. Thành công thì phiếu thành `USED`, ghi audit
  `USER_PASSWORD_CHANGED` (không có mật khẩu/mã) và gửi email thông báo.
- 409 USER_EMAIL_MISSING: tài khoản Keycloak chưa có email.
- 429 USER_PASSWORD_CODE_RATE_LIMITED: gửi mã quá dày; context `retryAfterSeconds` là số giây cần chờ.
- 404 USER_PASSWORD_CHALLENGE_NOT_FOUND: không có phiếu hoặc phiếu của tài khoản khác.
- 400 USER_PASSWORD_CODE_INVALID: sai mã; context `attemptsRemaining`.
- 410 USER_PASSWORD_CODE_EXPIRED: phiếu hết hạn, đã dùng, bị thay bằng phiếu mới, gửi lỗi hoặc hết lượt thử.
- 409 USER_PASSWORD_CHANGE_IN_PROGRESS: một request khác đang áp dụng cùng phiếu.
- 422 USER_PASSWORD_REJECTED: Keycloak từ chối theo password policy; context `policy` là khóa lỗi của Keycloak
  (chỉ chữ cái). Phiếu trở về chờ, dùng lại cùng mã với mật khẩu khác khi còn hạn.
- 503 USER_MAIL_UNAVAILABLE: chưa cấu hình hoặc không gửi được email; phiếu thành `FAILED`.

Phiên:

```json
{
  "sessions": [
    {
      "id": "keycloak-session-id",
      "current": true,
      "ipAddress": "203.0.113.10",
      "startedAt": "2026-11-09T02:00:00Z",
      "lastAccessAt": "2026-11-09T03:10:00Z",
      "applications": ["aov-wiki"],
      "device": { "browser": "Chrome/130.0", "os": "Windows", "osVersion": "10", "device": "Other", "mobile": false }
    }
  ],
  "deviceDetails": true
}
```

Phiên hiện tại theo claim `sid`. `device` null và `deviceDetails` false khi Keycloak không trả được thông tin thiết bị;
danh sách vẫn đủ phiên. `applications` là client id Keycloak đã dùng phiên. Chưa có vị trí địa lý.

- 404 USER_SESSION_NOT_FOUND: phiên không tồn tại hoặc không thuộc tài khoản.
- 409 USER_SESSION_CURRENT: muốn đăng xuất phiên hiện tại thì dùng luồng đăng xuất của app.
- Đăng xuất ghi audit `USER_SESSION_SIGNED_OUT` / `USER_OTHER_SESSIONS_SIGNED_OUT` với số phiên, không ghi IP.

Xác thực hai bước: bật, xem mã khôi phục, tạo lại mã và tắt chạy trên Keycloak bằng `kc_action`
(`CONFIGURE_TOTP`, `CONFIGURE_RECOVERY_AUTHN_CODES`, `delete_credential:{id}`; tạo lại và tắt kèm `max_age=0`).
Sau khi tắt OTP, frontend gọi `DELETE /two-factor/recovery-codes` để xóa mã khôi phục còn lại.

- 409 USER_TWO_FACTOR_ACTIVE: tài khoản vẫn còn OTP nên không xóa mã khôi phục qua API này.

Lỗi chung: 503 USER_ACCOUNT_PROVIDER_UNAVAILABLE khi Keycloak hoặc client `wiki-service` chưa sẵn sàng;
không trả nội dung lỗi gốc của Keycloak.

## 2. Common request context

### Region

Public gameplay read thường nhận:

```text
region=VN
```

Danh mục thị trường khởi đầu: `VN`, `TH`, `TW`, `ID`, `GLOBAL` theo 01 mục 11.1.1.
khả năng tra cứu thực tế phụ thuộc cấu hình và dữ liệu đã phát hành của từng region.
Không suy ra `region` từ locale, múi giờ trình duyệt hoặc hồ sơ người dùng; không âm thầm chuyển
thị trường chưa có dữ liệu sang VN. Locale/múi giờ mặc định của hồ sơ không phải danh mục thị trường game.

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
      "positions": ["DRAGON"],
      "head": {
        "assetId": "...",
        "semanticType": "HERO_HEAD",
        "state": "ACTIVE",
        "currentVersion": {
          "versionId": "...",
          "mimeType": "image/png",
          "width": 120,
          "height": 120,
          "url": "https://..."
        }
      },
      "portrait": {
        "assetId": "...",
        "semanticType": "HERO_PORTRAIT",
        "state": "ACTIVE",
        "currentVersion": {
          "versionId": "...",
          "mimeType": "image/png",
          "width": 278,
          "height": 436,
          "url": "https://..."
        }
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
`head` và `portrait` là các trường tùy chọn theo binding của bản tướng được chọn, cùng cấu trúc
`MediaAssetReference`. Không trả trường ảnh khi chưa có binding, asset không còn hoạt động hoặc
chưa có phiên bản hiện hành; không thay `portrait` bằng ảnh `head`. Chỉ tải metadata ảnh cho trang
kết quả đang trả, gộp HEAD/PORTRAIT qua một lần đọc Media theo lô; không tải detail cho từng tướng.

### Tướng nhiều dạng (ADR-024)

Danh sách mặc định trả thứ người đọc duyệt: tướng không có dạng và tướng chứa dạng (ví dụ `flowborn`). Dạng
(`flowborn-ad`, `flowborn-mid`) không thành mục riêng mà nằm trong `forms` của tướng chứa nó:

```text
item của tướng chứa dạng = {
  id, code, revisionId, unscopedBaseline, name, actualLocale, head?, portrait?,
  roles, positions,            hợp của các dạng đã xuất bản, theo thứ tự dạng
  forms: [{id, code, revisionId, unscopedBaseline, name, actualLocale, formKey, roles, positions, head?, portrait?}]
}
```

`forms` chỉ gồm dạng đã xuất bản trong cùng context, theo thứ tự hiển thị; dạng đầu là dạng mặc định. Tướng chứa
dạng chỉ xuất hiện khi chính nó và ít nhất một dạng đã xuất bản. `role` khớp khi một dạng có vai trò đó; `q` khớp
mã/tên của tướng hoặc của một dạng. HEAD/PORTRAIT của tướng và các dạng trên trang được đọc trong cùng một lần
`MediaAssets.findAll`.

`playable=true` trả thứ người chơi chọn trong trận: tướng không có dạng và từng dạng, không có tướng chứa dạng. Mục
của dạng có thêm `parent: {id, code, formKey}`. `community-service` đọc danh mục tướng cho giải đấu bằng tham số này,
nên lượt chọn/cấm tiếp tục lưu UUID của dạng.

### Thị trường, ngôn ngữ và mốc xem danh mục wiki

`GET /api/wiki/v1/catalog-context?region=VN&locale=vi-VN` là API công khai dành cho bộ chọn của wiki.
Chỉ chấp nhận hai tham số `region`, `locale`; locale UI hiện hỗ trợ `vi-VN`, `en-US`.
Response gồm `regions` (cùng hợp đồng `/regions`), `locales:[{code,name,nativeName}]`,
`seasons:[{id,code,name,ordinal,current,patches}]` và `current:{rulesetId,seasonId?,patchVariantId}`.
Mỗi patch có `{id,code,title,rulesetId,ordinal,published,regionalDate?,unknownDate}`;
`id` là UUID patch variant. Chỉ trả patch và variant đã công bố trong ruleset hiện tại của thị trường,
đã đến thời điểm công bố và không vượt ordinal đang có hiệu lực. Không suy ra ngày phát hành từ
thời điểm nhập liệu: `regionalDate` lấy từ lịch thị trường đã xác nhận; mốc quan sát chưa rõ ngày
(ví dụ dữ liệu nền S3) giữ `null` và `unknownDate=true`. Phạm vi này chưa cam kết lịch sử các ruleset cũ.

Các API public `/heroes`, `/heroes/{id}`, `/heroes/{id}/manifest`, `/skins`,
`/{items|arcana|enchantments|spells}` và chi tiết tương ứng, `/spells/archived`,
`/reference-catalog`, `/reference-skills` nhận thêm `seasonId?`, `patchVariantId?`, `includeUnscoped=false`.
Chọn mùa không bắt buộc chọn patch: backend lấy patch công bố cuối cùng đủ điều kiện trong mùa đó.
Nếu gửi cả hai, patch phải thuộc mùa; patch ngoài ruleset/thị trường, chưa công bố hoặc ở tương lai bị từ chối.
Bản ghi không thay đổi được kế thừa đến ordinal đã chọn, không chỉ trả các mục thay đổi trong patch.

Ở mốc lịch sử, tướng chưa có revision đã xuất bản ở hoặc trước mốc được đọc từ quan sát sau: revision đã xuất bản
có patch sớm nhất sau mốc, cùng ruleset, đã công bố và không vượt patch đang có hiệu lực của thị trường. Áp dụng
cho `/heroes`, `/heroes/{id}`, `/heroes/{id}/manifest` và `/skins`; mục (và từng dạng) dùng quan sát sau có
`laterObservation: {patchVariantId, patchCode}`, mục quan sát đúng mốc không có trường này. Tướng có change set
`introducesHero` ở patch sau mốc không xuất hiện. Không áp ngược change set vào nội dung
([ADR-016](adr/ADR-016-patch-note-changes.md)).

Không chọn mùa/patch giữ cách xem hiện tại, bao gồm dữ liệu nền chưa xác định patch. Khi chọn mốc lịch sử,
backend mặc định loại các quan sát có patch `null` để không trình bày chúng như sự kiện lịch sử đã được xác minh.
`includeUnscoped=true` là lựa chọn rõ ràng để xem thêm các quan sát đó; frontend phải ghi rõ chưa xác định patch,
không coi là khớp mùa. Tướng list/detail và trang phục có `unscopedBaseline`; kho trang bị dùng
`revision.effectiveFromPatchVariantId == null`. Tham chiếu và kỹ năng dùng cùng scope; khóa cache tách theo
thị trường, locale, ruleset, patch variant và việc cho phép quan sát chưa xác định patch.
Các section tướng bất biến vẫn đọc theo UUID đã được manifest chọn, không cần áp dụng lại bộ lọc thời gian.

### Danh mục trang phục công khai

```http
GET /api/wiki/v1/skins?region=VN&locale=vi-VN&page=0&size=24
```

Danh mục này dành cho thư viện Trang phục của wiki, không dùng API quản trị và không yêu cầu frontend
tải chi tiết từng tướng. `hero` là mã của tướng chứa dạng thì gồm trang phục chung của tướng và trang phục riêng của
mọi dạng; `heroCode` của mỗi mục vẫn là mã tướng sở hữu trang phục (ADR-024). Tham số được cho phép: `region` (mặc định `VN`), `locale` (mặc định `vi-VN`),
`q` (tối đa 120 ký tự), `hero` (mã tướng), `rarity` (mã nhãn bậc/chủ đề), `page` (từ 0), `size`
(1–60, mặc định 24). Tham số lạ, `q` quá dài, `page`/`size` ngoài giới hạn hay bộ lọc `hero`/`rarity` rỗng hoặc
quá dài trả 400 `INVALID_QUERY_PARAMETER`. Tìm kiếm không phân biệt dấu và hoa/thường, ghép các từ
trong tên/mã tướng và tên/khóa trang phục; các từ tìm kiếm có thể xuất hiện theo thứ tự khác nhau.

Response có cấu trúc:

```text
{
  page: {items: [Entry], page, size, totalElements},
  heroes: [{code, name}],
  rarities: [{code, name}]
}

Entry = {
  heroId, heroCode, heroName, heroHead?, skinKey, name, actualLocale?, rarityCode?,
  badge?: {code, name, actualLocale, icon?}, portrait?, head?, art?
}
```

Các trường ảnh dùng `MediaAssetReference`; ảnh thiếu, chưa có phiên bản hoặc không còn dùng được trả
`null`. Ảnh bậc được chọn từ đúng bản dịch của nhãn, không thay bằng icon của ngôn ngữ khác nếu nhãn
đã có bản dịch nhưng bản dịch đó thiếu ảnh. Tên tướng, tên trang phục và tên/ảnh nhãn chọn locale được
yêu cầu, rồi `vi-VN`, sau đó locale đầu tiên theo thứ tự chữ cái. `rarityCode` nối với `SkinBadge.code`;
không suy ra bậc từ tên trang phục hoặc tên file. Dữ liệu cũ thiếu bản dịch giữ mã làm tên dự phòng.

Backend chỉ lấy skin snapshot thuộc bản tướng `PUBLISHED`, đã công bố tại thời điểm hiện tại và không
vượt ordinal của gameplay context đang có hiệu lực. Cùng một tướng chọn ordinal cao nhất, rồi
`publicationSequence` cao nhất, thống nhất với hero detail. Không lộ bản nháp hoặc bản có hiệu lực ở
patch tương lai. Danh mục không bao gồm ảnh tướng gốc được lưu như trang phục mặc định: loại khóa
chuẩn `<heroCode>-mac-dinh-1` theo ADR-010 và các khóa cũ tương đương `<heroCode>-heroskin-1`,
`<heroCode>-default-1`, `default` trước khi tính bộ lọc, tổng số và phân trang. Quy tắc không phụ
thuộc ngôn ngữ hiển thị; trang phục thật thiếu nhãn bậc vẫn xuất hiện. Dữ liệu ảnh gốc trong bản
tướng và danh mục quản trị được giữ nguyên.

Danh sách sắp theo mã tướng, `displayOrder`, rồi `skinKey`; phân trang sau khi lọc. `heroes` và
`rarities` là các lựa chọn của toàn bộ danh mục công khai trong context, không bị cắt theo trang
hoặc điều kiện lọc hiện tại. Phần trang dùng `PageSlice`, client tính số trang từ `totalElements/size`.
Các phép chiếu revision, tên và binding được đọc theo lô bằng JPA; chỉ đọc metadata Media cho trang
đang trả, gộp ảnh trang phục, ảnh tướng và icon nhãn trong một lần `MediaAssets.findAll`.
Response dùng `Cache-Control: no-cache, public`; URL byte ảnh vẫn là URL phiên bản Media bất biến.

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

Tướng chứa dạng (ADR-024) trả nội dung chung của chính nó (tên, danh hiệu, tiểu sử, trang phục chung, ảnh; các
section gameplay rỗng) và thêm `forms`: mỗi dạng đã xuất bản trong cùng context, theo thứ tự, có đúng cấu trúc chi
tiết của một tướng (`id`, `code`, `revisionId`, `sections`, `content`, `media`, `skillMedia`, `skinMedia`…) cộng
`formKey`, `displayOrder`, `actualLocale`, `fallbackApplied` và không có `context` riêng. Gọi bằng UUID của một
dạng trả chi tiết của dạng đó kèm `parent: {id, code, formKey}` để client đưa người đọc về trang tướng.
Manifest có cùng `forms`/`parent`, không có nội dung.

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

### Tình trạng xuất bản của mọi tướng

```http
GET /api/wiki/v1/admin/heroes/publish-readiness
```

Quyền `catalog:read`, không nhận query parameter. Trả mảng mọi tướng theo `code`, không phân trang: số tướng có giới hạn và Admin cần đủ danh sách để đếm và lọc. Số truy vấn không tăng theo số tướng. Contract nằm trong `hero-authoring.openapi.json`.

Mỗi phần tử gồm:

```text
id, code
names           tên theo locale, lấy từ revision mới nhất chưa hủy
headUrl         ảnh Head của revision đó; null khi chưa có hoặc asset chưa dùng được
revisions       mọi revision chưa hủy, mới nhất trước
drafts[]        mỗi bản nháp đang mở, tối đa một bản cho mỗi ruleset
  revisionId
  observedStats  có thuộc tính ghi nhận từ ảnh đúng patch của bản nháp
  skinsSaved     bản nháp đã gắn section trang phục
  profile, overviewRatings, combatStats, skills, mediaBindings
```

Các section trong `drafts[]` chỉ giữ trường mà điều kiện xuất bản ở Admin đọc: không có cốt truyện, effect của kỹ năng, ảnh phụ hay nguồn. Section chưa gắn vào bản nháp trả `null`.

Mỗi phần tử còn có `holderId`, `formKey` (khi tướng là một dạng) và `formIds` (các dạng theo thứ tự khi tướng chứa
dạng). Danh sách `GET /admin/heroes` có cùng ba trường. Tướng chứa dạng không cần vai trò, đánh giá, chỉ số, kỹ năng
để xuất bản (ADR-024).

### Dạng của tướng (ADR-024)

```http
GET /api/wiki/v1/admin/heroes/{heroId}/forms
PUT /api/wiki/v1/admin/heroes/{heroId}/forms
```

`GET` (quyền `catalog:read`, không nhận query parameter) gọi được từ tướng chứa dạng, từ một dạng hoặc từ tướng
thường:

```text
heroId
holder    {id, code, names} của tướng chứa dạng; null với tướng thường
formKey   khóa dạng khi heroId là một dạng
forms[]   {id, code, formKey, displayOrder, names, roles, published, draftOpen}
```

Tên và vai trò lấy từ revision mới nhất chưa hủy của từng tướng, nên nút đổi dạng trong Admin khớp với bản đang soạn.

`PUT` (quyền `hero:publish`) thay toàn bộ danh sách: `{expectedForms: [uuid], forms: [{heroId, formKey}], changeNote?}`,
tối đa 20 dạng; thứ tự trong mảng là thứ tự hiển thị, dạng đầu là dạng mặc định. Có hiệu lực ngay, không qua bản
nháp, ghi audit `HERO_FORMS_UPDATED`. Quy tắc:

- `expectedForms` phải bằng danh sách hiện tại, nếu không trả `HERO_FORMS_CONFLICT` (409) kèm `currentForms`;
- mã của dạng phải là `<mã tướng>-<formKey>`; dạng không chứa dạng, tướng chứa dạng không là dạng, một tướng chỉ là
  dạng của một tướng (`HERO_INVALID_CONTENT`, 422);
- tướng chứa dạng không được có vai trò, vị trí, đánh giá, chỉ số hay kỹ năng trong revision chưa hủy nào
  (`HERO_FORM_PARENT_GAMEPLAY`, 422). Sau khi có dạng, lưu hoặc xuất bản các nội dung đó cho tướng chứa dạng cũng
  trả lỗi này;
- danh sách rỗng đưa tướng về tướng thường.

Thêm dạng mới (ví dụ `flowborn-tank`) = tạo tướng bằng `POST /admin/heroes` rồi thêm vào danh sách.

Endpoint không kết luận bản nháp đủ điều kiện hay chưa. Admin tự áp dụng cùng điều kiện với nút Xuất bản, còn `POST .../publish` (mục 27) vẫn kiểm tra lại và có quyết định cuối cùng.

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
    },
    {
      "statKey": "ARMOR",
      "baseValue": 150,
      "percentValue": 20,
      "unit": "POINT"
    }
  ],
  "changeNote": "..."
}
```

Full replace của section trong draft; không merge field mơ hồ.

`percentValue` tùy chọn, là phần trăm game hiển thị sau dấu `|` (`150 | 20%`). Chỉ `ARMOR`, `MAGIC_DEFENSE`,
`ARMOR_PIERCE` và `MAGIC_PIERCE` có giá trị này, phải có `baseValue` và nằm trong khoảng 0–100; sai trả 422. Bỏ trống
hoặc `null` nghĩa là chưa ghi, khác với `0`.

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

Query `needsCredit=true` lọc ảnh đã có phiên bản hiện hành nhưng chưa có nguồn đầy đủ gồm tên
nguồn và chủ sở hữu / credit. Bỏ qua hoặc `false` trả mọi ảnh. Kết hợp được với `semanticType`;
lọc trước phân trang nên `totalElements` là tổng ảnh khớp trong toàn kho. Ưu tiên nguồn riêng
của phiên bản đang dùng; chỉ dùng nguồn cấp asset nếu phiên bản chưa có nguồn riêng. Nguồn
ghi “Chưa xác minh” chưa được tính đầy đủ. Chỉ cần một nguồn đầy đủ, không bắt buộc URL cho
ảnh chụp game; nguồn của phiên bản cũ và ảnh chưa hoàn tất upload không làm sai bộ lọc.
Ảnh đại diện người dùng (`USER_AVATAR`) thuộc về chính người dùng tải lên, không cần ghi nguồn hay chủ
sở hữu nên không bao giờ nằm trong kết quả `needsCredit=true` (01/11/2026).

Đọc nhiều asset trong một lần gọi, dùng cho màn hình hiện nhiều ảnh cùng lúc (07/11/2026):

```http
GET /api/wiki/v1/admin/media/assets/batch?ids={assetId},{assetId}
```

```json
{ "items": [{ "id": "...", "versions": [], "provenance": [] }] }
```

- Mỗi item có cùng dạng với asset detail ở trên và cần cùng quyền `catalog:read`.
- `ids` bắt buộc, tối đa 100 id, ngăn cách bằng dấu phẩy. Thiếu `ids`, rỗng, quá 100 id, có id sai định dạng hoặc có
  tham số lạ trả `400 INVALID_QUERY_PARAMETER`.
- `items` theo thứ tự trong `ids`. Id lặp lại chỉ trả một lần.
- Id không tồn tại bị bỏ khỏi `items` và không làm hỏng cả lần gọi, nên vẫn trả `200`. Client nào cần phân biệt thì so
  `items` với `ids` hoặc gọi `GET .../assets/{assetId}` để nhận `404 MEDIA_ASSET_NOT_FOUND`.

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

## 33a. Điểm chính của ảnh

```http
PUT /api/wiki/v1/admin/media/assets/{assetId}/versions/{versionId}/focal-point
DELETE /api/wiki/v1/admin/media/assets/{assetId}/versions/{versionId}/focal-point
```

Request của `PUT`:

```json
{ "x": 0.62, "y": 0.2 }
```

`x`, `y` là tỉ lệ 0–1 tính từ góc trên trái của ảnh, thường đặt vào khuôn mặt chính. Điểm thuộc về từng version vì version khác có thể bố cục khác. Bytes của ảnh không đổi. `DELETE` bỏ điểm đã chọn. Kết quả (`200`) là asset detail, mỗi phần tử `versions[]` có thêm `focalPoint`.

`currentVersion` của mọi ảnh trong API public có thêm `focalPoint` (`{ "x", "y" }` hoặc `null`). Nơi hiển thị ảnh trong khung cố định dùng điểm này để khuôn mặt luôn nằm trong khung.

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
      "scope": "CURRENT",
      "shown": true,
      "ownerName": "Airi",
      "partName": null
    }
  ]
}
```

`counts` luôn tính trên toàn bộ usage; `scope` chỉ lọc `items`. Dữ liệu lấy trực tiếp từ các module sở hữu qua `MediaUsageProvider`; trước Phase 3 chưa module nào cung cấp nên kết quả rỗng.

Ảnh theo trạng thái của kỹ năng có vai trò `SKILL_STATE:<skillKey>`, `shown = true`, `partName` là tên kỹ năng.

`shown` cho biết nơi đó có thật sự vẽ ảnh không. `false` nghĩa là chỉ còn lưu mã ảnh: ảnh bổ sung (`images`) chưa được chọn làm ảnh chính, ảnh trong thư viện ảnh kỹ năng (Admin dùng làm icon tạm khi kỹ năng chưa gắn icon, người đọc không thấy), phiên nhập đang chờ, và head trang phục (`SKIN_HEAD:<skinKey>`) khi trang phục đã có chân dung. Head trang phục chỉ tính `shown = true` khi trang phục chưa có chân dung, vì khi đó Wiki vẽ head thay chân dung. Mọi tham chiếu, kể cả `shown = false`, vẫn chặn xóa ảnh và `CURRENT` vẫn chặn deprecate như trước. `ownerName` và `partName` là tên đọc được (ưu tiên vi-VN) của đối tượng và phần bên trong nó như trang phục, kỹ năng; có thể `null`.

### 35.1. Nơi dùng trên danh sách ảnh

```http
GET /api/wiki/v1/admin/media/assets?withUsage=true
GET /api/wiki/v1/admin/media/assets?usage=STORED_ONLY
GET /api/wiki/v1/admin/media/usage-totals?semanticType=HERO_SKIN_ART&needsCredit=false
```

`withUsage=true` thêm `usage` vào từng dòng; `usage=<trạng thái>` lọc theo trạng thái và cũng thêm `usage`. Không truyền hai tham số này thì `usage` là `null` và request không phải hỏi các module khác.

```json
{
  "state": "SHOWN",
  "current": 1,
  "draft": 0,
  "historical": 0,
  "stored": 1,
  "competition": 0
}
```

Một nơi dùng là một vai trò của một đối tượng (`ownerType`, `ownerId`, `propertyRole`), nên cùng ảnh nền trong năm bản cũ chỉ tính một nơi và lấy mức dùng mạnh nhất của nơi đó. `state` là mức mạnh nhất của ảnh:

| `state` | Ý nghĩa |
|---|---|
| `SHOWN` | Có nơi đang vẽ ảnh cho người đọc (`CURRENT` và `shown`), hoặc hồ sơ giải đấu, trang cộng đồng đang ghi ảnh này |
| `DRAFT_ONLY` | Chỉ bản nháp vẽ ảnh; ảnh hiện ra khi bản nháp được xuất bản |
| `HISTORY_ONLY` | Chỉ các bản đã xuất bản trước đây vẽ ảnh |
| `STORED_ONLY` | Chỉ còn lưu mã ảnh (`shown = false`). Chưa xóa được cho tới khi các tham chiếu này được bỏ |
| `NONE` | Không còn tham chiếu nào |

`usage-totals` trả `{states:{SHOWN,DRAFT_ONLY,HISTORY_ONLY,STORED_ONLY,NONE},competitionChecked}` theo cùng bộ lọc `semanticType`, `needsCredit` của danh sách.

`competition` lấy từ Community bằng token của người gọi. Khi Community không trả lời hoặc người gọi không có `tournament:read`, `competition` là `null`, `competitionChecked` là `false` và ảnh chỉ dùng ở giải đấu sẽ rơi vào nhóm chưa dùng. Phép tính này quét hồ sơ đội, tuyển thủ, giải, kế hoạch, trang và bài viết, không quét bản công bố trận đấu vì các bản đó chỉ sao lại ảnh của hồ sơ. Khi xóa ảnh, `requireUnused` vẫn kiểm tra đủ mọi nơi như mục 36.

Kết quả tính từ các module sở hữu qua `MediaUsageProvider.findAllUsages`, không có bảng đếm riêng. Wiki giữ kết quả trong bộ nhớ `wiki.media.usage-report-lifetime` (mặc định 1 phút) vì danh sách cuộn gọi nhiều trang liên tiếp; riêng `/assets/{assetId}/usages` luôn đọc trực tiếp.

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

### 36.1 Xóa bytes ảnh không còn sử dụng (01/11/2026)

`POST /api/wiki/v1/admin/media/assets/{assetId}/delete` nhận `{expectedVersion, reason}`; `reason` bắt buộc,
không rỗng, tối đa 2000 ký tự. Cần `catalog:read`, `media:write` và quyền `tournament:read/write` để kiểm tra,
ngừng tham chiếu ảnh tại Community bằng token hiện tại. Mọi CURRENT/DRAFT/HISTORICAL và dữ liệu Community trong
thùng rác/lịch sử đều chặn xóa (`409 MEDIA_ASSET_IN_USE`). Upload chưa hết hạn hoặc đang xác minh trả
`409 MEDIA_UPLOAD_IN_PROGRESS`; phiên bản cũ trả `409 MEDIA_ASSET_VERSION_CONFLICT`.

Backend chốt các key/URL, chuyển asset BLOCKED, xóa mọi phiên bản và file upload tạm, rồi purge đúng URL CDN.
Không nhận object key/URL hoặc credential từ client. Metadata/source/audit được giữ; asset hoàn tất được ẩn
khỏi danh sách ảnh. Response `200` gồm `{assetId,state,expectedVersion,objects,publicUrls,lastError,requestedAt,completedAt}`;
`expectedVersion` giữ phiên bản của yêu cầu ban đầu để giao diện tiếp tục đúng yêu cầu sau khi tải lại trang.
`state=COMPLETE` nghĩa là R2 đã nhận lệnh xóa và CDN đã chấp nhận purge (hoặc local không có CDN).

`GET /api/wiki/v1/admin/media/assets/{assetId}/deletion` cùng quyền Media trả tiến trình đã lưu; chưa có yêu cầu
trả `404 MEDIA_DELETION_NOT_FOUND`. Khi lỗi, gọi lại POST với `expectedVersion` ban đầu; không cần tạo thao tác
mới. PREPARED sẽ thử lại xóa file, ORIGIN_DELETED chỉ tiếp tục purge. COMPLETE là no-op. Hai lượt xử lý cùng
lúc trả `409 MEDIA_DELETION_IN_PROGRESS`; sau sự cố tiến trình có thể nhận lại lượt sau 10 phút.

Thiếu cấu hình CDN trả `503 MEDIA_CACHE_PURGE_NOT_CONFIGURED` trước khi sửa dữ liệu. Lỗi Cloudflare trả
`502 MEDIA_CACHE_PURGE_FAILED`; không xác minh được Community trả `502 MEDIA_COMPETITION_CHECK_FAILED` và
không tiếp tục xóa. Lỗi kho ảnh tiếp tục dùng `STORAGE_UNAVAILABLE`. Các lệnh HTTP/storage chạy ngoài transaction.

Community bổ sung GET `/api/community/v1/admin/media-assets/references` (`tournament:read`) trả
`{references:{<assetId>:<số bản ghi>}}` cho toàn bộ ảnh mà hồ sơ đội, tuyển thủ, giải, kế hoạch, trang và bài viết đang
ghi (dùng cho mục 35.1), GET `/api/community/v1/admin/media-assets/{assetId}/usage` (`tournament:read`) và POST
`/api/community/v1/admin/media-assets/{assetId}/retire` (`tournament:write`). Hai API sau trả `{assetId,references,retired}`;
retire từ chối khi còn tham chiếu, kể cả hồ sơ đã xóa mềm. Sau khi retire, việc tạo/sửa hồ sơ gắn lại URL ảnh đó
trả `409 TOURNAMENT_MEDIA_RETIRED`. Thao tác này không xóa hồ sơ hoặc bytes, không đọc DB Wiki.

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

## 38a. Đổi tên GamePatch

```http
PUT /api/wiki/v1/admin/patches/{patchId}/title
```

Scope `patch:write`. Body `{locale,title}`; `title` 1–200 ký tự, được bỏ khoảng trắng đầu cuối. Chỉ đổi tên
của locale đó; mã patch, tóm tắt và mô tả giữ nguyên. Locale chưa có bản dịch thì được tạo với tóm tắt rỗng. Trả 204,
404 `PATCH_NOT_FOUND` khi patch không tồn tại. Đổi được cả patch đã xuất bản vì tên chỉ là nội dung hiển thị. Ghi
audit `PATCH_RENAMED`.

---

## 39. Record Hero patch change set

```http
POST /api/wiki/v1/admin/patch-variants/{variantId}/hero-changes
```

Request:

```json
{
  "heroId": "...",
  "sourceKind": "SNAPSHOT",
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

`sourceKind` mặc định `SNAPSHOT`: bắt buộc `toHeroRevisionId` là revision GAME_PATCH đã xuất bản đúng
variant. `PATCH_NOTES` ghi từ ghi chú cập nhật chính thức: bắt buộc `sourceUrl` HTTP(S), không bắt buộc
revision nguồn/đích, dòng STAT/SKILL bắt buộc `oldValue` và `newValue`, không nhận dòng VISUAL; khóa chỉ
số và kỹ năng phải thuộc snapshot đã xuất bản mới nhất của tướng khi có. Lỗi kiểm tra trả
`HERO_INVALID_CONTENT`.

`introducesHero` (mặc định `false`) đánh dấu patch tướng ra mắt, theo nguồn nào cũng được. Ở mốc lịch sử trước patch
đó, catalog công khai không trả tướng. Mỗi tướng tối đa một change set ra mắt trong ruleset; trùng hoặc tướng đã có
revision đã xuất bản có patch trước patch ra mắt trả `HERO_INVALID_CONTENT`. Danh sách change set (Admin và công
khai) trả thêm `introducesHero`.

### 39a. Dữ liệu tướng tại một patch

```http
GET /api/wiki/v1/admin/heroes/{heroId}/patch-view?patchVariantId=...
```

Quyền `catalog:read`. Trả `anchor` (revision dùng làm mốc, `direction`: `EXACT`, `FORWARD`,
`BACKWARD` hoặc `NONE`), `stats` (statKey, unit, baseValue, percentValue, growthPerLevel, `provenance`:
`OBSERVED`, `DERIVED`, `CARRIED`, changeSetId, patchVariantId), `roles` (roleCode, provenance,
changeSetId, patchVariantId), `skillFields` (skillKey, fieldKey, value, provenance, changeSetId,
patchVariantId) và `appliedChangeSetIds`. Giá trị suy ra ghi change set và patch đã đặt giá trị đó. Suy ra theo
[ADR-016](adr/ADR-016-patch-note-changes.md); không lưu kết quả. Change set chỉ ghi số, nên giá trị suy ra để
`percentValue` rỗng.

Tham số tùy chọn `anchorRevisionId` chọn mốc thay cho thuật toán tự động. Mốc phải đã xuất bản,
thuộc đúng tướng/ruleset và có patch xác định trong ruleset. Không hợp lệ trả HTTP 422
`HERO_INVALID_CONTENT`; không âm thầm đổi sang mốc khác. Khi bỏ tham số, hành vi cũ được giữ nguyên.

### 39b. Mô tả trước khi đổi của dòng cơ chế

```http
POST /api/wiki/v1/admin/hero-changes/{changeSetId}/mechanics/{changeId}/previous
```

Quyền `patch:write`. Body `{description, sourceUrl}`: `description` là văn bản người biên tập tự viết, không rỗng, tối
đa 4.000 ký tự; `sourceUrl` là link HTTP(S) của nguồn. Dòng `changeId` phải là dòng MECHANIC thuộc change set
`changeSetId`. Mỗi dòng nhận tối đa một mô tả; ghi lần hai trả 409 `HERO_PATCH_CHANGE_CONFLICT`, không có API sửa hay
xóa. Change set hoặc dòng không tồn tại trả 404 `HERO_PATCH_CHANGE_NOT_FOUND`, nội dung sai trả 422
`HERO_INVALID_CONTENT`. Trả 201 `{id}` là `changeId`. Mô tả không
đổi `patch-view` và không tạo snapshot ([ADR-016](adr/ADR-016-patch-note-changes.md)).

### 39c. Thư viện ảnh của tướng

[ADR-027](adr/ADR-027-thu-vien-anh-tuong.md).

```http
GET /api/wiki/v1/admin/heroes/{heroId}/gallery?locale=vi-VN
```

Quyền `catalog:read`. Trả `{items}`, mỗi mục là một ảnh:

- `assetId`, `kind` (`HERO_ART`, `SKIN`, `SKILL`, `STICKER`, `OTHER`), `roles` (nơi ảnh hiện, ví dụ `PORTRAIT`,
  `SKIN_ART:<skinKey>`, `SKILL_ICON:<skillKey>`, `SKILL_LIBRARY:<skillKey>`, `GALLERY`), `partKey`, `partName` (tên
  chiêu hoặc trang phục theo `locale`, rơi về `vi-VN`).
- `current`: ảnh đang hiện ở bản đang hiệu lực, hoặc là ảnh thư viện kỹ năng.
- `versions`: các bản chưa hủy dùng ảnh, mỗi bản `{revisionId, revisionNo, state, current, patchVariantId}`.
- `attachment`: `null` với ảnh chỉ có theo bản; với ảnh gắn thêm là
  `{id, caption, untilPatchVariantId, sortOrder, version}`.

Ảnh đang dùng đứng trước, rồi ảnh của bản cũ (bản mới hơn trước), rồi ảnh gắn thêm theo `sortOrder`. Ảnh vừa thuộc
bản vừa được gắn thêm chỉ hiện một lần.

```http
POST   /api/wiki/v1/admin/heroes/{heroId}/gallery
PUT    /api/wiki/v1/admin/heroes/{heroId}/gallery/{itemId}
DELETE /api/wiki/v1/admin/heroes/{heroId}/gallery/{itemId}?expectedVersion=N
```

Quyền `hero:write`, có hiệu lực ngay, không cần xuất bản lại tướng. POST nhận
`{assetId, kind, caption?, partKey?, untilPatchVariantId?}` và trả 201 `{id}`. PUT nhận
`{expectedVersion, kind, caption?, partKey?, untilPatchVariantId?}` và trả `{id, version}`. DELETE chỉ bỏ liên kết,
ảnh vẫn ở media, trả 204.

- Ảnh phải tồn tại, còn hiệu lực và có loại hợp với `kind`: `HERO_ART` nhận ảnh đại diện, chân dung, nền; `SKIN` nhận
  ảnh trang phục; `SKILL` nhận icon kỹ năng; `STICKER` nhận sticker chibi; `OTHER` nhận mọi loại. Sai trả 422
  `HERO_INVALID_MEDIA`.
- `caption` tối đa 500 ký tự, `partKey` tối đa 64 ký tự, `untilPatchVariantId` phải là patch của bộ quy tắc; sai trả
  422 `HERO_INVALID_CONTENT`.
- Gắn trùng một ảnh hoặc `expectedVersion` cũ trả 409 `HERO_GALLERY_ITEM_CONFLICT`. Mục không thuộc tướng trả 404
  `HERO_GALLERY_ITEM_NOT_FOUND`; tướng không tồn tại trả 404 `HERO_NOT_FOUND`.

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

### 43.1 Danh mục thị trường (đã triển khai)

```http
GET /api/wiki/v1/regions
GET /api/wiki/v1/regions/{code}
```

Hai endpoint GET công khai, không nhận query parameter. Danh sách trả array theo `sort_order`, rồi `code`,
gồm `id`, `code`, `displayName`, `productName`, `defaultLocale`, `timeZone`, `available`, `unavailableReason`.
Danh mục nhỏ, không phân trang. Trả cả mục khóa để UI hiển thị trạng thái chưa hỗ trợ.
Endpoint theo code xác nhận thị trường có thể chọn: `VN` trả 200; mục khóa hoặc không tồn tại trả
`422 UNSUPPORTED_REGION`, không fallback. Đây không phải API resolve patch hoặc đổi thị trường trong hồ sơ.
Trạng thái ban đầu: VN mở; TH/TW/ID/GLOBAL khóa. Global chưa là tập hợp dữ liệu của các thị trường.

### 43.2 Quản trị region/ruleset (chưa triển khai)

```http
GET  /api/wiki/v1/admin/regions
POST /api/wiki/v1/admin/regions

GET  /api/wiki/v1/admin/rulesets
POST /api/wiki/v1/admin/rulesets

POST /api/wiki/v1/admin/regions/{regionId}/ruleset-assignments
```

Các endpoint này quyền cao, không sửa thường xuyên.

`POST /admin/regions` yêu cầu quyền `region:admin`; body gồm `code` (2–16 ký tự viết hoa,
chữ số hoặc dấu gạch nối, bắt đầu bằng chữ), `displayName`, `productName`, `defaultLocale`,
`timezone` (IANA) và `available` (boolean bắt buộc). Trả `201 {id}`; mã trùng trả `409`,
locale/múi giờ không hợp lệ trả `422`. Form admin mặc định `available=false`, tạo thị trường
ở trạng thái `LOCKED`; chỉ bật khi dữ liệu sẵn sàng. Thao tác được ghi audit `REGION_CREATED`.

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

`page` âm hoặc `size` ngoài giới hạn của endpoint trả `400 INVALID_QUERY_PARAMETER` ở mọi danh sách, như tham số
lạ; không trả mã lỗi nội dung của module.

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

## Bổ sung phục vụ admin và wiki Hero đầu cuối

Hai API đọc admin bổ sung, yêu cầu `catalog:read` và giữ `no-store`:

- `GET /api/wiki/v1/admin/patches?page=0&size=20`: `PageSlice` gồm `id`, `code`, `status`, `sequence`,
  `variants[]`. Variant trả `id`, `rulesetId`, `variantCode`, `rulesetOrdinal`, `status`, `releases[]`.
  Release gồm `id`, `regionId`, `effectiveAt`, `sourceUrl`, `status`. `size` từ 1 đến 100.
- `GET /api/wiki/v1/admin/regions/{regionId}/ruleset-assignments`: mảng `id`, `rulesetId`, `validFrom`,
  `validTo`. Dùng để tiếp tục thiết lập context sau khi tải lại admin, không suy diễn ruleset từ locale.

Public Hero detail có thêm `skillMedia` và `skinMedia`, là map theo `skillKey` / `skinKey` tới
`MediaAssetReference` usable hiện tại. Kỹ năng không có `iconAssetId` lấy ảnh từ thư viện ảnh kỹ năng của
tướng theo đúng luật Admin: ảnh duy nhất gắn `skillKey` đó, nếu không có thì ảnh duy nhất cùng slot và biến thể
(`skill-<slot>-<biến thể>`, slot nguồn trong `SOURCE_SNAPSHOT` được ưu tiên) chưa gắn kỹ năng nào. Khớp mơ hồ thì
bỏ qua. Không có ảnh thì không có entry. `skillStateMedia` là map theo
`assetId` của ảnh theo trạng thái (`content.skills.skills[].stateIcons[].assetId`, kèm `label`) tới
`MediaAssetReference`, để Wiki đổi icon chiêu theo trạng thái như Admin. Các map này cùng `media`
thuộc response resolver cần revalidation; không nhúng URL current vào section immutable.
Activate media version thay ETag/detail URL ảnh nhưng giữ nguyên HeroRevision và section IDs.

PUT section dùng body phẳng (`expectedDraftVersion`, các field của section, `sources`, `changeNote`),
không bọc dữ liệu trong `content`. Admin preview vẫn trả `{revision, content}` với key enum section.
Publish một draft có section chưa điền trả `422 HERO_INVALID_CONTENT`, không phải lỗi máy chủ.

## Bổ sung API import Hero và mùa xếp hạng

- GET `admin/heroes/import/fields`: danh sách trường cố định `{key,label,type}`; quyền hero:write.
- POST `admin/heroes/import/preview`: `{code,rulesetId,locale,values,policies,expectedRevisionId?,expectedVersion?}`. policies: FILL_EMPTY/OVERWRITE/SKIP. Trả `{code,heroId,revisionId,version,before,after,changed}`. Không ghi DB.
- POST `admin/heroes/import/apply`: cùng request, bắt buộc mang revisionId/version đã preview nếu tướng tồn tại; mismatch trả 409. Tướng mới dùng code duy nhất, UUID do backend tạo. Một request một tướng, ghi draft nguyên tử, không tự xuất bản.
- Trường ban đầu: name/title/summary/lore/roles/skills/skins/head/portrait/splash. Trường ảnh trong file là URL HTTPS, frontend tải qua Media API rồi gửi UUID asset cho backend; không lưu URL ngoài làm binding. Mảng JSON giữ cấu trúc section hiện hành; vai trò hợp lệ bắt buộc khi tạo mới. Trường ngoài danh mục trả 422.
- GET `admin/seasons?regionId=UUID`: quyền catalog:read.
- POST `admin/seasons`: quyền patch:write; body regionId, code, displayName, seasonYear?, seasonNumber?, startsAt, endsAt. Trả 201; trùng mã/chồng lịch trả 409.
- POST `admin/patch-variants/{id}/releases`: thêm seasonId tùy chọn; phải cùng region và chứa effectiveAt.

Contract mới nằm tại `wiki-service/src/main/resources/contracts/hero-authoring.openapi.json`; `pnpm generate:hero-api` sinh type cho import và mùa xếp hạng. CI kiểm tra file sinh không lệch contract. Các API có trước vẫn dùng type hiện hành, chưa chuyển toàn bộ service sang generated client.

Draft có thể lưu từng binding ảnh; publish vẫn yêu cầu đủ HEAD/PORTRAIT/SPLASH và các asset usable, đúng semantic type.

## Cập nhật contract import theo mùa/patch

Thay thế request import ở mục trước: bắt buộc thêm releaseId và mode (BASELINE, PATCH_UPDATE, CORRECTION). rulesetId vẫn được gửi và đối chiếu server-side. GET admin/heroes/import/contexts?regionId=&seasonId= trả release đã đặt lịch trong mùa, gồm tên mùa/patch, ruleset, variant, thời điểm hiệu lực. Release cũ chưa gắn season_id được ghép theo thị trường và khoảng mùa không chồng lấn; release gắn mùa rõ ràng phải khớp.

Preview thêm classification (NEW_TO_CATALOG, BASELINE, CHANGED, UNCHANGED, INSUFFICIENT_DATA), canApply, sourcePatchVariantId, warnings. NEW_TO_CATALOG chỉ nói chưa có identity trong kho. Thiếu mốc trả canApply=false; apply từ chối 422. Preview không viết DB hoặc tải ảnh. expectedRevisionId/version tham chiếu chính snapshot dùng để so sánh, kiểm tra lại dưới khóa Hero khi apply.

POST admin/heroes bắt buộc releaseId, tạo DATA_BASELINE gắn patch tương ứng. Import mốc độc lập cho tướng đã có không sao chép snapshot tương lai. Publish và sửa dữ liệu cũ không tự lan thay đổi vào những snapshot về sau.

POST admin/patches/{id}/variants thêm beforeVariantId tùy chọn: chèn trước variant đó trong cùng ruleset (rulesetOrdinal gửi giá trị dương nhưng được suy ra từ anchor). Không có beforeVariantId thì ordinal phải là vị trí dương chưa dùng. Khóa ruleset tuần tự hóa việc chèn và đặt lịch release. OpenAPI import/mùa/context và TypeScript được cập nhật cùng nhau.


### Tác vụ import tướng bền vững

- `PUT /admin/heroes/import/jobs/{id}/notification-dismissal`: chủ tác vụ có `hero:write` (và quyền nền `catalog:read`) đóng thông báo đã hoàn tất; trả 200 với `HeroImportJobView`. Gọi lại an toàn. Tác vụ đang chạy trả 409 `HERO_IMPORT_JOB_CONFLICT`; không tồn tại hoặc khác issuer/subject trả 404. Không xóa lịch sử.
- `HeroImportJobView.notificationDismissed` là boolean, được trả qua create/get/list; mặc định false cho tác vụ mới và dữ liệu cũ. GET list vẫn giữ các tác vụ đã đóng để xem lịch sử. Frontend chỉ ẩn thông báo tác vụ server khi backend xác nhận cờ true, bỏ qua dấu đóng server cũ trong localStorage; cần bấm × lại một lần để đồng bộ bản ghi cũ. Polling 3 giây khi tab hoạt động và tải lại khi focus giúp đồng bộ các trình duyệt/tab. Lỗi lưu giữ thông báo để thử lại và tải lại trạng thái nhằm xử lý trường hợp mất phản hồi sau commit.

- `POST /admin/heroes/import/jobs`: quyền `hero:write`, body `{id: UUID, rows: HeroImportRequest[]}`, 1–200 dòng mã tướng không trùng; trả 202. `id` là khóa idempotency: gửi lại cùng dữ liệu trả cùng tác vụ, khác dữ liệu trả 409.
- `GET /admin/heroes/import/jobs`: tác vụ đang chạy và 20 tác vụ hoàn tất gần nhất của người gọi.
- `GET /admin/heroes/import/jobs/{id}`: tác vụ của người gọi; không tồn tại hoặc của tài khoản khác trả 404.
- Kết quả: `id`, `status` (`RUNNING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`), `completed`, `total`, `createdAt`, `updatedAt`, `results` gồm `code`, `succeeded`, `errorCode`, `detail`. Không trả payload nhập liệu qua API tiến trình.
- Chỉ sau 202 mới được đóng web an toàn. Ảnh phải upload và complete trước khi gửi; `values` tham chiếu UUID asset. Worker giữ nguyên kiểm tra phiên bản khi áp dụng. Không tự xuất bản.


### Ánh xạ dữ liệu liên quan khi import tướng

`GET /admin/heroes/import/relation-fields` (quyền `hero:write`, cùng quyền nền `catalog:read`) trả các trường được phép của `skills` và `skins`: mã, tên/mô tả bản dịch, thứ tự, loại/dạng/hiệu ứng kỹ năng; bậc/cách sở hữu trang phục; `iconAssetId` hoặc `artAssetId`. Mỗi trường có `key`, `label`, `type`. Endpoint metadata không thêm cột tự do. Payload import vẫn dùng các mảng Skill/Skin của hợp đồng hiện có. Ảnh trong payload gửi tác vụ luôn là UUID asset đã upload hoàn tất, không phải đường dẫn máy người dùng.

## Tổng quan phát hành cho admin

- GET `/api/wiki/v1/admin/publication-overview`, quyền `catalog:read`, không nhận query parameter. Trả `asOf`, `markets`, `rulesets`, `assignments`, `seasons`, `variants`, `releases`. Variant có `patchTitle` nullable: tên vi-VN, không có thì tên của locale đầu tiên theo thứ tự chữ cái. Market có currentRulesetId/currentSeasonId/currentReleaseId nullable. Phase mùa: UPCOMING/CURRENT/ENDED; phase release: UPCOMING/CURRENT/PAST/DRAFT/CANCELLED. PAST biểu thị đã đến lịch nhưng không còn current, không phải chứng nhận nguồn ngoài game. Mốc ngày giờ ISO-8601. Contract nằm trong hero-authoring.openapi.json, frontend sinh type từ contract.
- GET `/api/wiki/v1/admin/patch-variants/{id}/hero-changes?locale=vi-VN`, quyền `catalog:read`. Trả change set có heroCode, heroId, revision nguồn/đích, summary với actualLocale và danh sách changes. Change set của một dạng có thêm `holderId`, `holderCode`, `formKey` (ADR-024); trang patch công khai nhận cùng các trường. Chỉ trả thay đổi được biên tập, không tự tạo khác biệt từ baseline. Giai đoạn này chỉ có provider Hero.

Frontend dùng TanStack Query cho tổng quan (làm mới 60 giây), danh mục và snapshot tướng, bảng thay đổi theo variant/locale (chỉ tải khi mở). Sau mutation thiết lập mùa/patch hoặc ghi thay đổi, invalidate các cache liên quan. Đổi trang giữ cache theo cơ chế workspace hiện có.


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
### API khôi phục upload import

Quyền `hero:write` và quyền nền `catalog:read`; mọi phiên chỉ chủ sở hữu issuer/subject truy cập.
- GET `/admin/heroes/import/upload-sessions`: các phiên đang dở của người gọi.
- PUT `/admin/heroes/import/upload-sessions/{id}`: `{version,state}`; version=-1 tạo, cập nhật dùng version hiện tại. State là object tối đa 5 MB. Trả `{id,version,updatedAt,state}`. Gửi lại cùng state là idempotent; khác state và version cũ trả 409. Không tồn tại/khác chủ trả 404.
- DELETE cùng đường dẫn: xóa checkpoint của người gọi sau khi gửi job thành công. Không xóa media.

Checkpoint lưu trước PUT storage và sau complete. Khi khôi phục, thử complete lượt cũ trước; chỉ tạo lượt upload mới nếu file chưa có, hết hạn hoặc bị từ chối. Dữ liệu đã thay đổi thì dừng, không tự ghi đè bản xem trước cũ. Thay thế giới hạn trước đây: đóng web trước 202 vẫn tạm dừng upload nhưng có thể tiếp tục từ checkpoint.

### So sánh snapshot tướng trong admin

`GET /admin/heroes/{heroId}/revisions/{revisionId}/comparison?fromRevisionId=UUID` cần `catalog:read`.
Không nhận query khác. Không truyền fromRevisionId thì dùng sourceRevisionId của đích; nếu không có
trả `{status:"BASELINE_ONLY",from:null,to,before:{},after,changes:[],warnings}`. Không tự chọn snapshot
mới nhất hoặc dựng dữ liệu trước đó từ một trạng thái rỗng.

`GET /admin/heroes/{heroId}/revisions/{revisionId}/draft-changes` cần `catalog:read`, không nhận query. Trả
`{source, startedAt, before, after}` để xem bản nháp đã đổi gì so với lúc bắt đầu. Có `sourceRevisionId` thì so với bản đó.
Không có thì `source` là null và `before` là nội dung từng phần được lưu trong một phút đầu của bản nháp, vì lúc nhập dữ
liệu các phần được điền ngay sau khi tạo; đây là cách đọc lại từ các lần lưu đã giữ, không phải bản chụp riêng.

Khi có nguồn cùng hero/ruleset, trả `{status:"AVAILABLE",from,to,before,after,changes,warnings}`;
from/to là metadata HeroRevisionView; before/after có sáu section theo key JSON camelCase. Mỗi change
gồm `{section,path,kind,before,after}`, kind ADDED/REMOVED/CHANGED; path là JSON Pointer tương đối với
section, các mảng nhận diện dùng mã kỹ năng/trang phục/chỉ số/locale thay cho chỉ số dòng. Số bằng nhau
khác số lẻ thập phân không tính là thay đổi; sources không tham gia diff. Snapshot khác ruleset trả 422;
nguồn/đích không thuộc hero trả 404. Endpoint chỉ đọc, không ghi nhận thay đổi game/changelog.

Khi so sánh effects loại SOURCE_SNAPSHOT, chỉ đối chiếu dữ liệu gameplay đã thu thập gồm cooldown,
energyCost, levelTable và tags. Tên/link ảnh nguồn, cờ rà soát, thuộc tính tướng lặp lại và review_required
trong bảng không tạo khác biệt kỹ năng. before/after và payload khác biệt vẫn giữ dữ liệu nguồn nguyên
vẹn; không sửa snapshot đã lưu. Khi bổ sung trường gameplay capture mới cần mở rộng phép chiếu này.

### Import chỉ số và dữ liệu nguồn có cấu trúc

`GET /admin/heroes/import/fields` thêm overviewRatings và combatStats, type=json.
`values.overviewRatings` nhận `{scaleCode,survivability,attackDamage,skillEffects,difficulty,derived,sources}`;
scale đã có GAME_OVERVIEW_10 giới hạn 0–10, derived bắt buộc có nguồn. `values.combatStats` nhận
`{values:[{statKey,baseValue?,percentValue?,growthPerLevel?,unit}],sources}`; mỗi dòng phải có ít nhất một số đã biết,
`percentValue` theo cùng quy tắc của cập nhật chỉ số chiến đấu.
Đây là field cấp object: OVERWRITE thay cả object, FILL_EMPTY chỉ điền nếu section chưa có dữ liệu,
SKIP giữ nguyên. Bỏ field khỏi values không xóa section. Tên field/kiểu không hợp lệ trả 422.
Thứ tự chỉ số được chuẩn hóa theo statKey nên import lại cùng dữ liệu không tạo sửa đổi do thứ tự dòng.
Skill.effects có thể giữ SOURCE_SNAPSHOT.metadata.reviewFlags hoặc review_flags; preview báo cảnh báo
cho kỹ năng có cờ chưa rõ, giữ nguyên dữ liệu nguồn thay vì suy luận mô tả hoặc dạng chiêu còn thiếu.

### Chỉnh mốc của baseline nháp đầu tiên

`POST /admin/heroes/{heroId}/drafts/{draftId}/baseline-context`, quyền `hero:write`, body
`{expectedVersion,contextId}` trả HeroRevisionView. Chỉ DRAFT DATA_BASELINE độc lập (sourceRevisionId=null)
và chưa có snapshot PUBLISHED cùng hero/ruleset; target phải là context mùa/patch cùng ruleset.
Backend khóa hero, kiểm tra version, đổi effectiveFromPatchVariantId, tăng version và ghi audit
HERO_BASELINE_CONTEXT_CHANGED. Cùng context là no-op không tăng version. Giữ nguyên sáu section và
tham chiếu media. Sai version/trạng thái trả 409; sai loại baseline, đã có lịch sử xuất bản hoặc khác
ruleset trả 422. Không có endpoint đổi mốc của snapshot đã PUBLISHED; nhập lịch sử sau xuất bản dùng
baseline độc lập đúng mốc và kiểm chứng nguồn.

### Danh mục tướng theo thay đổi gameplay

`GET /admin/heroes` tiếp tục cần `catalog:read` và giữ `{id,code,revisions}` trong từng dòng. Query:
`page=0`, `size=20` (1–100), `q` tối đa 100 ký tự sau trim, `seasonId?`, `patchVariantId?`,
`rulesetId?`, `locale=vi-VN`, `sort=code|edited-desc`. Tham số khác, page/size ngoài giới hạn, `q` quá dài hay
sort khác trả 400 `INVALID_QUERY_PARAMETER`; locale/phạm vi không hợp lệ trả 422. Tìm kiếm không phân biệt hoa thường trên mã và tên snapshot theo từng ruleset,
trước khi phân trang/count. Khi không lọc mùa/patch, chọn snapshot chưa hủy theo `rulesetOrdinal`
rồi `revisionNo` giảm dần; bổ sung lịch sử sau này không thay tên ở patch mới hơn. Khi lọc mùa/patch,
chỉ tìm tên đích của change set mới nhất trong phạm vi đó. Nhận tên của mọi bản dịch đã lưu.
`%`, `_` và `\` là ký tự tìm literal; khoảng trắng
trong truy vấn mã có thể thay dấu `-` (`dieu thuyen` tìm `dieu-thuyen`). Không tự bỏ dấu tên.

Mùa/patch lọc membership bằng change set gameplay đã được ghi nhận, không lọc theo mọi snapshot
đang áp dụng ở mốc đó. Patch phải thuộc mùa/ruleset đã chọn. Chỉ GAME_PATCH PUBLISHED có change
set được tính; bản nháp, baseline, bản dịch, hiệu chỉnh và số liệu tự khác nhau không được tự gán
BUFF/NERF. Không có thay đổi đã biên tập trong mùa thì trả trang rỗng, không hiển thị kế thừa.

Mỗi dòng thêm `lastEditedAt` (ISO instant hoặc null) và `gameplayChanges` gồm
`{id,rulesetId,seasonId?,patchVariantId,fromHeroRevisionId?,toHeroRevisionId,changeKinds,recordedAt,summary?,actualLocale?}`.
Chọn mùa/patch trả tất cả change set trong phạm vi, theo rulesetOrdinal giảm dần; không chọn trả
change set mới nhất của từng ruleset. Ngày tạo change set không thay thứ tự gameplay. `changeKinds`
là các loại đã biên tập không trùng trong change set (BUFF, NERF, ADJUSTMENT, REWORK, FIX, OTHER),
không suy ra từ dấu tăng/giảm của chỉ số. `summary` dự phòng exact locale → vi-VN → locale chữ cái
đầu tiên, có `actualLocale`; thiếu bản dịch thì hai trường null. `toHeroRevisionId` mở đúng snapshot
của thay đổi. Lọc theo ruleset chỉ trả tướng có snapshot chưa hủy trong ruleset đó.

`lastEditedAt` là max của `hero.created_at` và tất cả `hero_revision.updated_at` của tướng, gồm
nháp, import, dịch, hiệu chỉnh, hủy. Đây là lần sửa dữ liệu tướng, không phải lúc biên tập summary
changelog hoặc ngày áp dụng game. Không lấy `published_at` hay giờ server để thay timestamp thiếu.
`edited-desc` dùng đúng công thức trên, sau đó mã và UUID tăng dần để phân trang ổn định. Query
dùng JPA để lọc/count và tải revision, classification, translation theo nhóm của trang; không tải
toàn nội dung section hay gọi lịch sử thay đổi riêng cho từng tướng.

Danh mục tướng hỗ trợ thêm `role` (mã vai trò phân cách dấu phẩy), `position`
(`top`, `mid`, `rung`, `rong-ad`, `tro-thu`, phân cách dấu phẩy) và `hasWarnings=true|false`.
Các nhóm kết hợp bằng AND, các lựa chọn trong cùng nhóm kết hợp bằng OR; giá trị vai trò/đường lạ trả 422.
Lọc và count trước phân trang, trên cùng snapshot mới nhất được chọn theo ruleset/phạm vi như tìm kiếm tên.
Vai trò và đường đều lấy từ PROFILE (`top`→`TOP`, `mid`→`MID`, `rung`→`JUNGLE`, `rong-ad`→`DRAGON`, `tro-thu`→`SUPPORT`),
không suy diễn đường từ vai trò. Dữ liệu `heroClassification.recommendedPositions` trong snapshot nguồn chỉ còn để đối chiếu; V050 đã chuyển sang PROFILE. Cảnh báo đọc `reviewFlags` (dự phòng `review_flags`) và `heroReviewFlags`;
bỏ qua cờ `reviewResolution=RESOLVED`, cờ nguồn chỉ mô tả cách đo/ảnh trùng/icon chưa gắn nhãn,
và cờ `not_visible_in_source` của `heroLevel`/`hero.attributes.hero_level` giống giao diện đối chiếu.
Không truyền bộ lọc thì giữ hành vi cũ.

### Giá tướng và cách nhận trang phục

```http
GET /api/wiki/v1/heroes/{heroId}/shop?region=VN&at=2026-09-20
GET /api/wiki/v1/admin/heroes/{heroId}/shop?region=VN
PUT /api/wiki/v1/admin/heroes/{heroId}/shop?region=VN
PUT /api/wiki/v1/admin/heroes/{heroId}/shop/skins/{skinKey}?region=VN
DELETE /api/wiki/v1/admin/heroes/{heroId}/shop/prices/{capturedOn}?region=VN
DELETE /api/wiki/v1/admin/heroes/{heroId}/shop/skins/{skinKey}/{capturedOn}?region=VN
```

Đi theo cửa hàng trong game nên áp dụng ngay, không cần bản nháp. Mỗi ngày là một mốc: lưu với `capturedOn` mới sẽ thêm mốc và giữ mốc cũ, lưu với ngày đã có sẽ sửa mốc đó, DELETE chỉ dành cho mốc ghi nhầm. `at` là ngày muốn xem, mặc định hôm nay: `price` và `skins` là mốc gần nhất không sau ngày đó, chưa có mốc thì `price` là `null`. Bản public bỏ các mốc còn chờ xem lại, bỏ `note`, `needsReview` và lịch sử; một mốc chờ xem lại không che mốc đã xác nhận trước đó. Bản admin thêm `priceHistory` và `skinHistory` gồm mọi mốc, mới nhất trước. Đọc admin cần `catalog:read`, ghi cần `hero:write`.

```json
{
  "region": "VN",
  "at": "2026-09-20",
  "price": { "availability": "ON_SALE", "goldPrice": 13888, "voucherPrice": 359, "capturedOn": "2026-09-16", "needsReview": false, "note": null },
  "skins": [{ "skinKey": "airi-kiemono", "method": "VOUCHER", "voucherPrice": 799, "eventName": null, "capturedOn": "2026-09-16", "needsReview": false, "note": null }]
}
```

`price` là `null` khi chưa có thông tin. PUT giá nhận `availability` (bắt buộc), `goldPrice`, `voucherPrice`, `capturedOn` (mặc định hôm nay), `needsReview`, `note`. PUT trang phục nhận `method` (bắt buộc), `voucherPrice` (chỉ giữ khi `VOUCHER`), `eventName` (chỉ giữ khi `EVENT`), `capturedOn`, `needsReview`, `note`. Giá trị lạ trả 422, tướng hoặc trang phục không tồn tại trả 404.

### Không gian ảnh và bản dịch bậc trang phục

Các endpoint ngoài dưới đây dùng prefix `/api/wiki/v1`; mapping Java vẫn dùng ApiPaths.ADMIN
và `version="1"`. Đọc cần `catalog:read`, ghi danh mục/bản nháp cần `hero:write`; upload riêng cần
`media:write`. Media bytes chỉ đi qua presigned URL của storage.

| Endpoint | Hợp đồng |
|---|---|
| `GET /admin/hero-media` | Query bắt buộc rulesetId, role HEAD/PORTRAIT/SPLASH; locale=vi-VN, q, page=0, size=20 (1–100). PageSlice nhóm tướng, chọn snapshot chưa hủy theo rulesetOrdinal rồi revisionNo, không lọc membership thay đổi mùa/patch. |
| `GET /admin/skin-badges` | rulesetId tùy chọn để tính skinCount; locale, q, page, size. PageSlice danh mục và bản dịch. |
| `POST /admin/skin-badges` | `{code,kind,translations:[{locale,displayName,iconAssetId}]}` → 201 SkinBadgeView. Code unique, kind UNKNOWN/RARITY/EVENT. |
| `PUT /admin/skin-badges/{id}` | `{expectedVersion,kind,translations}` → 200 SkinBadgeView; code bất biến, thay toàn bộ translations, xung đột 409. |
| `GET /admin/skin-badges/{id}/skins` | rulesetId bắt buộc, locale, page, size; PageSlice trang phục liên quan trong các snapshot đã chọn, không đếm trùng lịch sử. |

HeroMediaGroup gồm `{heroId,code,name,actualLocale,revision,entries}`. Entry gồm
`{ownerType:HERO|SKIN,skinKey?,name,assetId?,label?,main,rarityCode?}`. Thiếu ảnh chính vẫn có
placeholder assetId=null; các file khác giữ từng hàng riêng. q tìm mã/tên tướng và mã/tên trang phục
trước khi phân trang. Chỉ trả UUID asset; metadata/URL và nguồn phân giải qua Media API được cache.

Section MEDIA_BINDINGS giữ `bindings:{HEAD?:UUID,PORTRAIT?:UUID,SPLASH?:UUID}`, bổ sung
`images:{HEAD?:ImageOption[],PORTRAIT?:ImageOption[],SPLASH?:ImageOption[]}`. ImageOption là
`{assetId,label?}`, tối đa 200 mỗi vai trò và không trùng assetId trong cùng vai trò. Skin giữ
`artAssetId` cho cover, thêm `headAssetId`, `portraitAssetId`, `images` cùng cấu trúc. Dữ liệu cũ
không có images được đọc như bản đồ rỗng. Ảnh tướng theo semantic HERO_HEAD/HERO_PORTRAIT/HERO_SPLASH;
mọi ảnh trang phục dùng HERO_SKIN_ART. Đổi ảnh chính giữ ứng viên cũ/mới. Các request section vẫn
cần expectedDraftVersion, chỉ ghi DRAFT; snapshot PUBLISHED bất biến.

`headAssetId` của trang phục vẫn được lưu và trả về như trước nhưng Admin không còn hiển thị hay cho chọn: tab Trang phục,
form trang phục và tab Head của Không gian ảnh đều bỏ. Lưu trang phục không xóa giá trị đã có. Wiki vẫn đọc `head` từ danh
sách trang phục công khai để vẽ thay khi trang phục thiếu chân dung; mục 35 nói rõ cách đếm loại tham chiếu này.

SkinBadgeView gồm `{id,code,kind,version,translations,displayName,iconAssetId,actualLocale,
fallbackApplied,skinCount}`. Mỗi translation có `{locale,displayName,iconAssetId}`; icon nullable,
locale không trùng, semantic bắt buộc SKIN_BADGE và asset phải dùng được. Projection chọn exact
locale → vi-VN → en-US → locale đầu tiên. Tên/icon luôn cùng hàng dịch; không lấy icon dự phòng
khi hàng dịch đích đã có nhưng thiếu icon. Chưa có bản dịch trả code, icon null, actualLocale null.
SkinBadgeRelation gồm `{heroId,heroCode,heroName,skinKey,skinName,revisionId,artAssetId}`.

### Nhóm bậc/chủ đề của nhãn trang phục

| Endpoint | Hợp đồng |
|---|---|
| `GET /admin/skin-badge-groups` | locale, q, page, size; PageSlice nhóm cùng badgeCount, không cắt một nhóm thành các nhóm trùng tên theo trang nhãn. Đọc cần catalog:read. |
| `POST /admin/skin-badge-groups` | `{code,kind:RANK|THEME,translations:[{locale,displayName}]}`; tạo nhóm, cần hero:write. |
| `PUT /admin/skin-badge-groups/{id}` | `{expectedVersion,kind,translations}`; code bất biến, giữ optimistic version và thay toàn bộ bản dịch nhóm. |
| `PUT /admin/skin-badges/{id}/group` | `{expectedVersion,groupId:UUID|null}`; chuyển/bỏ nhóm, giữ mọi tên/icon/loại nhãn; cần hero:write, xung đột 409. |

GroupView gồm `{id,code,kind,version,translations,displayName,actualLocale,fallbackApplied,
badgeCount,matchedByGroup}`. Nhóm tổng hợp chưa phân nhóm có id=null, code=__ungrouped,
kind=null, displayName=null; UI đặt nhãn theo ngôn ngữ giao diện. q tìm mã/tên nhóm hoặc mã/tên
nhãn con. Khi chính nhóm khớp, matchedByGroup=true, count gồm toàn bộ nhãn và UI bỏ q khi tải con;
nếu chỉ nhãn khớp thì count theo q và UI gửi lại q. Chuỗi q rỗng không áp dụng nhánh khớp tên nhóm.

`GET /admin/skin-badges` thêm query groupId hoặc ungrouped=true, không gửi cả hai; các tham số cũ
vẫn hợp lệ. SkinBadgeView thêm groupId nullable. POST nhãn có thể nhận groupId; PUT metadata nhãn
cũ giữ nguyên nhóm, chuyển nhóm chỉ qua endpoint riêng. Nhãn và nhóm vẫn dùng UUID của backend,
không dùng tên hiển thị hoặc chỉ số trang làm khóa ánh xạ.

Request chuyển nhóm bắt buộc có cả expectedVersion và groupId; bỏ groupId trả 400, gửi null
là thao tác bỏ nhóm. Không dùng PUT metadata để ngầm chuyển nhóm.

### Chuẩn hóa định danh và tên file ảnh

Theo ADR-010, mã tướng dùng tên quốc tế; khóa trang phục có dạng
`<hero-code>-<ten-trang-phuc-khong-dau>-<so>`, số từ 1. Alias mã/khóa cũ được phân giải trước khi
import hoặc ghi section, bao gồm trước bước giữ ứng viên ảnh; không nhân đôi tướng/trang phục
khi dùng lại JSON cũ. UUID, bản dịch, revision và tham chiếu ảnh không đổi.

`POST /admin/skin-badges` cho phép bỏ code và gửi regionCode (mã quốc gia ISO chữ thường hoặc
global, mặc định vn). Khi đó translations phải có tên; backend cấp mã `<ten>-<regionCode>-<so>`
dưới khóa transaction JPA. Dấu `+` trong tên chuyển thành `plus`. Code tường minh vẫn được nhận
để tương thích client cũ. Region không hợp lệ hoặc tên không tạo được slug ASCII trả 422.

Metadata tên file Media và nhãn ứng viên được đổi đồng bộ với file nguồn trong resources;
object key và bytes lưu trữ bất biến. Bảng ảnh hiển thị thumbnail chính trong cột tướng được ghim,
không có cột Ảnh chính riêng. Ảnh trang phục chính có dấu kiểm nhỏ trên thumbnail; nhãn bậc chỉ
hiển thị tên và icon, vẫn mở preview tại chỗ được.

## Kho trang bị — API quản trị đầu tiên

Bốn prefix `/admin/items`, `/admin/arcana`, `/admin/spells`, `/admin/enchantments` dùng cùng
vòng đời, nhưng content có kiểu riêng. Mọi đường dẫn dưới đây nằm dưới `/api/wiki/v1`.

| Thao tác | Đường dẫn / body |
|---|---|
| Danh sách | GET prefix?rulesetId&locale&q&page=0&size=20; size 1–100, PageSlice |
| Chi tiết mới nhất | GET prefix/{id}?rulesetId |
| Lịch sử | GET prefix/{id}/revisions; array revision |
| Snapshot | GET prefix/{id}/revisions/{revisionId}, alias drafts/{revisionId} |
| Tạo identity/nháp | POST prefix: code,rulesetId,effectiveFromPatchVariantId?,initialLocale,name,content? |
| Fork | POST prefix/{id}/drafts: rulesetId,sourceRevisionId,cause,effectiveFromPatchVariantId?,changeNote? |
| Sửa nháp | PUT prefix/{id}/drafts/{revisionId}: expectedVersion,content,changeNote?,effectiveFromPatchVariantId? |
| Xuất bản / hủy | POST prefix/{id}/drafts/{revisionId}/publish hoặc discard: expectedVersion,changeNote? |

Đọc cần catalog:read; ghi cần item:write/arcana:write/spell:write/enchantment:write; xuất bản cần
quyền `:publish` tương ứng. Lỗi optimistic version hoặc sửa bản đã xuất bản trả 409; nội dung,
ảnh sai semantic type và dữ liệu bắt buộc khi publish trả 422.

Các mutation và chi tiết trả `{id,code,revision,content,missingFields}`. Revision gồm id,ownerId,
code,rulesetId,revisionNo,state,version,publicationSequence,publishedAt,cause,
effectiveFromPatchVariantId,sourceRevisionId,createdAt,updatedAt. Cause được fork là GAME_PATCH,
CONTENT_CORRECTION hoặc TRANSLATION_UPDATE; tạo mới dùng DATA_BASELINE. Content correction và
bản dịch giữ applicability của nguồn. Không cho dùng nguồn tương lai để tạo snapshot quá khứ.
Nháp DATA_BASELINE độc lập cho phép bổ sung/đổi patch quan sát đã xuất bản cùng ruleset khi sửa;
không gửi hoặc gửi null giữ mốc đang có. Chỉ đổi mốc cũng tăng version, không tự tạo changelog.

Riêng Trang bị và Phụ trợ, `DATA_BASELINE` được xuất bản khi đủ nội dung nhưng chưa xác định
patch quan sát. `missingFields` không yêu cầu patch cho dữ liệu nền này; không tự gán mùa, ngày
hay tạo sự kiện thêm mới. Correction/translation có nguồn đã xuất bản trong cùng ruleset được
kế thừa ngữ cảnh chưa rõ; không cho tạo correction độc lập để bỏ qua kiểm tra. `GAME_PATCH`
luôn phải có patch cụ thể, kể cả lúc fork từ dữ liệu nền chưa rõ mốc. Khi xuất bản patch đó phải
đã công bố. Bảng ngọc và Phù hiệu vẫn giữ yêu cầu mốc quan sát trước khi xuất bản.

Body Update của Trang bị và Phụ trợ có thêm `clearPatchContext?:boolean`. Chỉ nháp DATA_BASELINE
độc lập (sourceRevisionId null) mới được xóa mốc đã chọn; không được vừa gửi patch vừa yêu cầu xóa.
Không gửi cờ này giữ hành vi cũ: patch null trong body nghĩa là giữ mốc hiện tại. Correction,
translation và GAME_PATCH không được thay hoặc xóa mốc kế thừa. Bản đã xuất bản vẫn bất biến.

Content chung có iconAssetId,translations,notes. Translation gồm locale,name,summary?,description?,
statLabels?,variantLabels?,effects?; effect gồm key,name,description,type. `notes` là ghi chú
biên tập/nguồn, tối đa 32768 ký tự; public không trả ghi chú này. Các danh sách tùy chọn mặc định rỗng.

- Item: tier,price,categoryCode,shopPositions[{categoryCode,row,column,variant}],recipeStatus
  UNKNOWN/NONE/VERIFIED,components[{itemId,quantity}],stats[{key,value,unit}]. Chỉ VERIFIED nhận
  thành phần đã xác nhận; không cho tự ghép chính nó, chu trình hoặc UUID không tồn tại.
- Arcana: color RED/PURPLE/GREEN,tier,stats. Chỉ số chưa biết được để rỗng trong nháp.
- Enchantment: branchCode,tier,position. Tier 1–3, position có thể null khi chưa biết.
- Spell: cooldownSeconds,unlockLevel,unlockType ACCOUNT_CREATION/LEVEL/UNKNOWN,availability
  AVAILABLE/REMOVED/UNKNOWN,legacy,displayOrder,chargeRechargeSeconds,maxCharges,defaultStateKey,
  states[{key,iconAssetId,translations}],referenceImages[{assetId,notes}]. Có thể xuất bản khi
  chưa biết cách mở khóa hoặc cấp mở khóa; các giá trị đã ghi nhận vẫn được giữ.

GET `/admin/item-categories` và `/admin/enchantment-branches` trả array metadata gồm code,version,
displayOrder,iconAssetId,backgroundAssetId,color,translations[{locale,name,description,suitability}].
PUT `/{code}` nhận expectedVersion=0 để tạo; sửa phải mang version hiện tại, thay toàn bộ danh sách
bản dịch nên client phải giữ các locale không sửa. Nhánh dùng ENCHANTMENT_ICON, nhóm trang bị dùng
ITEM_ICON; ảnh nền dùng OTHER. Metadata có audit và báo tham chiếu Media.

Danh sách quản trị `/admin/items`, `/admin/arcana`, `/admin/spells` và `/admin/enchantments` nhận
`draftsOnly=true` cùng `rulesetId` để tìm bản nháp đang mở, kể cả khi chưa gắn patch hoặc đang sửa
một mốc cũ. Chế độ này hỗ trợ tìm kiếm và phân trang, không kết hợp với bộ lọc mùa/patch hay
`includeUnchanged=true`. Nháp chỉ phục vụ biên tập, không tạo thay đổi gameplay hoặc dữ liệu public.

GET `/admin/enchantments` hỗ trợ thêm `seasonId`, `patchVariantId`. Không truyền cả hai
thì trả snapshot mới nhất như cũ. Có bộ lọc thì chỉ chọn identity có snapshot
DATA_BASELINE hoặc GAME_PATCH trong đúng mùa/patch; trả snapshot mới nhất tại mốc
phù hợp, gồm nội dung sửa/bản dịch tại cùng mốc. Bản sửa nội dung/bản dịch không tự
tạo một lần thay đổi gameplay mới. Áp dụng scope và tìm kiếm trước phân trang;
không lấy snapshot mùa sau để hiển thị cho mùa trước. Mốc nền được hiển thị như
dữ liệu đã ghi nhận, không suy diễn toàn bộ mục đã đổi gameplay. Nếu truyền cả
mùa/patch/ruleset không tương ứng thì trả 400 INVALID_QUERY_PARAMETER.

PUT `/admin/enchantment-branches/order` (`enchantment:write`) nhận
`{entries:[{code,expectedVersion}]}` theo thứ tự mong muốn, phải gồm toàn bộ hệ hiện có.
PUT `/admin/enchantments/order` cùng quyền nhận
`{rulesetId,branchCode,tier,entries:[{id,revisionId,expectedVersion}]}`; danh sách phải gồm
đủ các snapshot hiện tại trong cùng hệ/cấp/ruleset, đều là nháp nội dung (không phải
TRANSLATION_UPDATE). Không sửa snapshot đã xuất bản; cần tạo nháp trước. Cả hai API kiểm
tra trùng lặp, thành viên và version trước khi ghi trong một transaction, gán vị trí
liên tiếp từ 0, chỉ tăng version và ghi audit cho mục đổi vị trí. Trả array đã sắp xếp;
không đổi ảnh, nội dung/bản dịch, ghi chú hay patch. Lỗi version/thành viên trả 409.

Public GET `/items`, `/arcana`, `/spells`, `/enchantments` và `/{id}` chỉ trả snapshot PUBLISHED
được phân giải theo region/patch hiện hành. Danh sách nhận `region=VN`, `locale=vi-VN`, `page=0`,
`size=20` (1–100); chi tiết chỉ nhận region và locale. Tham số ngoài danh mục bị từ chối.
Locale chọn bản dịch riêng và không thay revision; ưu tiên locale yêu cầu, vi-VN, en-US, rồi
locale đầu tiên. Nháp không bị công khai.

Trang bị/Phụ trợ nền chưa rõ patch và các correction/translation kế thừa có ordinal dự phòng 0
trong danh mục hiện hành, gồm cả tham chiếu thuật ngữ `@`. Snapshot có patch đã biết trong
context được ưu tiên hơn; patch tương lai chưa thay thế dữ liệu hiện hành. Việc quan sát dữ liệu
nền không được coi là bằng chứng rằng mục đó đã có từ một mùa trong quá khứ. Sau này có nguồn,
biên tập viên tạo GAME_PATCH ở mốc phù hợp từ baseline và ghi change set với baseline làm nguồn;
hoặc ghi nhận loại bỏ có nguồn tại patch thật. Không sửa patch của snapshot nền đã xuất bản.

Các View thêm trường `media`, map theo UUID asset tới `MediaAssetReference` gồm
`assetId,semanticType,state,currentVersion{versionId,mimeType,width,height,url}`. Map chỉ có ảnh
ACTIVE và đã có phiên bản, thuộc các mục thực sự trả về trong trang; metadata ảnh được đọc theo
lô bằng `MediaAssets.findAll` sau khi phân trang. Phụ trợ gồm cả ảnh của trạng thái và ảnh tham
khảo. UUID thiếu, bị khóa hoặc chưa upload xong không xuất hiện trong map; nội dung vẫn giữ
UUID tham chiếu để client có thể hiển thị chỗ giữ chỗ. Chi tiết áp dụng cùng quy tắc, View quản
trị/mutation giữ map rỗng. Không có public API đọc metadata ảnh tùy ý theo UUID.

Public GET `/item-categories?locale=vi-VN` và `/enchantment-branches?locale=vi-VN` trả array:
`{code,displayOrder,color,translations:[{locale,name,description,suitability}],icon?,background?}`.
Chỉ nhận tham số locale, sắp theo displayOrder rồi code. Danh sách translations chứa tối đa một
bản dịch được chọn theo cùng thứ tự dự phòng với content; trường locale cho biết ngôn ngữ thực
tế. Icon/background dùng `MediaAssetReference` và chỉ trả khi dùng được; tên và metadata ảnh
được đọc theo lô. Đây là metadata danh mục dùng chung với admin, không chứa nháp gameplay hay
ghi chú nội bộ và không cấp quyền sửa cho người dùng wiki.

### Phụ trợ cũ và patch loại bỏ

POST publish của phụ trợ cũ chấp nhận patch null khi legacy=true, availability=REMOVED và
cause khác GAME_PATCH; nội dung khác vẫn bắt buộc. Các hồ sơ này vẫn chỉ thuộc lưu trữ,
không vào GET /spells, /spells/{id} hoặc tham chiếu hiện hành. Dữ liệu nền AVAILABLE chưa rõ
patch tuân theo quy tắc quan sát ở trên. GET /spells/archived?region&locale&page&size trả
PageSlice các hồ sơ lưu trữ đã xuất bản (legacy/REMOVED, patch null) theo ruleset thị trường.
Revision của Phụ trợ có `archived:boolean` trong chi tiết và danh sách lịch sử, giúp client
phân biệt hồ sơ cũ với baseline hiện hành chưa rõ patch mà không tải thêm content từng bản.
Hồ sơ archived không được dùng làm nguồn gameplay mới; bổ sung nguồn loại bỏ qua API removals.

GET /admin/spells/{id}/removals?rulesetId trả các sự kiện loại bỏ đã xác nhận.
POST cùng đường dẫn (spell:publish) nhận revisionId,patchVariantId,sourceUrl,notes?.
Revision phải đã xuất bản và là phụ trợ cũ REMOVED; patch phải đã xuất bản cùng ruleset.
Trả 201 với id,revisionId,rulesetId,patchVariantId,sourceUrl,notes,recordedAt; trùng cùng
phụ trợ/patch trả SPELL_CONFLICT 409, nguồn/context sai trả SPELL_INVALID_CONTENT 422.
GET /admin/spell-removals?patchVariantId trả sự kiện của patch (catalog:read).
Public /patches/{id}/changes thêm domain=SPELL, chỉ gồm sự kiện xác nhận có nguồn;
không tự sinh sự kiện từ import hoặc xuất bản hồ sơ lưu trữ.

PUT nháp phụ trợ nhận thêm clearPatchContext=true để xóa mốc đã chọn nhầm, chỉ khi
DATA_BASELINE độc lập, legacy=true và REMOVED. Không được đồng thời gửi patch mới.
GAME_PATCH không được dùng hồ sơ không rõ patch làm baseline gameplay; hiệu chỉnh nội
dung/bản dịch vẫn được fork và giữ patch null.

### Timeline kho trang bị và đánh giá tổng thể

Cả GET /admin/items, /admin/arcana, /admin/spells, /admin/enchantments hỗ trợ seasonId/patchVariantId
như phần phù hiệu ở trên. Scope gồm cả hồ sơ được ghi nhận loại bỏ ở patch, kể cả snapshot ở patch trước.
GET /admin/catalog-changes?rulesetId&domain=ITEM|ARCANA|SPELL|ENCHANTMENT&locale cần catalog:read,
trả array {id,domain,ownerId,code,name,iconAssetId,rulesetId,patchVariantId,fromRevisionId,toRevisionId,
kinds,summary,actualLocale,sourceUrl,confirmed,recordedAt}. Mỗi owner/patch tối đa một dòng.
DATA_BASELINE không được tự coi ADDED; GAME_PATCH chưa xác nhận dùng UPDATED/confirmed=false.

POST /admin/{items|arcana|spells|enchantments}/{id}/changes cần :publish tương ứng và patch:write.
Body {patchVariantId,toRevisionId,fromRevisionId?,kinds,translations:[{locale,text}],sourceUrl}.
Patch/snapshot phải đã xuất bản, cùng owner/ruleset. Target là DATA_BASELINE hoặc GAME_PATCH.
Ngoại trừ REMOVED, target nằm đúng patch. From là snapshot đã xuất bản ở patch trước trong ruleset.
UPDATED/BUFF/NERF/BALANCE/REWORK/FIX cần GAME_PATCH và from; ADDED và DATA_BASELINE là nhãn độc lập.
REMOVED chỉ một kind, cho phép target ở patch trước để bổ sung lịch sử khi đã có nguồn.
Tóm tắt theo locale và nguồn HTTP bắt buộc. Trả 201 {id}; trùng owner/patch 409, sai nội dung 422.
Không cung cấp API kéo đổi/xóa lịch sử đã xác nhận.

PUT /admin/hero-changes/{changeSetId}/assessment cần patch:write, nhận {kind,expectedVersion}.
Kind dùng HeroChanges (ADJUSTMENT hiển thị Cân bằng) và thêm `RELEASE` (Ra mắt) chỉ cho change set có
`introducesHero=true`; change set khác nhận `RELEASE` trả 422. Dòng thay đổi không nhận `RELEASE`. Tạo đầu
version=0, lưu tăng version, xung đột 409. Change set không tồn tại trả 404 `HERO_PATCH_CHANGE_NOT_FOUND`.
API hero changes thêm overallKind,assessmentVersion; gameplayChanges của /admin/heroes thêm overallKind nullable,
giữ nguyên changeKinds là nhãn chi tiết. Sửa đánh giá không thay sự kiện kỹ năng/chỉ số.

### Xem toàn bộ dữ liệu tại mốc và rà soát patch

- `GET /admin/patch-variants/{id}/notes/{locale}` cần `catalog:read`, trả `{body, version}` của đúng patch và ngôn ngữ (chưa ghi: chuỗi rỗng, phiên bản 0).
  `PUT` cùng đường dẫn cần `patch:write`, nhận `{body, expectedVersion}`; tối đa 20.000 ký tự, để trống để bỏ ghi chú, xung đột trả 409.
  Ghi chú bổ sung không tạo sự kiện gameplay cho tướng hoặc kho trang bị.

- `GET /admin/patch-variants/{id}/hero-stat-samples` cần quyền `catalog:read`. Mỗi tướng có tối đa một mẫu,
  lấy revision mới nhất còn hiệu lực gắn trực tiếp với variant và bộ luật. Mẫu có trạng thái nháp, vai trò,
  chỉ số cơ bản đã nhập (`value`, `unit`, `percent`) và các giá trị đọc thủ công từ ảnh kèm patch và cấp tướng nếu biết.
  Mặc định kế thừa không được tính như một lần quan sát.

- `GET /admin/patch-variants/{id}/stat-defaults` cần quyền `catalog:read`. Mỗi dòng trả mã thuộc tính,
  giá trị, đơn vị, URL nguồn, patch khai báo và phiên bản của dòng. API kế thừa từ các patch đã xuất bản trong cùng bộ luật.
- `PUT /admin/patch-variants/{id}/stat-defaults/{key}` cần quyền `patch:write`. Body gồm
  `baseValue`, `unit` (POINT hoặc PERCENT), `sourceUrl` và `expectedVersion` của dòng tại patch đích
  (0 khi tạo). Thành công trả 204 và mở lại rà soát nếu cần. Khi xung đột phiên bản, trả 409.

- `GET /admin/{heroes|items|enchantments|arcana|spells}` thêm `includeUnchanged=true` khi lọc `seasonId` / `patchVariantId`: kế thừa dữ liệu đã xuất bản đến mốc đích. Mặc định giữ chế độ chỉ thay đổi.
- Với Trang bị và Phụ trợ, danh sách quản trị “Tất cả” có thể gửi thêm `includeUnscoped=true` cùng ruleset và mốc đang xem. Khi chưa có bản có ngày áp dụng phù hợp, danh sách trả bản đã xuất bản chưa rõ patch và giữ nguyên patch rỗng. Hồ sơ này không tạo thay đổi gameplay tại mốc đang xem.
- `PUT /admin/patch-variants/{id}/data-review`: quyền `patch:write`, body `{ state: "COMPLETE" | "IN_PROGRESS", expectedVersion: number }`. Mốc phải đã xuất bản; phiên bản ban đầu 0, trả 409 nếu bị thay đổi đồng thời.
- Publication overview bổ sung `dataReviewState`, `dataReviewVersion`, `dataReviewedAt` trên variant. Trạng thái này tách khỏi trạng thái xuất bản và trạng thái đang áp dụng của thị trường.


## Thuật ngữ và tham chiếu dùng chung (2026-10-20)

Các đường dẫn dưới đây nằm dưới `/api/wiki/v1`:

| Endpoint | Quyền | Kết quả |
|---|---|---|
| `GET /reference-settings` | Công khai | `{version, settings}` gồm thiết lập và thuật ngữ chung; không có đường dẫn admin |
| `GET /reference-catalog?region=VN&locale=vi-VN` | Công khai | Cấu hình kết hợp tướng/trang bị đã xuất bản, có hiệu lực theo thị trường |
| `GET /admin/reference-settings` | `catalog:read` | Toàn bộ cấu hình tùy chỉnh phục vụ biên tập |
| `PUT /admin/reference-settings` | `catalog:read`, `hero:write` | Body `{expectedVersion, settings}`, trả cấu hình đã lưu và version mới |

`icon` của một mục là địa chỉ ảnh hoặc `glyph:<tên>` để chọn một hình đơn sắc có sẵn. Khi đọc nội dung game, chỉ tên trong game (tướng, kỹ năng, trang bị, phù hiệu, bảng ngọc, phụ trợ, thuật ngữ) mới tự được nhận diện; đội, tuyển thủ, quốc gia chỉ thành tham chiếu khi người viết chủ động chèn bằng `@`. Mã chỉ gồm chữ số không bao giờ tự nhận diện, để `100%` không thành đội `100`.

`settings`: `{schemaVersion:1, autoRecognize, fallbackLocale, entities}`. Mỗi entity có `id` là khóa
tham chiếu, `kind` (`term`, `hero`, `item`, `enchantment`, `arcana`, `spell`), `translations:[{locale,name,aliases,description}]`, tùy chọn
`icon`, `autoMatch`, `display:{color,underline,showIcon}`, `destinations:{admin,wiki}`. Đích đến phải
là đường dẫn nội bộ. Tối đa 2.000 mục, 30 bản dịch/mục, 20 tên gọi khác/bản dịch, 4.000 ký tự mô tả.
Không đưa audit, token hoặc revision nháp vào API công khai. Tùy chỉnh tướng/trang bị chỉ xuất hiện
trong catalog công khai nếu đối tượng gốc được công khai tại context tương ứng.

Riêng `hero`, tùy chỉnh bản dịch chỉ bổ sung `aliases` theo locale: tên và mô tả luôn lấy từ snapshot tướng mà
backend chọn cho catalog admin/public. Các tên/mô tả đi kèm cấu hình lưu chỉ là ảnh chụp phục vụ tương thích schema,
không ghi đè nội dung tướng hoặc tạo bản dịch locale chưa có. Tên khác được gộp, cắt khoảng trắng và loại trùng
không phân biệt hoa thường; các tùy chỉnh icon/hiển thị/nhận diện khác giữ quy tắc hiện có. Các kind còn lại không đổi.

Version cũ: `409 REFERENCE_VERSION_CONFLICT`; nội dung không hợp lệ:
`422 REFERENCE_INVALID_SETTINGS`. GET kiểm tra whitelist query. Admin trả `Cache-Control: no-store`;
public yêu cầu revalidate. Không tự ghi dữ liệu khi GET hoặc khi mở tab thử hiển thị.


### Bổ sung nhóm tham chiếu — V030

Catalog công khai còn ghép Phù hiệu, Bảng ngọc và Phụ trợ từ read model đã xuất bản của từng module.
Mỗi module triển khai `PublicReferenceProvider`, không chia sẻ entity/repository. V030 mở rộng ràng
buộc kind của entry; không sửa V029 đã áp dụng. Mặc định các mục kho trang bị chỉ chèn bằng `@`,
không tự nhận diện tên dễ lẫn với lời mô tả. Có thể bật nhận diện riêng trong thiết lập tham chiếu.
Bộ chọn admin hỗ trợ lệnh nhóm tiếng Việt trước: `@Trang bị`, `@Phù hiệu`, `@Bảng ngọc`/`@Ngọc`,
`@Phụ trợ`, `@Tướng`, `@Thuật ngữ`; thêm tên sau nhóm để lọc, hỗ trợ tìm không dấu.

### Danh mục biên tập gọn và Redis — ADR-012

`GET /admin/reference-catalog?rulesetId=<UUID>` cần `catalog:read`, trả
`{rulesetId, items}`. `items` có cùng dạng entity tham chiếu ở trên, gồm toàn bộ bản dịch của snapshot
được chọn và đường dẫn biên tập. `rulesetId` là tùy chọn; mặc định chọn ruleset đang hoạt động có mã
`aov-standard`, nếu không có thì ruleset hoạt động đầu tiên. Query lạ bị từ chối. Không có ruleset
hoạt động thì trả danh mục rỗng. Không trả chiêu/chỉ số/công thức đầy đủ chỉ để dựng bộ chọn `@`.

Admin dùng revision chưa bị discard trong ruleset; kho trang bị ưu tiên thứ tự patch rồi revision.
Public giữ quy tắc chỉ lấy bản xuất bản tại gameplay context hiện hành và loại mục đã bị gỡ.
Locale public phải là BCP 47 chuẩn hóa, tối đa 64 ký tự; sai trả `422 REFERENCE_INVALID_LOCALE`
trước khi tra cache. Thời điểm và patch context được dùng chung cho các provider trong một snapshot đọc.
Các tên/mô tả/asset ID được đọc theo projection, Media đọc theo lô. Giao diện admin gọi một API này
thay vì gọi preview từng tướng, còn metadata icon chỉ tải khi kết quả sắp đi vào vùng nhìn thấy.

HTTP cache không đổi: admin `no-store`, public có ETag và yêu cầu revalidate. Redis chỉ cache read model
phía server: admin 30 giây, public catalog/thuật ngữ 2 phút mặc định; khóa tách admin/public, ruleset,
region/locale và patch hiện hành. Quyền được kiểm tra trước lookup. Epoch DB đổi trong cùng transaction
với audit để dữ liệu sửa/xuất bản/nâng phiên bản ảnh có hiệu lực cho request tiếp theo. Redis lỗi thì
đọc DB, có timeout ngắn và backoff; không cache lỗi, token, phiên đăng nhập hoặc bytes ảnh.


### Tóm tắt kỹ năng — V073 (13/11/2026)

Mỗi bản dịch của kỹ năng có trường tùy chọn `summary`: văn bản thường một đoạn, tối đa 300 ký tự, không xuống dòng.

- `PUT /admin/heroes/{heroId}/drafts/{draftId}/skills`: `translations[].summary` nhận chuỗi hoặc bỏ trống. Khoảng
  trắng đầu cuối được bỏ; chuỗi rỗng, chỉ có khoảng trắng hoặc `null` nghĩa là chưa có tóm tắt và xóa tóm tắt đang có
  của bản dịch đó. Dài quá 300 ký tự hoặc có ký tự xuống dòng trả 422 `HERO_INVALID_CONTENT`. Không bắt buộc khi xuất
  bản.
- Admin detail, preview và so sánh phiên bản trả `summary` trong từng bản dịch (`null` khi chưa có); khác biệt có path
  `/skills/<skillKey>/translations/<locale>/summary`.
- Public Hero detail và `skill-set-revisions` trả `summary` cùng `name`, `description` của bản dịch được chọn theo
  fallback locale (`null` khi bản dịch đó chưa có tóm tắt); không fallback riêng cho từng trường.
- Import: `values.skills[].translations[].summary` được nhận như các trường khác của bản dịch. Khi kỹ năng nhập vào
  không mang tóm tắt, tóm tắt đang có của cùng `skillKey` và locale được giữ; nếu mô tả của bản dịch đó đổi, `warnings`
  có thêm dòng "Cần xem lại tóm tắt kỹ năng <skillKey> (<locale>): mô tả đã đổi, tóm tắt cũ được giữ nguyên."
- `GET /admin/heroes/publish-readiness` và các API tham chiếu kỹ năng không trả `summary`.


### Thư viện icon kỹ năng theo tướng — V033 (2026-10-20)

- `GET /admin/heroes/{heroId}/skill-images`: cần `catalog:read`, không có query parameter; trả
  `{items:[{id,heroId,skillKey,sourceSlot,variantNo,assetId,sourceFilename,label,version,createdAt,updatedAt}]}`,
  sắp xếp slot rồi biến thể. Không tải gameplay, URL hoặc metadata Media trong endpoint này.
- `PUT /admin/heroes/{heroId}/skill-images/{sourceSlot}/{variantNo}`: cần `hero:write` và quyền nền
  `catalog:read`; body `{expectedVersion,assetId,skillKey?,sourceFilename,label?}`. Dùng expectedVersion=-1
  để tạo; cập nhật dùng version hiện tại. Gửi lại cùng payload trả cùng hàng/version; payload khác với
  version cũ trả 409 `HERO_SKILL_IMAGE_CONFLICT`. Slot/biến thể là vị trí nguồn ổn định, không phải
  khẳng định chiêu/dạng gameplay. sourceFilename chỉ là tên file, không chứa đường dẫn.

Asset phải ACTIVE, có phiên bản dùng được và semantic `HERO_SKILL_ICON`. skillKey nullable cho ảnh
chưa thu thập thông tin; nếu gửi phải là identity kỹ năng đã tồn tại của chính tướng đó. Mỗi thay đổi
ghi audit. API không tạo/sửa snapshot tướng hoặc mô tả chiêu. MediaUsageProvider giữ tham chiếu
ảnh thư viện kể cả khi chưa liên kết skillKey. Upload vẫn theo Media presigned flow thông thường.

### Tìm và giải quyết tham chiếu kỹ năng (2026-10-20)

- `GET /admin/reference-skills`: cần `catalog:read`; query whitelist
  `rulesetId,locale,q,heroId,ids,page,size`. Bỏ rulesetId thì chọn `aov-standard` đang hoạt động,
  rồi ruleset hoạt động đầu tiên; gửi UUID không tồn tại/không hoạt động trả lỗi `PATCH_INVALID`,
  không tự đổi ngữ cảnh. Admin trả tất cả bản dịch của revision chưa discard gần nhất.
- `GET /reference-skills`: công khai; query whitelist `region,locale,q,heroId,ids,page,size`.
  Mặc định VN/vi-VN. Luôn giải quyết gameplay context hiện tại trước cache, chỉ dùng revision đã
  xuất bản, không vượt patch/ngày xuất bản hiện hành. Locale dùng BCP 47 chuẩn như danh mục chung.

Cả hai trả `PageSlice`: `{items,page,size,totalElements}`. Tìm bằng `q` tối đa 120 ký tự, page>=0,
size mặc định 20, tối đa 100. `heroId` tùy chọn để giới hạn tướng. Tìm không dấu theo mã/tên tướng,
tên kỹ năng, tên dạng của biến thể (`formKey`, ví dụ `Viên đao`, `Phi hành`) và nhãn ảnh theo trạng thái
của kỹ năng (ví dụ `Hải quái`); mỗi từ còn lại phải khớp một trong các trường đó. Nhận lệnh nhóm
`Kỹ năng`/`Chiêu`/`Chiêu thức`/`Skill`, slot và biến thể nguồn theo thứ tự bất kỳ so với tên tướng.
`chiêu 1 airi` và `airi chiêu 1` tương đương; `edras chiêu 2 1` là slot 2 biến thể 1. Slot còn viết
được dạng ngắn `c1`/`s1` (kèm biến thể: `c2 2`), `chiêu1`; `chiêu cuối`/`ult` là slot 3; `nội tại`,
`passive`, `nt` là slot 0. `yena viên đao c1`, `billow hải quái` và `superman phi hành chiêu 2` đều
tìm được kỹ năng tương ứng. Không suy ra biến thể từ mảng hoặc tên dịch; token đã lưu vẫn là
`<heroUUID>.<skillKey>` nên đổi tên dạng hay nhãn trạng thái không làm hỏng tham chiếu cũ.

`ids` là danh sách tối đa 50 `<heroUUID>.<skillKey>` ngăn bằng dấu phẩy; loại trùng, không dùng cùng
q khác rỗng, size mặc định 50. Token cũ được giải quyết bằng revision hợp lệ gần nhất còn chứa
skillKey, vẫn trong ruleset/context cho phép; ID thiếu không làm rò dữ liệu chưa công khai.
Query lạ hoặc giới hạn sai trả `400 INVALID_QUERY_PARAMETER`.

Mỗi item gồm `id,kind="skill",heroId,skillKey,revisionId,sourceSlot?,variantNo?,formKey?,translations,
autoMatch=false,destinations,owner`. `owner` có `id,kind="hero",translations` và icon head từ cùng
revision. Admin có `iconAssetId?`, `iconSource?=REVISION|LIBRARY`; ảnh gán trong revision ưu tiên,
fallback thư viện chỉ khi match duy nhất theo skillKey hoặc khóa `skill-<slot>-<variant>` và hàng
thư viện chưa gán skillKey. Match mơ hồ không đoán. Public chỉ trả URL `icon?` từ asset revision
đang dùng được, không fallback thư viện. Mô tả rút gọn tối đa 4000 ký tự. Link dùng `tab=skills`
và `skill=<skillKey>` để mở đúng kỹ năng; admin kèm revision/ruleset.

Không đưa mọi kỹ năng vào `/reference-catalog`. API mới dùng read model cache riêng tiền tố `skills:v1`
trong namespace admin/public hiện có, chứa bộ lọc/phân trang/IDs và context; invalidation theo epoch
ADR-012. Quyền kiểm tra trước cache, cache ngoài transaction đọc; public ETag/revalidate, admin no-store.
Metadata kỹ năng chỉ dùng khi đọc/hiển thị; không lưu thành entry tùy chỉnh trong cấu hình tham chiếu.

## Cập nhật mùa hiện tại trên trang chủ wiki

`GET /api/wiki/v1/seasons/current/updates?region=VN&locale=vi-VN&limit=4` là API public chỉ đọc,
query chỉ nhận `region`, `locale`, `limit`; `limit` từ 1 đến 10. Locale là BCP 47 chuẩn.
Trả `{region, requestedLocale, asOf, season, currentPatchId, patches}`. `season` gồm
`{id, code, displayName}`; mỗi patch gồm `{id, code, title, summary, actualLocale, effectiveAt,
effectiveOn, sourceUrl, isCurrent}`. Chọn bản dịch theo locale yêu cầu, rồi `vi-VN`, rồi thứ tự locale.

Mùa được xác định từ gameplay context đang có hiệu lực của thị trường, ưu tiên mùa gắn trực tiếp
vào release rồi mùa của variant. Chỉ trả release `SCHEDULED` đã có hiệu lực, patch/variant
`PUBLISHED`, cùng thị trường, ruleset và mùa; mới nhất trước. Không dùng ngày trong mã patch
hoặc dữ liệu admin để đoán mùa. Nếu chưa có context hoặc mùa, trả `season: null` và `patches: []`;
thị trường không hỗ trợ vẫn trả lỗi hiện hành. Patch tương lai, bản nháp và release đã hủy không xuất hiện.

Release có ngày công bố `effectiveOn` thì giữ ngày đó, không trả giờ xác nhận thành giờ phát hành:
`effectiveAt` trong kết quả là null. Response dùng `Cache-Control: no-cache, public` để trình duyệt
kiểm tra lại thay đổi mùa khi tải trang. API không sửa dữ liệu, không cần migration hay quyền admin.

## Xuất bản riêng ảnh trang phục

`POST /api/wiki/v1/admin/heroes/{heroId}/skin-images/publish` nhận
`{sourceRevisionId, imageSourceRevisionId, expectedImageSourceVersion, region, changeNote?}`.
`sourceRevisionId` phải vẫn là bản đã xuất bản hiện hành tại thị trường `region`;
`imageSourceRevisionId` là bản nháp của cùng tướng, cùng ruleset, có version đúng như request.
API cần đồng thời `catalog:read`, `hero:write` và `hero:publish`, không nhận query bổ sung.

Tác vụ khóa tướng, chép chỉ các trường `artAssetId`, `headAssetId`, `portraitAssetId`, `images`
của từng trang phục có cùng `skinKey`, rồi tạo một revision `PUBLISHED` mới có cause `VISUAL_UPDATE`.
Khóa, thứ tự, tên, mô tả, bậc, cách sở hữu, nguồn và danh sách trang phục của bản đã xuất bản
được giữ nguyên; không thêm trang phục chỉ có trong nháp. Ảnh nháp còn thiếu không xóa ảnh đang dùng,
ảnh ứng viên cũ được giữ theo chính sách Media hiện có. Asset mới phải qua kiểm tra semantic type,
trạng thái và phiên bản dùng được như các thao tác xuất bản thông thường.

Các section khác và `effectiveFromPatchVariantId` giữ nguyên bản nguồn. Bản nháp dùng làm nguồn ảnh
không bị sửa, xuất bản hoặc hủy, nên có thể tiếp tục biên tập nội dung riêng. Tác vụ không tạo thêm
nháp và không thay đổi ràng buộc một nháp mỗi tướng/ruleset. Mọi ghi diễn ra trong một transaction,
có actor và audit `HERO_SKIN_IMAGES_PUBLISHED`; snapshot cũ không bị sửa.

Response là `HeroRevisionView` mới; nếu các ảnh đã giống hệt thì trả bản nguồn hiện hành và không tạo
revision thừa. Nguồn đã xuất bản hoặc version nháp thay đổi trả `409 HERO_REVISION_VERSION_CONFLICT`;
client cần đọc lại trước khi thử. Tác vụ không đổi lịch patch hoặc trạng thái hoàn tất nhập liệu gameplay.


### Nguồn ảnh và liên hệ Media (28/10/2026)

`SourceRequest` bổ sung `ownerName` (nullable, tối đa 200) và `contactUrl` (nullable, HTTP(S),
tối đa 2048). `version-uploads` nhận thêm `source` cùng schema; nguồn được lưu trong session
và gắn đúng version khi complete, kể cả khi bytes trùng. Không ghi thêm nguồn khi retry một
session đã READY. Client cũ vẫn được phép bỏ source.

`MediaAssetReference.currentVersion.sources` trả danh sách `{type,label,url,ownerName,contactUrl,
observedAt}`. Khi có provenance riêng cho version, dùng danh sách này; nếu chưa có thì dùng nguồn
cấp asset. Không lẫn nguồn phiên bản khác; không trả note hoặc đường dẫn import nội bộ.

`GET /admin/media/assets` bổ sung `sources` cùng schema trên cho phiên bản hiện hành của từng ảnh;
ảnh chưa có phiên bản trả mảng rỗng. Truy vấn nguồn theo lô cho cả trang. Admin dùng thông tin này
để đánh dấu ảnh cần bổ sung nguồn / credit; không tự suy ra chủ sở hữu từ URL hoặc tên đội.

- POST `/api/wiki/v1/admin/media/assets/{assetId}/versions/{versionId}/sources`: body là SourceRequest,
  cần `catalog:read` và `media:write`; trả 200 asset detail. Bổ sung cùng toàn bộ nội dung nguồn đã có
  là no-op. Version khác asset trả MEDIA_VERSION_NOT_FOUND; asset không active giữ lỗi hiện hành.
- POST `/api/wiki/v1/media/contact-requests`: công khai, không nhận query; body
  `{assetId?,versionId?,name,email,topic,message}`. Asset/version phải đi cùng nhau và thuộc nhau.
  Trả 201 `{id}`, Cache-Control no-store; không echo email/nội dung. Giới hạn name 200, email 254,
  message 4000; topic SOURCE/RIGHTS/OTHER. Vượt giới hạn gửi trả 429 MEDIA_CONTACT_RATE_LIMITED.
- GET `/api/wiki/v1/admin/media/contact-requests?page=0&size=20`: cần thêm `media:write`, trả PageSlice,
  tối đa 100, chỉ nhận page/size. Bao gồm thông tin riêng của người gửi để xử lý yêu cầu.
- POST `/api/wiki/v1/admin/media/contact-requests/{id}/resolve`: cần `media:write`, trả bản ghi RESOLVED;
  gọi lặp giữ resolvedAt cũ. Không tồn tại trả 404 MEDIA_CONTACT_NOT_FOUND; có audit, không gửi email.


### Danh mục chủ sở hữu ảnh (01/11/2026, ADR-017)

`SourceRequest.ownerName` giữ nguyên schema. Khi ghi nguồn, backend bỏ khoảng trắng đầu/cuối, gộp
khoảng trắng liên tiếp và so khớp không phân biệt hoa/thường với danh mục chủ sở hữu; chưa có thì tạo
mới. Nguồn được lưu và trả về với tên hiển thị của chủ sở hữu, ví dụ gửi `"garena  / liên quân mobile"`
khi đã có "Garena / Liên Quân Mobile" thì nguồn ghi "Garena / Liên Quân Mobile". Nguồn không gửi
`contactUrl` nhận liên hệ của chủ sở hữu (nếu có). `ProvenanceDetails` (chi tiết asset admin) bổ sung
`ownerId` nullable. Các response khác (`sources` trong danh sách, `MediaAssetReference`) không đổi.

`MediaOwnerView`: `{id, name, contactUrl, assetCount, version}`. `assetCount` là số asset có ít nhất
một nguồn gắn chủ sở hữu này.

- GET `/api/wiki/v1/admin/media/owners?q=&page=0&size=20`: cần `catalog:read`, chỉ nhận `q`, `page`,
  `size` (size tối đa 100). `q` (tối đa 200) so khớp chứa trong tên đã chuẩn hóa, không phân biệt
  hoa/thường. Sắp theo `assetCount` giảm dần rồi tên. Trả PageSlice.
- PUT `/api/wiki/v1/admin/media/owners/{id}`: cần `media:write`; body
  `{name, contactUrl?, expectedVersion}` (name bắt buộc, tối đa 200; contactUrl HTTP(S), tối đa 2048,
  null để bỏ). Cập nhật tên trên mọi nguồn của chủ sở hữu và liên hệ trên các nguồn đang mang liên hệ
  cũ của chủ sở hữu, trong một transaction, có audit `MEDIA_OWNER_UPDATED`. Trả `MediaOwnerView`.
  Không tồn tại trả 404 `MEDIA_OWNER_NOT_FOUND`; tên trùng (sau chuẩn hóa) với chủ sở hữu khác trả 409
  `MEDIA_OWNER_NAME_TAKEN` với context `ownerId`; `expectedVersion` cũ trả 409
  `MEDIA_OWNER_VERSION_CONFLICT` với context `currentVersion`.
- POST `/api/wiki/v1/admin/media/owners/{id}/merge`: cần `media:write`; body
  `{targetId, expectedVersion}` (phiên bản của chủ sở hữu bị gộp). Chuyển mọi nguồn sang chủ sở hữu
  đích, lấy tên của đích, rồi xóa chủ sở hữu bị gộp; audit `MEDIA_OWNERS_MERGED`. Trả `MediaOwnerView`
  của đích. Gộp vào chính nó trả 400 `INVALID_REQUEST`; không tồn tại hoặc phiên bản cũ trả lỗi như PUT.

Giao diện admin gợi ý tên chủ sở hữu đã có khi nhập và hỏi lại khi tên mới gần giống tên sẵn có (so
sánh không dấu). Đây chỉ là gợi ý; backend không tự suy ra chủ sở hữu từ URL, tên file hay tên đội.

### API page cộng đồng và kế hoạch giải (ADR-018)

Bổ sung các nhóm /pages, /me, /admin/pages, /admin/page-claims, /admin/community-reports,
/competitions, /admin/competitions dưới /api/community/v1. Endpoint, body và phân quyền tại
[04-QUAN-LY-THI-DAU-VA-PAGE.md](04-QUAN-LY-THI-DAU-VA-PAGE.md), phần API.
Quyền theo page độc lập tournament:write/publish; API công khai không trả bằng chứng claim hay actor.

## Tham chiếu hồ sơ của ảnh (03/11/2026)

`SourceRequest` nhận thêm `ownerPageId`, `relatedPageId` (UUID nullable); upload, tạo asset, import và
bổ sung nguồn giữ nguyên hai trường đến `ProvenanceDetails` và `MediaCredit` công khai. Tên credit,
URL nguồn và URL liên hệ độc lập tham chiếu. `ProvenanceDetails.referenceVersion` là phiên bản riêng
cho việc cập nhật tham chiếu. Dữ liệu cũ không có tham chiếu trả null.

PUT `/api/wiki/v1/admin/media/assets/{assetId}/sources/{sourceId}/references`
- Quyền: `catalog:read` và `media:write`; asset phải còn ACTIVE, nguồn phải thuộc asset.
- Body: `{expectedVersion, ownerPageId, relatedPageId}`; expectedVersion bắt buộc, không âm.
- Trả `MediaAssetDetails`; không thay version ảnh đang hiển thị, tên credit, nhãn nguồn, URL hay ghi chú.
- 404 `MEDIA_SOURCE_NOT_FOUND` nếu không có nguồn thuộc ảnh; 409 `MEDIA_SOURCE_VERSION_CONFLICT` nếu
  tham chiếu đã đổi. Dùng null để gỡ tham chiếu, audit `MEDIA_SOURCE_REFERENCES_UPDATED`.
- Wiki không gọi Community trong transaction và không tự xác minh page; chỉ nhận UUID. UI chọn hồ sơ
  bằng API Community, khách chỉ đọc được bản đã công bố. Tham chiếu không khả dụng vẫn giữ credit và
  URL nguồn. Việc liên kết không cấp quyền đại diện hay khẳng định giấy phép sử dụng ảnh.

Community bổ sung loại page `CIRCUIT` và bộ lọc `circuitPageId` ở danh sách kế hoạch/mùa giải; chi tiết
hợp đồng và tính bất biến của snapshot theo đặc tả 04.

## Video theo đối tượng (ADR-019)

GET `/api/wiki/v1/videos` (công khai)
- Query: `subjectKind` và `subjectId` bắt buộc, `subjectKey` tùy chọn; tham số khác trả 400.
- `subjectKind=HERO` trả cả video của kỹ năng và trang phục của tướng đó. `SKILL`, `SKIN` kèm
  `subjectKey` thu về một mục. `subjectKey` với loại khác trả 422 `VIDEO_INVALID`.
- Trả `{items: [...]}`, tối đa 200 dòng `PUBLISHED`, theo `displayOrder` rồi ngày đăng mới nhất. Mỗi dòng
  không có `status`, `origin`, `version`. Cache: `no-cache`, `public`. Lọc theo patch do client thực hiện.

Các API quản trị đều cần `catalog:read`. Ghi cần `hero:write` (tướng, kỹ năng, trang phục), `item:write`,
`enchantment:write`, `arcana:write` hoặc `spell:write`. Đưa video vào hoặc ra khỏi `PUBLISHED` cần thêm
capability `:publish` tương ứng; thiếu quyền trả 403.

GET `/api/wiki/v1/admin/videos`
- Query: `subjectKind`, `subjectId`, `subjectKey`, `status`, `purpose`, `origin`, `q`, `page`, `size` (1 đến 100,
  mặc định 24). `HERO` kèm `subjectId` gồm cả kỹ năng và trang phục của tướng. Trả `PageSlice`.

GET `/api/wiki/v1/admin/videos/subjects`
- Query: `locale`, mặc định `vi-VN`. Trả `{items: [{kind, id, key, code, name, aliases}]}` cho mọi mục có thể
  gắn video. `aliases` gồm tên cũ và mã cũ, dùng để so khớp dữ liệu nhập.

POST `/api/wiki/v1/admin/videos` và PUT `/api/wiki/v1/admin/videos/{id}`
- Body: `subjectKind`, `subjectId`, `subjectKey`, `purpose`, `title`, `note`, `url`, `startSeconds`,
  `durationSeconds`, `channelName`, `publishedOn`, `patchVariantId`, `displayOrder`, `status`,
  `expectedVersion` (bắt buộc với PUT). POST trả 201.
- `url` chỉ nhận `http`, `https`. Mọi dạng link YouTube đổi về `https://www.youtube.com/watch?v=ID`; `startSeconds`
  null thì lấy từ `t=` hoặc `start=` của link. Thiếu `displayOrder` khi tạo thì xếp cuối.
- Lỗi: 422 `VIDEO_INVALID`, 422 `VIDEO_SUBJECT_NOT_FOUND`, 404 `PATCH_NOT_FOUND` khi patch không tồn tại,
  404 `VIDEO_NOT_FOUND`, 409 `VIDEO_DUPLICATE`, 409 `VIDEO_CONFLICT`. Audit `VIDEO_CREATED`, `VIDEO_UPDATED`.

DELETE `/api/wiki/v1/admin/videos/{id}?expectedVersion=`
- Trả 204. Audit `VIDEO_DELETED`. Video nhập từ dữ liệu thu thập nên ẩn thay vì xóa để không quay lại.

POST `/api/wiki/v1/admin/videos/import`
- Body: `{items: [{subjectKind, subjectId, subjectKey, purpose, title, url, durationSeconds, publishedOn,
  displayOrder, status}]}`, 1 đến 500 dòng; kiểm tra quyền của mọi dòng trước khi ghi.
- Trả `{created, skipped, rejected: [{index, reason}]}`. Dòng đã có bị bỏ qua và giữ nguyên; dòng sai được báo
  mà không làm hỏng cả lô. Audit `VIDEOS_IMPORTED` nếu có dòng được thêm.

## Chế độ chơi và Cờ Liên quân (ADR-023)

Nội dung trả `contentLocale: "vi-VN"`. Ảnh trả dạng `{assetId, url, width, height, credits}` chỉ khi asset dùng
được; asset thiếu hoặc chưa sẵn sàng bị bỏ qua thay vì lỗi. Mã lỗi thuộc `GameModeErrorCode`:
404 `GAME_MODE_NOT_FOUND`, 404 `GAME_MODE_REVISION_NOT_FOUND`, 404 `GAME_MODE_GUIDE_NOT_FOUND`,
404 `GAME_MODE_LINEUP_NOT_FOUND`, 409 `GAME_MODE_CONFLICT`, 409 `GAME_MODE_CODE_TAKEN`,
422 `GAME_MODE_INVALID_CONTENT` (kèm `missingFields` khi xuất bản thiếu dữ liệu), 403 `GAME_MODE_FORBIDDEN`,
429 `GAME_MODE_RATE_LIMITED`.

### Public

GET `/api/wiki/v1/game-modes`
- Không có query. Trả `{items: [GameModeCard]}` của các chế độ đã xuất bản, sắp theo nhóm (`PVP` trước) rồi
  thứ tự hiển thị. Card gồm `code`, `name`, `group`, `summary`, `playersLabel`, `duration`, `availability`,
  `art`, `hasGuide`.

GET `/api/wiki/v1/game-modes/{code}`
- Trả chế độ đã xuất bản: card + `rules`, `heroes`, `specialItems`, `sources`, `publishedAt`. 404 khi chưa
  xuất bản.

GET `/api/wiki/v1/game-modes/{code}/auto-chess`
- Trả cẩm nang đã xuất bản: nội dung ở 01, ảnh đã hydrate, mỗi đội hình đề xuất có `likes`, `recentLikes`.
  404 `GAME_MODE_GUIDE_NOT_FOUND` khi chế độ không có cẩm nang xuất bản.

GET `/api/wiki/v1/game-modes/{code}/auto-chess/lineups`
- Query: `sort` (`popular` mặc định, `trending`, `recent`), `unit` (mã quân cờ, tùy chọn), `page`, `size`
  (1–50, mặc định 20). Trả `PageSlice` đội hình cộng đồng đang hiển thị: `id`, `name`, `note`, `units`,
  `emblems`, `likes`, `recentLikes`, `createdAt`, `updatedAt`. Không có thông tin người đăng.

GET `/api/wiki/v1/game-modes/{code}/auto-chess/insights`
- Trả `{lineupCount, communityLineupCount, units: [{code, appearances, weighted, carryCount}],
  traits: [{code, activations, topTierReached}], costs: [{cost, count}]}` từ đội hình đề xuất xuất bản và đội
  hình cộng đồng đang hiển thị (tối đa 2000 đội hình nhiều lượt thích nhất). `weighted` = số lần xuất hiện
  nhân (1 + lượt thích).

### Người dùng đăng nhập

Cần Bearer token hợp lệ audience `wiki-service` của tài khoản người; không cần role. Service account nhận 403
`GAME_MODE_FORBIDDEN`. Các route này nằm dưới `/users/me` như mọi thao tác khác của người đăng nhập: luôn cần token
và trả `Cache-Control: no-store`.

GET `/api/wiki/v1/users/me/game-modes/{code}/auto-chess`
- Trả `{likedLineupIds: [UUID], lineups: [CommunityLineup + status, version]}` của người gọi trong chế độ.

PUT / DELETE `/api/wiki/v1/users/me/game-modes/{code}/auto-chess/likes/{lineupId}`
- Không có body. Trả `{lineupId, liked, likes}`. Idempotent. 404 khi đội hình không thuộc chế độ, đã ẩn hoặc
  không có trong cẩm nang xuất bản (DELETE vẫn trả 200 nếu người gọi từng thích). 422 khi tự thích.
  429 khi vượt giới hạn.

POST `/api/wiki/v1/users/me/game-modes/{code}/auto-chess/lineups`
- Body: `{name, note, units: [{unitCode, carry, row, itemCodes}], emblems: [traitCode]}`. Trả 201 đội hình.
  422 khi mã không có trong cẩm nang xuất bản hoặc vượt giới hạn số lượng; 429 khi vượt tần suất.

PUT `/api/wiki/v1/users/me/game-modes/{code}/auto-chess/lineups/{lineupId}`
- Body như POST cộng `expectedVersion`. Chỉ người đăng. 409 `GAME_MODE_CONFLICT` khi phiên bản cũ.

DELETE `/api/wiki/v1/users/me/game-modes/{code}/auto-chess/lineups/{lineupId}?expectedVersion=`
- Chỉ người đăng. Trả 204, xóa lượt thích của đội hình.

### Admin

Cần `catalog:read`; ghi cần `gamemode:write`; xuất bản, ẩn/hiện đội hình cần `gamemode:publish`.
Mọi thao tác ghi có `expectedVersion` trừ tạo mới; audit `GAME_MODE_*`, `AUTO_CHESS_*`, `LINEUP_*`.

- GET `/api/wiki/v1/admin/game-modes` — danh sách mọi chế độ: `id`, `code`, `name`, `group`, `order`,
  `guideKind`, `published` (revision xuất bản gần nhất hoặc null), `draft` (nháp mở hoặc null), `guide`
  (trạng thái cẩm nang).
- POST `/api/wiki/v1/admin/game-modes` — body `{code, name, group, content?}`; tạo identity và nháp đầu; 201.
  409 `GAME_MODE_CODE_TAKEN` khi trùng mã.
- GET `/api/wiki/v1/admin/game-modes/{id}` — nháp mở nếu có, không thì bản xuất bản gần nhất; kèm
  `missingFields` và ảnh đã hydrate (kể cả nháp).
- GET `/api/wiki/v1/admin/game-modes/{id}/revisions` và `/revisions/{revisionId}` — lịch sử và một revision.
- POST `/api/wiki/v1/admin/game-modes/{id}/drafts` — body `{changeNote}`; tạo nháp từ bản xuất bản gần nhất;
  409 nếu đã có nháp mở.
- PUT `/api/wiki/v1/admin/game-modes/{id}/drafts/{revisionId}` — body `{expectedVersion, content, changeNote}`.
- POST `/api/wiki/v1/admin/game-modes/{id}/drafts/{revisionId}/publish` và `/discard` — body
  `{expectedVersion, changeNote}`.
- Cẩm nang Cờ Liên quân dùng cùng bộ endpoint dưới `/api/wiki/v1/admin/game-modes/{id}/auto-chess`
  (GET hiện hành, GET `revisions`, GET `revisions/{revisionId}`, POST `drafts` với `{changeNote, content?}` —
  `content` chỉ dùng cho nháp đầu tiên khi chưa có bản xuất bản, PUT `drafts/{revisionId}`, POST
  `drafts/{revisionId}/publish`, `drafts/{revisionId}/discard`). 422 khi chế độ không có `guideKind = AUTO_CHESS`.
- GET `/api/wiki/v1/admin/game-modes/{id}/auto-chess/community-lineups` — query `status`, `page`, `size`;
  `PageSlice` đội hình cộng đồng kèm `likes`, `status`, `hiddenReason`, `version`, `updatedAt`.
- POST `/api/wiki/v1/admin/game-modes/{id}/auto-chess/community-lineups/{lineupId}/visibility` — body
  `{expectedVersion, hidden, reason}`; lý do bắt buộc khi ẩn.

## Build đề cử theo tướng (ADR-026)

Mapping dùng `ApiPaths.ADMIN` hoặc `ApiPaths.ROOT` và `version="1"`. Admin: đọc cần `catalog:read`; nhập, sửa bộ, xóa
cần `hero:write`; xác nhận cần `hero:publish`. Audit `BUILD_CAPTURE_IMPORTED`, `BUILD_REVIEWED`,
`BUILD_CAPTURE_CONFIRMED`, `BUILD_CAPTURE_DELETED`. Mã lỗi thuộc `BuildErrorCode`: 404 `BUILD_CAPTURE_NOT_FOUND`,
404 `BUILD_NOT_FOUND`, 404 `BUILD_HERO_NOT_FOUND`, 409 `BUILD_CAPTURE_EXISTS`, 409 `BUILD_VERSION_CONFLICT`
(`context.currentVersion`), 409 `BUILD_REVIEW_OPEN` (`context.needsReview`), 422 `BUILD_INVALID` (`context.unknownCodes`
khi có mã lạ, dạng `{"ITEM": ["…"]}`).

```http
GET    /api/wiki/v1/admin/build-captures?region=VN&source=PRO&page=0&size=20
POST   /api/wiki/v1/admin/build-captures
GET    /api/wiki/v1/admin/build-captures/{captureId}
DELETE /api/wiki/v1/admin/build-captures/{captureId}?expectedVersion=1
PUT    /api/wiki/v1/admin/build-captures/{captureId}/builds/{buildId}
POST   /api/wiki/v1/admin/build-captures/{captureId}/confirm
GET    /api/wiki/v1/builds?hero=toro&region=VN
```

**Danh sách** trả `PageSlice` mới chụp trước; `region`, `source` tùy chọn, `size` 1–100 (mặc định 20). Mỗi mục:

```json
{
  "id": "…", "code": "vn-pro-20261111", "regionCode": "VN", "sourceKind": "PRO", "sourceLabel": "Đề cử Pro",
  "capturedAt": "2026-11-11T05:02:43Z", "sourceTimeZone": "Asia/Ho_Chi_Minh", "patchVariantId": "…",
  "patchCode": "…", "confirmedAt": null, "heroCount": 57, "buildCount": 171, "needsReviewCount": 4, "version": 1
}
```

**Nhập** (201, trả chi tiết). Body là phần `capture` của `build-manifest.json`:

```json
{
  "code": "vn-pro-20261111", "regionCode": "VN", "sourceKind": "PRO", "sourceLabel": "Đề cử Pro",
  "capturedAt": "2026-11-11T05:02:43Z", "sourceTimeZone": "Asia/Ho_Chi_Minh",
  "sourceRun": "pro-builds-20261111-120243-738", "sourceNote": "…",
  "images": [{ "imageId": "<sha256>", "fileName": "pro-001/pro-001-1.png", "width": 2400, "height": 1080, "layout": "PREPARE" }],
  "heroes": [{
    "heroCode": "toro", "nameOnScreen": "Toro", "captureOrder": 1, "result": "COLLECTED",
    "builds": [{
      "position": 1, "imageId": "<sha256>",
      "items": [{ "slot": 1, "code": "…" }],
      "enchantments": [{ "slot": 1, "code": "…" }],
      "arcana": [{ "code": "…", "quantity": 10 }],
      "spell": "…", "playerName": null, "playerPower": null, "playerWinRate": null,
      "needsReview": false, "note": null
    }]
  }]
}
```

Quy tắc: `code` slug; `regionCode` `^[A-Z]{2,16}$`; `sourceKind` `PRO`/`HOT`/`SYSTEM`; `sourceTimeZone` là múi giờ IANA;
`layout` hiện chỉ có `PREPARE`. Ảnh không trùng `imageId`; tướng không trùng, `captureOrder` không trùng; mã tướng
(mã cũ trong alias được chấp nhận), trang bị, ngọc, phù hiệu, phụ trợ phải tồn tại và đã xuất bản. Tướng `COLLECTED`
mới có `builds`; `position` không trùng trong một tướng; `imageId` của bộ phải nằm trong `images`. Mỗi bộ: trang bị ô
1–6 không trùng ô, phù hiệu ô 1–5 không trùng ô hay mã, ngọc không trùng mã và `quantity` 1–10. Một phần chưa đủ
(ít hơn 6 trang bị, ít hơn 5 phù hiệu, không có phụ trợ) thì phần đó không được lưu và bộ phải có `needsReview: true`.
`arcana` có thể rỗng: bộ vẫn đủ, chỉ không có trang ngọc. Phần đủ phải đúng luật: tổng ngọc mỗi màu ≤ 10; ô 1–3 cùng một nhánh, bậc 1, 2, 3 theo thứ tự ô;
ô 4–5 khác nhánh chính, cùng nhánh thì bậc 1 và 2, khác nhánh thì cả hai bậc 1. `patchVariantId` lấy từ
`GameplayContexts.resolve(regionCode, capturedAt)` nếu thị trường có lịch. Trùng `code` trả 409 `BUILD_CAPTURE_EXISTS`.

**Chi tiết** trả các trường của danh sách cộng `sourceRun`, `sourceNote`, `createdAt`, `images` và `heroes` theo
`captureOrder`:

```json
{
  "heroId": "…", "heroCode": "toro", "nameOnScreen": "Toro", "captureOrder": 1, "result": "COLLECTED",
  "builds": [{
    "id": "…", "position": 1, "imageId": "…",
    "items": [{ "slot": 1, "itemId": "…", "code": "…" }],
    "enchantmentSetId": "…", "enchantments": [{ "slot": 1, "enchantmentId": "…", "code": "…" }],
    "arcanaPageId": "…", "arcana": [{ "arcanaId": "…", "code": "…", "quantity": 10 }],
    "spellId": "…", "spellCode": "…", "contentKey": "…",
    "playerName": null, "playerPower": null, "playerWinRate": null,
    "needsReview": false, "note": null, "reviewedAt": null, "version": 1
  }]
}
```

Ngọc sắp theo màu (đỏ, tím, xanh) rồi theo mã.

**Sửa hoặc duyệt một bộ** — body thay toàn bộ nội dung:
`{expectedVersion, items: [{slot, itemId}], enchantments: [{slot, enchantmentId}], arcana: [{arcanaId, quantity}],
spellId?, playerName?, playerPower?, playerWinRate?, needsReview, note?}`. Luật như khi nhập, dùng UUID thay mã.
`needsReview: false` cần đủ trang bị, phù hiệu, phụ trợ (ngọc tùy chọn) và ghi `reviewedAt/_by`; `needsReview: true` xóa thông tin duyệt và bỏ xác nhận
của lần chụp nếu đã xác nhận. Trả `{build, capture}` với `capture` là mục danh sách sau khi lưu. Version cũ trả 409
`BUILD_VERSION_CONFLICT`. Trang ngọc, bộ phù hiệu cũ không còn bộ nào dùng bị xóa.

**Xác nhận lần chụp** — body `{expectedVersion}`; trả mục danh sách. Còn bộ chờ duyệt trả 409 `BUILD_REVIEW_OPEN`. Lần
chụp đã xác nhận thì không đổi gì và trả 200.

**Xóa** — `expectedVersion` bắt buộc; trả 204, xóa ảnh, tướng, bộ của lần chụp và trang ngọc, bộ phù hiệu không còn dùng.

### Công khai

`GET /builds?hero={mã}&region={thị trường}` — không cần đăng nhập; chỉ nhận hai tham số này. Mã tướng lạ trả 404
`BUILD_HERO_NOT_FOUND`. Với mỗi `sourceKind`, lấy lần chụp **đã xác nhận** mới nhất ở thị trường đó có tướng này và trả
các bộ không chờ duyệt, gộp theo `contentKey` theo thứ tự xuất hiện:

```json
{
  "heroId": "…", "heroCode": "toro", "regionCode": "VN",
  "sources": [{
    "captureId": "…", "sourceKind": "PRO", "sourceLabel": "Đề cử Pro",
    "capturedAt": "2026-11-11T05:02:43Z", "sourceTimeZone": "Asia/Ho_Chi_Minh", "patchCode": "…",
    "result": "COLLECTED",
    "builds": [{
      "contentKey": "…", "positions": [1, 3],
      "items": [{ "slot": 1, "itemId": "…", "code": "…" }],
      "enchantments": [{ "slot": 1, "enchantmentId": "…", "code": "…" }],
      "arcanaPageId": "…", "arcana": [{ "arcanaId": "…", "code": "…", "quantity": 10 }],
      "arcanaPageUse": { "builds": 27, "heroes": 17 },
      "spellId": "…", "spellCode": "…"
    }]
  }]
}
```

`positions` là các thứ tự trong danh sách game có cùng bộ. `arcanaPageUse` đếm bộ và tướng dùng trang ngọc này trong
mọi lần chụp đã xác nhận. Bộ không có ngọc trả `arcanaPageId: null`, `arcana: []`, `arcanaPageUse: null`. Không trả tên người chơi, chiến lực, tỷ lệ
thắng, ghi chú hay ảnh dẫn chứng.
Tướng không có lần chụp xác nhận nào trả `sources: []`. Tên và icon lấy từ `reference-catalog` theo UUID.

## Thống kê đấu hạng (ADR-025)

API admin ở mục này; người đọc xem bản chụp đã xác nhận qua `GET /heroes/{heroId}/ranking` ở mục Đánh giá tướng.
Mapping dùng `ApiPaths.ADMIN` và `version="1"`. Đọc cần `catalog:read`; nhập, sửa giá trị, xác nhận,
xóa cần `hero:write`. Audit `HERO_RANKING_SNAPSHOT_IMPORTED`, `HERO_RANKING_VALUE_REVIEWED`,
`HERO_RANKING_SNAPSHOT_CONFIRMED`, `HERO_RANKING_SNAPSHOT_DELETED`. Mã lỗi thuộc `HeroErrorCode`:
404 `HERO_RANKING_SNAPSHOT_NOT_FOUND`, 404 `HERO_RANKING_VALUE_NOT_FOUND`, 409 `HERO_RANKING_SNAPSHOT_EXISTS`,
409 `HERO_RANKING_VERSION_CONFLICT` (`context.currentVersion`), 409 `HERO_RANKING_REVIEW_OPEN` (`context.needsReview`),
422 `HERO_RANKING_INVALID` (`context.unknownHeroCodes` khi có mã tướng lạ).

```http
GET    /api/wiki/v1/admin/ranking-snapshots?region=VN&mode=RANKED_ELITE&page=0&size=20
POST   /api/wiki/v1/admin/ranking-snapshots
GET    /api/wiki/v1/admin/ranking-snapshots/{snapshotId}
DELETE /api/wiki/v1/admin/ranking-snapshots/{snapshotId}?expectedVersion=1
PUT    /api/wiki/v1/admin/ranking-snapshots/{snapshotId}/heroes/{heroId}/values/{metric}
POST   /api/wiki/v1/admin/ranking-snapshots/{snapshotId}/confirm
```

**Danh sách** trả `PageSlice` mới chụp trước; `region`, `mode` tùy chọn, `size` 1–100 (mặc định 20). Mỗi mục:

```json
{
  "id": "…", "code": "vn-ranked-elite-20261111-0705", "regionCode": "VN",
  "modeCode": "RANKED_ELITE", "modeLabel": "Đấu hạng (Tinh Anh trở lên)", "periodLabel": null,
  "capturedAt": "2026-11-11T00:07:49Z", "sourceTimeZone": "Asia/Ho_Chi_Minh",
  "confirmedAt": null, "heroCount": 130, "valueCount": 1560, "needsReviewCount": 22, "version": 1
}
```

**Nhập** (201, trả chi tiết). Body là phần `snapshot` của `ranking-manifest.json`:

```json
{
  "code": "vn-ranked-elite-20261111-0705", "regionCode": "VN", "modeCode": "RANKED_ELITE",
  "modeLabel": "Đấu hạng (Tinh Anh trở lên)", "periodLabel": null, "capturedAt": "2026-11-11T00:07:49Z",
  "sourceTimeZone": "Asia/Ho_Chi_Minh", "sourceRun": "ranking-20261111-070528-451", "sourceNote": "…",
  "images": [{ "imageId": "<sha256>", "board": "RATES", "pageNo": 1, "fileName": "…-page-1.png", "width": 2400, "height": 1080 }],
  "heroes": [{
    "heroCode": "toro", "nameOnScreen": "Toro", "roleOnScreen": "TANK", "ratesPosition": 1, "figuresPosition": 110,
    "values": [
      { "metric": "WIN_RATE", "number": 49.42, "tier": null, "heroCode": null, "readText": "49,42%",
        "needsReview": false, "note": null, "source": { "imageId": "<sha256>", "x": 955, "y": 410, "width": 190, "height": 112 } },
      { "metric": "COUNTER_1", "number": null, "tier": null, "heroCode": "grakk", "readText": null,
        "needsReview": false, "note": null, "source": { "imageId": "<sha256>", "x": 1825, "y": 422, "width": 88, "height": 88 } }
    ]
  }]
}
```

Quy tắc: `code` slug; `regionCode` `^[A-Z]{2,16}$`; `modeCode` `^[A-Z][A-Z0-9_]*$`; `sourceTimeZone` là múi giờ IANA;
ảnh không trùng `imageId` hay `(board, pageNo)`; tướng không trùng; mã tướng (kể cả `heroCode` của `COUNTER_*`) phải
tồn tại (mã cũ trong alias được chấp nhận và lưu theo UUID). Mỗi chỉ số tối đa một lần mỗi tướng và chỉ dùng trường của
loại mình: `tier` (`T0`–`T9`) cho `TIER`, `heroCode` cho `COUNTER_*`, `number` cho phần còn lại; tỷ lệ trong 0–100,
chỉ số mỗi trận ≥ 0. Giá trị rỗng phải có `needsReview: true`. `source` tùy chọn; nếu có, `imageId` phải nằm trong
`images` và vùng nằm trong ảnh. Trùng `code` trả 409 `HERO_RANKING_SNAPSHOT_EXISTS`.

**Chi tiết** trả các trường của danh sách cộng `sourceRun`, `sourceNote`, `createdAt`, `images` như khi nhập và
`heroes` theo `ratesPosition` (tướng không có ở bảng Tỷ lệ xếp cuối):

```json
{
  "heroId": "…", "heroCode": "toro", "nameOnScreen": "Toro", "roleOnScreen": "TANK",
  "ratesPosition": 1, "figuresPosition": 110,
  "values": [{
    "metric": "WIN_RATE", "number": 49.42, "tier": null, "heroId": null, "heroCode": null,
    "readText": "49,42%", "needsReview": false, "note": null,
    "source": { "imageId": "…", "x": 955, "y": 410, "width": 190, "height": 112 },
    "reviewedAt": null, "version": 1
  }]
}
```

Trong `values`, `heroId`/`heroCode` là tướng mà giá trị `COUNTER_*` chỉ tới.

**Duyệt một giá trị** — body `{expectedVersion, number?, tier?, heroId?, needsReview, note?}`. Trường giá trị theo loại
chỉ số như khi nhập (`heroId` thay cho `heroCode`); bỏ trống trường giá trị nghĩa là giá trị rỗng, chỉ được khi
`needsReview: true`. `needsReview: false` ghi `reviewedAt/_by` (xác nhận nếu giá trị không đổi, sửa nếu đổi);
`needsReview: true` xóa thông tin duyệt và bỏ xác nhận của bản chụp nếu bản đã xác nhận. `note` thay ghi chú cũ.
Trả `{value, snapshot}` với `snapshot` là mục danh sách sau khi lưu. Version cũ trả 409 `HERO_RANKING_VERSION_CONFLICT`.

**Xác nhận bản chụp** — body `{expectedVersion}`; trả mục danh sách. Còn giá trị chờ duyệt trả 409
`HERO_RANKING_REVIEW_OPEN`. Bản đã xác nhận thì không đổi gì và trả 200.

**Xóa** — `expectedVersion` bắt buộc; trả 204 và xóa mọi ảnh, tướng, giá trị của bản.

So sánh hai bản chụp làm ở Admin bằng hai lần đọc chi tiết, khớp theo `heroId`.

## Đánh giá tướng (ADR-029)

Đặc điểm nằm trong phần kỹ năng, nhận định nằm trong hồ sơ của bản nháp tướng; hai endpoint admin riêng đổi chúng,
trả 200 với composition revision mới nhất như các section PUT. Mapping admin dùng `ApiPaths.ADMIN`, công khai dùng
`ApiPaths.ROOT`, cùng `version="1"`. Ghi cần `hero:write`; audit `HERO_TRAITS_UPDATED`, `HERO_NOTES_UPDATED`.

```http
PUT    /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/traits
PUT    /api/wiki/v1/admin/heroes/{heroId}/drafts/{draftId}/notes
GET    /api/wiki/v1/heroes/{heroId}/ranking?region=VN&mode=RANKED_ELITE
GET    /api/wiki/v1/hero-traits?region=VN
```

**Đặc điểm** — body `{expectedDraftVersion, traits, changeNote?}`; `traits` là danh sách đầy đủ, rỗng là xóa hết:

```json
{
  "expectedDraftVersion": 7,
  "traits": [
    { "code": "HARD_CC", "skillKeys": ["skill-1-1"],
      "translations": [{ "locale": "vi-VN", "detail": "Hào hoa (choáng 0.75 giây)" }] },
    { "code": "DASH", "skillKeys": ["skill-2-1"], "translations": [] }
  ],
  "changeNote": "Duyệt đặc điểm"
}
```

Quy tắc: tối đa 32 đặc điểm; `code` thuộc 22 mã của ADR-029 (mã lạ trả 400), không trùng; `skillKeys` tối đa 20, phải
là kỹ năng của phần kỹ năng hiện tại của bản nháp (có thể rỗng, khóa lặp lại được gộp); `translations` tối đa 30,
locale chuẩn không trùng, `detail` 1–300 ký tự. Sai trả 422 `HERO_INVALID_CONTENT`. Server sắp đặc điểm theo thứ tự
cố định, kỹ năng và locale theo thứ tự chữ, bỏ khoảng trắng hai đầu. Không đổi gì thì không tạo phiên bản kỹ năng mới.
`expectedDraftVersion` cũ trả 409 `HERO_REVISION_VERSION_CONFLICT`.

**Nhận định** — body `{expectedDraftVersion, locale, strengths?, weaknesses?, counterTips?, changeNote?}`; mỗi ô tối
đa 4.000 ký tự, chữ trống hoặc bỏ trống là xóa ô đó. `locale` phải có sẵn trong hồ sơ của bản nháp, không thì 422
`HERO_INVALID_CONTENT`.

`PUT .../skills` và `PUT .../profile` (kể cả khi nhập dữ liệu) giữ đặc điểm và nhận định đang có: `traits` gửi kèm bị bỏ
qua, khóa kỹ năng không còn trong bộ kỹ năng mới bị bỏ khỏi đặc điểm, nhận định của locale bị xóa khỏi hồ sơ mất theo.

**Đọc công khai.** Phần kỹ năng đã xuất bản (hero detail, section resource) có `traits` theo thứ tự cố định:
`[{code, skillKeys, detail, actualLocale, fallbackApplied}]`, dòng chi tiết chọn locale như tên kỹ năng; đặc điểm chưa
có dòng chi tiết trả `detail: null`, `actualLocale: null`, `fallbackApplied: false`. Hồ sơ có `strengths`,
`weaknesses`, `counterTips` của bản dịch đã chọn, chưa viết thì `null`.

**Số liệu đấu hạng** — không cần đăng nhập; chỉ nhận `region` (mặc định `VN`, `^[A-Z]{2,16}$`) và `mode` (mặc định
`RANKED_ELITE`, `^[A-Z][A-Z0-9_]*$`); giá trị sai mẫu hay tham số lạ đều trả 400 `INVALID_QUERY_PARAMETER` như mọi
endpoint khác. Đọc bản chụp **đã xác
nhận** mới nhất của thị trường và chế độ:

```json
{
  "snapshot": {
    "code": "vn-ranked-elite-20261111-0705", "regionCode": "VN", "modeCode": "RANKED_ELITE",
    "modeLabel": "Đấu hạng (Tinh Anh trở lên)", "periodLabel": null,
    "capturedAt": "2026-11-11T00:07:49Z", "sourceTimeZone": "Asia/Ho_Chi_Minh", "heroes": 130
  },
  "entry": {
    "heroId": "…", "heroCode": "toro", "tier": "T0", "winRate": 49.42, "pickRate": 24.1, "banRate": null,
    "figures": [{ "metric": "DAMAGE_TAKEN", "value": 32452.0, "rank": 5, "of": 128 }],
    "counters": [{ "heroId": "…", "heroCode": "grakk" }]
  }
}
```

Giá trị còn chờ duyệt trả `null`; chỉ số chờ duyệt có `value` và `rank` `null`. `rank` là 1 cộng số tướng có giá trị
lớn hơn, `of` là số tướng có giá trị của chỉ số đó. `counters` theo `COUNTER_1..3`, bỏ ô chờ duyệt. Không trả
`readText`, ghi chú, ảnh dẫn chứng. Chưa có bản đã xác nhận thì `snapshot` và `entry` là `null`; bản không có tướng
(hoặc id lạ) thì `entry` là `null`. Dạng của tướng (ADR-024) đọc theo id của dạng.

**Tướng theo đặc điểm** — không cần đăng nhập; chỉ nhận `region` (mặc định `VN`). Trả
`{region, traits:[{code, heroes:[{id, code}]}]}` cho cả 22 mã theo thứ tự cố định, tính từ phiên bản người đọc đang
thấy của từng tướng trong thị trường. Liệt kê tướng thường và từng dạng; tướng chứa các dạng không có trong danh sách.

## Tệp nguồn riêng tư và dung lượng R2 (ADR-030)

Mọi endpoint dưới đây nằm trong `/api/wiki/v1/admin`. Đọc cần
`catalog:read`; ghi cần `media:write`. Danh sách trả `PageSlice` (mục 46; `size` tối đa 100 trừ khi ghi khác). Query
string được whitelist. Response chứa URL ký sẵn mang `Cache-Control: no-store`; backend không ghi URL này vào log.

### Bộ tệp

- `GET /admin/source-collections` — query `category,q,page,size`. `q` tìm không phân biệt hoa thường trong mã và tên.
  Mục: `{id, code, category, label, note, capturedOn, fileCount, totalBytes, updatedAt, version}`; `totalBytes` cộng
  bytes của từng tệp trong bộ. Sắp xếp theo thứ tự loại ở ADR-030 mục 4, rồi `capturedOn` mới trước (null cuối), rồi mã.
- `GET /admin/source-collections/{collectionId}` — một mục như trên; không có thì trả 404 `SOURCE_COLLECTION_NOT_FOUND`.
- `POST /admin/source-collections` — body `{code, category, label, note?, capturedOn?}`; trả 201 cùng mục. Mã trùng trả
  409 `SOURCE_COLLECTION_CODE_TAKEN`.
- `PUT /admin/source-collections/{collectionId}` — body `{expectedVersion, label, note?, capturedOn?}`. Mã và loại không
  đổi được. Version cũ trả 409 `SOURCE_COLLECTION_VERSION_CONFLICT`.
- `POST /admin/source-collections/{collectionId}/delete` — body `{expectedVersion}`; trả 204. Xóa bộ cùng mọi dòng tệp
  và phiên upload của bộ. Bytes vẫn còn, thành mồ côi nếu không còn chỗ nào trỏ tới.

### Tệp trong bộ

- `GET /admin/source-collections/{collectionId}/files` — query `prefix,q,page,size` (`size` tối đa 200). `prefix` là thư
  mục, ví dụ `raw/shop`, và lấy mọi tệp bên dưới; `q` tìm trong đường dẫn. Mục:
  `{id, path, sha256, sizeBytes, contentType, createdAt, updatedAt, version}`, sắp xếp theo đường dẫn.
- `GET /admin/source-files/{fileId}` — mục trên, cùng `collection {id, code, category, label}`, `otherPlaces` (tối đa 20
  tệp khác cùng bytes: `{fileId, collectionCode, path}`) và `usages` (các module báo qua `SourceFileUsageProvider`:
  `{ownerDomain, ownerType, ownerId, ownerName, role}`).
- `POST /admin/source-files/{fileId}/delete` — body `{expectedVersion}`; trả 204. Chỉ xóa dòng tệp.

### Tải lên

1. `POST /admin/source-collections/{collectionId}/uploads` — body
   `{path, sha256, sizeBytes, contentType, replace?: {fileId, expectedVersion}}`.
   - Bytes đã có: trả 200 `{status: "STORED", file}`; tệp được ghi hoặc thay ngay, không cần upload.
   - Cùng đường dẫn đã trỏ đúng bytes này: trả 200 `{status: "STORED", file}` và không đổi gì.
   - Còn lại: trả 201 `{status: "UPLOAD_REQUIRED", upload: {uploadId, method, uploadUrl, headers, expiresAt}}`.
   - Đường dẫn đã có trong bộ với bytes khác mà không gửi `replace` thì trả 409 `SOURCE_FILE_PATH_TAKEN`, context
     `{fileId, sha256, version}`. `replace` sai tệp hoặc version cũ trả 409 `SOURCE_FILE_VERSION_CONFLICT`.
   - Đường dẫn sai quy tắc (02, phần ADR-030) trả 400 `INVALID_REQUEST` với lỗi field `SOURCE_FILE_PATH_INVALID`.
     Loại ngoài danh sách trả 415 `SOURCE_FILE_TYPE_NOT_ALLOWED`. Quá `wiki.sources.max-upload-size` trả 413
     `SOURCE_FILE_TOO_LARGE` với context `maxBytes`.
2. Client `PUT` bytes tới `uploadUrl` kèm đúng `headers`, không qua backend.
3. `POST /admin/source-uploads/{uploadId}/complete` — trả 200 `{file}`. Backend đọc stream để tính SHA-256, kiểm tra
   kích thước và chữ ký ảnh, rồi copy sang `sources/<sha256>` và xóa key tạm.
   - Gọi lại sau khi đã xong trả đúng tệp cũ.
   - Chưa có object tạm thì trả 409 `SOURCE_UPLOAD_NOT_UPLOADED`; phiên vẫn chờ và thử lại được.
   - Bytes không khớp khai báo trả 409 `SOURCE_UPLOAD_REJECTED`, context `reason` là `SHA256_MISMATCH`,
     `SIZE_MISMATCH` hoặc `TYPE_MISMATCH`. Phiên bị từ chối vĩnh viễn.
   - Quá hạn trả 409 `SOURCE_UPLOAD_EXPIRED`. Đang có lượt complete khác trả 409 `SOURCE_UPLOAD_IN_PROGRESS`.
   - Bytes cùng SHA-256 đang bị xóa trả 409 `SOURCE_OBJECT_BUSY`; phiên vẫn chờ, thử lại sau.
- `GET /admin/source-uploads/{uploadId}` — `{uploadId, collectionId, path, state, errorCode, expiresAt, fileId}`.

Hạn URL upload và hạn complete dùng chung cấu hình của Media (`wiki.media.upload-url-validity`,
`wiki.media.upload-session-validity`).

### Xem và tải về

- `POST /admin/source-files/links` — body `{sha256: [...]}`, 1–200 giá trị không trùng. Trả
  `{items: [{sha256, url, expiresAt, contentType, sizeBytes}], missing: [...]}`; SHA-256 không có trong danh mục nằm ở
  `missing`. Quá 200 trả 400 `SOURCE_LINK_LIMIT_EXCEEDED`.
- `POST /admin/source-collections/{collectionId}/links` — body `{paths: [...]}`, 1–200 đường dẫn. Trả
  `{items: [{path, sha256, url, expiresAt, contentType, sizeBytes}], missing: [...]}`. Dùng để đọc manifest của một bộ.
- `POST /admin/source-files/{fileId}/download-link` — trả `{url, expiresAt}`; URL buộc tải về với tên tệp gốc.

URL sống `wiki.sources.link-validity` (mặc định 10 phút) và chỉ dùng cho `GET`. CORS của bucket chỉ mở cho origin Admin.

### Bytes mồ côi

- `GET /admin/source-objects/orphans` — query `page,size`. Mục `{sha256, sizeBytes, contentType, firstPath, createdAt,
  state}`: bytes không còn tệp nào trỏ tới và không module nào báo đang dùng, kể cả dòng đang `DELETING`.
- `POST /admin/source-objects/{sha256}/delete` — trả 204 sau khi xóa object và dòng. Còn tệp hoặc nơi dùng thì trả 409
  `SOURCE_OBJECT_IN_USE`, context `{files, usages}`. Không có thì trả 404 `SOURCE_OBJECT_NOT_FOUND`. Gọi lại khi dòng
  còn `DELETING` thì làm tiếp.

### Dung lượng

`GET /admin/storage/summary` — không có query parameter.

```json
{
  "generatedAt": "2026-11-14T10:00:00Z",
  "bytesPerGigabyte": 1000000000,
  "freeTier": { "storageBytes": 10000000000, "classAOperations": 1000000, "classBOperations": 10000000 },
  "prices": { "storageUsdPerGigabyteMonth": 0.015, "classAUsdPerMillion": 4.5, "classBUsdPerMillion": 0.36 },
  "thresholds": { "warning": 0.8, "critical": 0.95 },
  "buckets": [
    { "role": "MEDIA_ASSETS", "bucket": "aov-media-assets", "files": 6886, "bytes": 1079600000,
      "groups": [{ "key": "HERO_SKIN_ART", "files": 3749, "bytes": 652700000 }] },
    { "role": "SOURCES", "bucket": "aov-source-private", "files": 0, "bytes": 0,
      "orphanFiles": 0, "orphanBytes": 0, "groups": [] },
    { "role": "STAGING", "bucket": "aov-media-private", "files": 4, "bytes": 1200000, "groups": [] }
  ],
  "storage": { "source": "DATABASE", "bytes": 1080800000, "share": 0.108, "level": "OK" },
  "operations": { "source": "ESTIMATE", "month": "2026-11", "classA": 3250, "classB": 3250,
    "classAShare": 0.00325, "classBShare": 0.000325, "classALevel": "OK", "classBLevel": "OK" },
  "months": [{ "month": "2026-11", "files": 1625, "bytes": 293900000, "classA": 3250, "classB": 3250 }],
  "cloudflare": { "state": "NOT_CONFIGURED" }
}
```

- `role`: `MEDIA_ASSETS` (Media công khai), `SOURCES` (tệp nguồn), `STAGING` (upload đang chờ trong bucket riêng tư).
- `groups`: theo `semantic_type` với Media, theo loại chức năng với tệp nguồn. Bytes nằm trong bộ của hai loại được
  đếm ở cả hai nhóm, nhưng chỉ một lần trong tổng bucket.
- `level`: `OK`, `WARNING` (từ ngưỡng `warning`), `CRITICAL` (từ ngưỡng `critical`), `OVER` (quá 100% mức miễn phí).
- `months`: 12 tháng gần nhất theo lịch UTC, cộng Media và tệp nguồn tải lên trong tháng; thao tác là ước lượng.
- `cloudflare.state`: `NOT_CONFIGURED`, `OK` hoặc `UNAVAILABLE`. Khi `OK` có thêm `checkedAt`, `buckets`
  (`{bucket, objects, bytes, pendingUploads}`) và `operations` (`{from, to, classA, classB, free}`). Khi đó `operations`
  lấy số của Cloudflare với `source: "CLOUDFLARE"`. `storage` lấy số lớn hơn giữa database và tổng Cloudflare, ghi
  `source` theo số được chọn: Cloudflare có cả bytes ngoài danh mục nhưng chỉ cập nhật dung lượng theo chu kỳ, nên lượt
  vừa tải vẫn được tính ngay. Số Cloudflare được cache 15 phút.

`POST /admin/storage/estimates` — body `{target: "MEDIA" | "SOURCES", files: [{sha256?, sizeBytes}]}`, 1–20.000 tệp.

```json
{
  "target": "SOURCES",
  "files": 262, "bytes": 259500000,
  "knownFiles": 0, "knownBytes": 0,
  "newFiles": 262, "newBytes": 259500000,
  "classA": 524, "classB": 524,
  "storageBytesAfter": 1340300000, "storageShareAfter": 0.134, "level": "OK"
}
```

- `knownFiles`, `knownBytes`: tệp có SHA-256 đã nằm trên R2.
- Với `SOURCES`, tệp đã biết không tốn dung lượng hay thao tác. Với `MEDIA`, tệp đã biết vẫn tính vào `newBytes`, vì
  asset mới lưu bản riêng; Admin cảnh báo trùng trước khi tải.
- Mỗi tệp mới tính 2 thao tác lớp A (PUT, CopyObject) và 2 lớp B (HeadObject, GetObject lúc complete). Đọc lại để
  đối chiếu là việc của client và không nằm trong số này.
- Quá 20.000 tệp trả 400 `STORAGE_ESTIMATE_LIMIT_EXCEEDED`.

### Ảnh chiêu trên Wiki

Không có endpoint mới. Chi tiết tướng công khai đã trả ảnh thư viện icon kỹ năng trong `skillMedia` cho kỹ năng chưa
gắn icon (mục 7, "Skills"); Wiki chỉ dùng `skillMedia` và `skillStateMedia`, không đọc ảnh từ `resources/`.

### Mã lỗi mới của Media

```text
SOURCE_COLLECTION_NOT_FOUND         404
SOURCE_COLLECTION_CODE_TAKEN        409
SOURCE_COLLECTION_VERSION_CONFLICT  409  context.currentVersion
SOURCE_FILE_NOT_FOUND               404
SOURCE_FILE_PATH_TAKEN              409  context.fileId, context.sha256, context.version
SOURCE_FILE_VERSION_CONFLICT        409  context.currentVersion
SOURCE_FILE_TYPE_NOT_ALLOWED        415  context.contentType
SOURCE_FILE_TOO_LARGE               413  context.maxBytes
SOURCE_UPLOAD_NOT_FOUND             404
SOURCE_UPLOAD_NOT_UPLOADED          409
SOURCE_UPLOAD_EXPIRED               409  context.expiresAt
SOURCE_UPLOAD_REJECTED              409  context.reason
SOURCE_UPLOAD_IN_PROGRESS           409
SOURCE_OBJECT_NOT_FOUND             404
SOURCE_OBJECT_IN_USE                409  context.files, context.usages
SOURCE_OBJECT_BUSY                  409
SOURCE_LINK_LIMIT_EXCEEDED          400  context.max
STORAGE_ESTIMATE_LIMIT_EXCEEDED     400  context.max
```
