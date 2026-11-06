/** Shared user profile owned by wiki-service (ADR-008); Keycloak keeps identity, password and roles. */
export interface UserProfile {
  id: string | null
  displayName: string
  biography: string
  locale: string
  timeZone: string
  dateFormat?: string
  avatarAssetId: string | null
  avatarUrl: string | null
  version: number
  createdAt: string | null
  updatedAt: string | null
}
export type ProfileDraft = Pick<UserProfile, "displayName" | "biography" | "locale" | "timeZone" | "avatarAssetId">
export type ProfileRequest = ProfileDraft & { expectedVersion: number; dateFormat?: string }
export interface BrowserPreferences {
  languages: readonly string[]
  timeZone?: string
}

export const PROFILE_LIMITS = { displayName: 80, biography: 1000 } as const
export const LANGUAGE_CODES = ["vi-VN", "en-US", "th-TH", "zh-TW", "id-ID"] as const

export class WikiApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Token = () => Promise<string>

/** Calls the wiki API through the dev proxy with the in-memory access token and no cookies. */
export function createWikiRequest(token: Token, fetcher?: typeof fetch) {
  return async function wikiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const timeout = AbortSignal.timeout(20000)
    const response = await (fetcher ?? fetch)(`/api/wiki/v1${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      credentials: "omit",
      cache: "no-store",
      signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
    })
    if (!response.ok) {
      const problem = (await response.json().catch(() => ({}))) as { code?: string; detail?: string }
      throw new WikiApiError(response.status, problem.code ?? "", problem.detail ?? `HTTP ${response.status}`)
    }
    const text = await response.text()
    return text ? (JSON.parse(text) as T) : (undefined as T)
  }
}

export const profileDraft = (profile: UserProfile): ProfileDraft => ({
  displayName: profile.displayName,
  biography: profile.biography,
  locale: profile.locale,
  timeZone: profile.timeZone,
  avatarAssetId: profile.avatarAssetId,
})

export const sameDraft = (left: ProfileDraft, right: ProfileDraft) =>
  left.displayName === right.displayName &&
  left.biography === right.biography &&
  left.locale === right.locale &&
  left.timeZone === right.timeZone &&
  left.avatarAssetId === right.avatarAssetId

/** The token subject identifies the profile, so the body never carries issuer, subject or capabilities. */
export const profileRequest = (draft: ProfileDraft, expectedVersion: number): ProfileRequest => ({
  displayName: draft.displayName.trim(),
  biography: draft.biography,
  locale: draft.locale,
  timeZone: draft.timeZone,
  avatarAssetId: draft.avatarAssetId,
  expectedVersion,
})

export function profileError(error: unknown) {
  if (error instanceof WikiApiError) {
    const messages: Record<string, string> = {
      USER_PROFILE_CONFLICT:
        "Hồ sơ đã thay đổi ở nơi khác. Hãy tải bản mới nhất để xem lại trước khi lưu; nội dung đang nhập vẫn được giữ.",
      USER_PROFILE_INVALID: "Tên, ngôn ngữ hoặc múi giờ chưa hợp lệ. Hãy kiểm tra lại.",
      USER_AVATAR_INVALID: "Ảnh chưa được xác nhận hoặc không thuộc lượt tải lên của bạn. Hãy chọn lại ảnh.",
      STORAGE_UNAVAILABLE: "Kho ảnh đang không kết nối được. Bạn có thể thử lại sau.",
      INVALID_MEDIA_OBJECT: "Ảnh không hợp lệ. Hãy chọn PNG, JPEG hoặc WebP, tối đa 25 MB.",
      MEDIA_UPLOAD_EXPIRED: "Lượt tải ảnh đã hết hạn. Vui lòng chọn lại ảnh.",
    }
    if (messages[error.code]) return messages[error.code]
    if (error.status === 401) return "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại."
    if (error.status === 403) return "Tài khoản này chưa được phép chỉnh sửa hồ sơ."
    return "Chưa xử lý được yêu cầu. Vui lòng thử lại."
  }
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"))
    return "Máy chủ phản hồi quá lâu. Vui lòng thử lại."
  return error instanceof Error ? error.message : "Chưa kết nối được máy chủ."
}

export function readBrowserPreferences(): BrowserPreferences {
  let timeZone: string | undefined
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    // Keep the server fallback when the browser cannot resolve its time zone.
  }
  return {
    languages:
      typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language],
    timeZone,
  }
}

/** Suggests browser language and time zone only for a profile that has never been saved. */
export function initialDraft(profile: UserProfile, browser: BrowserPreferences): ProfileDraft {
  const draft = profileDraft(profile)
  if (profile.id !== null || profile.version !== 0) return draft
  for (const language of browser.languages) {
    try {
      const canonical = Intl.getCanonicalLocales(language)[0]
      if (canonical && canonical.length <= 35 && /^[a-z]{2}(?:-|$)/.test(canonical)) {
        draft.locale = canonical
        break
      }
    } catch {
      // Try the next preferred language when an entry is malformed.
    }
  }
  if (browser.timeZone && browser.timeZone.length <= 64) {
    try {
      draft.timeZone = new Intl.DateTimeFormat("en", { timeZone: browser.timeZone }).resolvedOptions().timeZone
    } catch {
      // Language and time zone fall back independently.
    }
  }
  return draft
}

/** Keeps a value the server already stores selectable even when it is not in the suggested list. */
export function withCurrent(options: readonly string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : [...options]
}

export function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  )
}
