/** Shared user profile owned by wiki-service (ADR-008); Keycloak keeps identity, password and roles. */
export interface UserProfile {
  id: string | null
  displayName: string
  biography: string
  locale: string
  timeZone: string
  dateFormat?: string
  currency: string | null
  avatarAssetId: string | null
  avatarUrl: string | null
  version: number
  createdAt: string | null
  updatedAt: string | null
}
export type ProfileDraft = Pick<
  UserProfile,
  "displayName" | "biography" | "locale" | "timeZone" | "currency" | "avatarAssetId"
>
export type ProfileRequest = ProfileDraft & { expectedVersion: number; dateFormat?: string }
export interface BrowserPreferences {
  languages: readonly string[]
  timeZone?: string
  currency?: string | null
}

export const PROFILE_LIMITS = { displayName: 80, biography: 1000 } as const
export const LANGUAGE_CODES = ["vi-VN", "en-US", "th-TH", "zh-TW", "id-ID"] as const

export const profileDraft = (profile: UserProfile): ProfileDraft => ({
  displayName: profile.displayName,
  biography: profile.biography,
  locale: profile.locale,
  timeZone: profile.timeZone,
  currency: profile.currency ?? null,
  avatarAssetId: profile.avatarAssetId,
})

export const sameDraft = (left: ProfileDraft, right: ProfileDraft) =>
  left.displayName === right.displayName &&
  left.biography === right.biography &&
  left.locale === right.locale &&
  left.timeZone === right.timeZone &&
  left.currency === right.currency &&
  left.avatarAssetId === right.avatarAssetId

/** The token subject identifies the profile, so the body never carries issuer, subject or capabilities. */
export const profileRequest = (draft: ProfileDraft, expectedVersion: number): ProfileRequest => ({
  displayName: draft.displayName.trim(),
  biography: draft.biography,
  locale: draft.locale,
  timeZone: draft.timeZone,
  currency: draft.currency,
  avatarAssetId: draft.avatarAssetId,
  expectedVersion,
})

export function profileError(error: unknown, locale = "vi-VN") {
  const text = (vi: string, en: string) => (locale.startsWith("en") ? en : vi)
  if (error instanceof ApiError) {
    const messages: Record<string, [string, string]> = {
      USER_PROFILE_CONFLICT: [
        "Hồ sơ đã thay đổi ở nơi khác. Hãy tải bản mới nhất để xem lại trước khi lưu; nội dung đang nhập vẫn được giữ.",
        "Your profile was changed somewhere else. Load the latest version and review it before saving; what you have typed is kept.",
      ],
      USER_PROFILE_INVALID: [
        "Tên, ngôn ngữ hoặc múi giờ chưa hợp lệ. Hãy kiểm tra lại.",
        "The name, language or time zone is not valid. Please check again.",
      ],
      USER_AVATAR_INVALID: [
        "Ảnh chưa được xác nhận hoặc không thuộc lượt tải lên của bạn. Hãy chọn lại ảnh.",
        "The image was not confirmed or does not belong to your upload. Please choose the image again.",
      ],
      STORAGE_UNAVAILABLE: [
        "Kho ảnh đang không kết nối được. Bạn có thể thử lại sau.",
        "Image storage cannot be reached right now. You can try again later.",
      ],
      INVALID_MEDIA_OBJECT: [
        "Ảnh không hợp lệ. Hãy chọn PNG, JPEG hoặc WebP, tối đa 25 MB.",
        "The image is not valid. Choose a PNG, JPEG or WebP of up to 25 MB.",
      ],
      MEDIA_UPLOAD_EXPIRED: [
        "Lượt tải ảnh đã hết hạn. Vui lòng chọn lại ảnh.",
        "The image upload has expired. Please choose the image again.",
      ],
    }
    const known = messages[error.code]
    if (known) return text(...known)
    if (error.status === 401)
      return text(
        "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.",
        "Your session is no longer valid. Please sign in again.",
      )
    if (error.status === 403)
      return text(
        "Tài khoản này chưa được phép chỉnh sửa hồ sơ.",
        "This account is not allowed to edit the profile yet.",
      )
    return text("Chưa xử lý được yêu cầu. Vui lòng thử lại.", "The request could not be handled. Please try again.")
  }
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError"))
    return text("Máy chủ phản hồi quá lâu. Vui lòng thử lại.", "The server took too long to answer. Please try again.")
  return error instanceof Error ? error.message : text("Chưa kết nối được máy chủ.", "The server could not be reached.")
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
  if (browser.currency) draft.currency = browser.currency
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
import { ApiError } from "./api-client.ts"
