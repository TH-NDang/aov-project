import { useEffect, useRef, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { currencyChoice } from "@aov/ui/lib/currency"
import { currentTimeZone } from "@aov/ui/lib/time-zone"
import { useStreamLocale } from "../stream-locale"
import { useCommunitySession } from "../../lib/stream-auth"
import { AVATAR_TYPES, uploadAvatar } from "../../lib/avatar-upload"
import { accountKeys, saveProfile, useOwnProfile } from "../../lib/profile-api"
import { ApiError } from "../../lib/api-client"
import { wikiRequest } from "../../lib/stream-api"
import {
  PROFILE_LIMITS,
  initialDraft,
  initials,
  profileDraft,
  profileError,
  profileRequest,
  readBrowserPreferences,
  sameDraft,
  type ProfileDraft,
  type UserProfile,
} from "../../lib/profile-model"
import { StreamIcon } from "../stream-icon"
import "./account.css"
import { Link } from "react-router"

const languageNames = new Map<string, Intl.DisplayNames>()
export const languageLabel = (code: string, locale = "vi-VN") => {
  try {
    let names = languageNames.get(locale)
    if (!names) languageNames.set(locale, (names = new Intl.DisplayNames([locale], { type: "language" })))
    return names.of(code) || code
  } catch {
    return code
  }
}
const fieldLabels: Record<keyof ProfileDraft, readonly [string, string]> = {
  displayName: ["tên hiển thị", "display name"],
  biography: ["giới thiệu", "bio"],
  locale: ["ngôn ngữ", "language"],
  timeZone: ["múi giờ", "time zone"],
  currency: ["tiền tệ", "currency"],
  avatarAssetId: ["ảnh đại diện", "avatar"],
}

function AccountAvatar({ url, name, large = false }: { url?: string | null; name: string; large?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className={large ? "account-avatar account-avatar-large" : "account-avatar"} aria-hidden="true">
      <span>{initials(name)}</span>
      {url && failed !== url && <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(url)} />}
    </span>
  )
}

export function AccountProfile() {
  const { text, languageTag } = useStreamLocale()
  const profile = useOwnProfile()
  if (profile.data)
    return (
      <ProfileEditor profile={profile.data} reloading={profile.isFetching} onReload={() => void profile.refetch()} />
    )
  return (
    <section className="cp-section account-profile" aria-labelledby="account-profile-title">
      <div className="tn-heading" data-flush="">
        <h2 id="account-profile-title">{text("Hồ sơ dùng chung", "Shared profile")}</h2>
      </div>
      {profile.isError ? (
        <div className="cp-error" role="alert">
          <p>{profileError(profile.error, languageTag)}</p>
          <button className="cp-button" disabled={profile.isFetching} onClick={() => void profile.refetch()}>
            {text("Thử lại", "Retry")}
          </button>
        </div>
      ) : (
        <div className="hub-skeleton-rows" role="status" aria-label={text("Đang tải hồ sơ", "Loading profile")} />
      )}
    </section>
  )
}

function ProfileEditor({
  profile,
  reloading,
  onReload,
}: {
  profile: UserProfile
  reloading: boolean
  onReload: () => void
}) {
  const { text, languageTag } = useStreamLocale()
  const session = useCommunitySession()
  const client = useQueryClient()
  const [seen, setSeen] = useState(profile)
  const [base, setBase] = useState(profile)
  const [draft, setDraft] = useState(() =>
    initialDraft(profile, { ...readBrowserPreferences(), timeZone: currentTimeZone(), currency: currencyChoice() }),
  )
  const [latest, setLatest] = useState<UserProfile | null>(null)
  const [preview, setPreview] = useState<{ assetId: string; url: string } | null>(null)
  const [uploading, setUploading] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)
  const upload = useRef<AbortController | null>(null)
  useEffect(() => () => upload.current?.abort(), [])

  // A re-read of the same version only renews the signed avatar URL. A newer version replaces an
  // untouched form and is offered for review when the user has unsaved edits.
  if (profile !== seen) {
    setSeen(profile)
    if (profile.version === base.version) setBase(profile)
    else if (profile.version > base.version) {
      if (sameDraft(draft, profileDraft(base))) {
        setBase(profile)
        setDraft(profileDraft(profile))
      } else setLatest(profile)
    }
  }

  const newer = latest && latest.version > base.version ? latest : null
  const differences = newer ? changedFields(draft, profileDraft(newer), text) : ""
  const dirty = !sameDraft(draft, profileDraft(base))
  const locked = busy || !!uploading
  const canSave = !locked && !conflict && !newer && !!draft.displayName.trim() && (dirty || base.id === null)
  const avatarUrl =
    draft.avatarAssetId === base.avatarAssetId
      ? base.avatarUrl
      : preview?.assetId === draft.avatarAssetId
        ? preview.url
        : null
  const change = (value: Partial<ProfileDraft>) => {
    setDraft({ ...draft, ...value })
    setSaved(false)
  }

  async function choose(file?: File) {
    if (!file) return
    upload.current?.abort()
    const controller = new AbortController()
    upload.current = controller
    setError("")
    setSaved(false)
    try {
      const result = await uploadAvatar(file, wikiRequest, controller.signal, setUploading, undefined, languageTag)
      if (!controller.signal.aborted) {
        setDraft((current) => ({ ...current, avatarAssetId: result.assetId }))
        setPreview({ assetId: result.assetId, url: result.avatarUrl })
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(profileError(cause, languageTag))
    } finally {
      if (!controller.signal.aborted) setUploading("")
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setBusy(true)
    setError("")
    setSaved(false)
    try {
      const result = await saveProfile(profileRequest(draft, base.version))
      setBase(result)
      setDraft(profileDraft(result))
      setPreview(null)
      setLatest(null)
      client.setQueryData(accountKeys.profile(session.revision), result)
      setSaved(true)
    } catch (cause) {
      setConflict(cause instanceof ApiError && cause.code === "USER_PROFILE_CONFLICT")
      setError(profileError(cause, languageTag))
    } finally {
      setBusy(false)
    }
  }

  function resolve(next: UserProfile, keepDraft: boolean) {
    setBase(next)
    if (!keepDraft) {
      setDraft(profileDraft(next))
      setPreview(null)
    }
    setLatest(null)
    setConflict(false)
    setError("")
  }

  return (
    <form className="cp-section account-profile" aria-labelledby="account-profile-title" onSubmit={save}>
      <div className="tn-heading" data-flush="">
        <h2 id="account-profile-title">{text("Hồ sơ dùng chung", "Shared profile")}</h2>
      </div>
      <p className="cp-section-lead">
        {text(
          "Tên và ảnh đại diện dùng chung cho AOV Stream, Wiki và cộng đồng. Mật khẩu và email được quản lý ở trang đăng nhập.",
          "Your name and avatar are shared across AOV Stream, Wiki and the community. Your password and email are managed on the sign-in page.",
        )}
      </p>
      <div className="account-avatar-field">
        <AccountAvatar url={avatarUrl} name={draft.displayName || session.name} large />
        <div>
          <span className="account-field-label">{text("Ảnh đại diện", "Avatar")}</span>
          <div className="cp-actions" data-spacing="loose">
            <label className="cp-button account-file" aria-disabled={locked || undefined}>
              {draft.avatarAssetId ? text("Đổi ảnh", "Change image") : text("Chọn ảnh", "Choose image")}
              <input
                type="file"
                accept={AVATAR_TYPES.join(",")}
                disabled={locked}
                onChange={(event) => {
                  void choose(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
            </label>
            {draft.avatarAssetId && (
              <button
                type="button"
                className="cp-text-button"
                disabled={locked}
                onClick={() => change({ avatarAssetId: null })}
              >
                {text("Gỡ ảnh", "Remove image")}
              </button>
            )}
            {base.avatarAssetId && draft.avatarAssetId !== base.avatarAssetId && (
              <button
                type="button"
                className="cp-text-button"
                disabled={locked}
                onClick={() => change({ avatarAssetId: base.avatarAssetId })}
              >
                {text("Giữ ảnh cũ", "Keep the old image")}
              </button>
            )}
          </div>
          <p className="cp-meta account-avatar-note">
            {draft.avatarAssetId !== base.avatarAssetId
              ? text(
                  "Ảnh đại diện có thay đổi chưa lưu. Bấm Lưu thay đổi để áp dụng.",
                  "The avatar has unsaved changes. Press Save changes to apply them.",
                )
              : text(
                  "PNG, JPEG hoặc WebP, tối đa 25 MB. Nên chọn ảnh vuông.",
                  "PNG, JPEG or WebP, up to 25 MB. A square image is recommended.",
                )}
          </p>
        </div>
      </div>
      {uploading && (
        <div className="account-status" role="status">
          <span>{uploading}</span>
          <button
            type="button"
            className="cp-text-button"
            onClick={() => {
              upload.current?.abort()
              setUploading("")
              setError(text("Đã hủy tải ảnh.", "Image upload canceled."))
            }}
          >
            {text("Hủy tải ảnh", "Cancel image upload")}
          </button>
        </div>
      )}
      <fieldset disabled={busy}>
        <label>
          {text("Tên hiển thị", "Display name")}
          <input
            required
            autoComplete="nickname"
            maxLength={PROFILE_LIMITS.displayName}
            value={draft.displayName}
            onChange={(event) => change({ displayName: event.target.value })}
          />
        </label>
        <label>
          {text("Giới thiệu", "Bio")}
          <textarea
            rows={4}
            maxLength={PROFILE_LIMITS.biography}
            placeholder={text("Một vài điều về bạn…", "A few things about you…")}
            value={draft.biography}
            onChange={(event) => change({ biography: event.target.value })}
          />
          <span className="cp-meta account-counter">
            {draft.biography.length}/{PROFILE_LIMITS.biography}
          </span>
        </label>
        <div className="account-profile-fact">
          <span>{text("Ngôn ngữ và khu vực", "Language and region")}</span>
          <strong>{languageLabel(draft.locale, languageTag)}</strong>
          <Link to="/account?tab=settings">{text("Đổi trong Cài đặt", "Change in Settings")}</Link>
        </div>
      </fieldset>
      {newer && (
        <div className="cp-confirm" role="alert">
          <p>
            {text(
              `Hồ sơ vừa được cập nhật ở nơi khác${differences && ` (khác ở ${differences})`}. Bạn muốn dùng bản mới nhất hay giữ nội dung đang nhập rồi lưu đè?`,
              `Your profile was just updated somewhere else${differences && ` (differs in ${differences})`}. Do you want to use the latest version, or keep what you have typed and save over it?`,
            )}
          </p>
          <div className="cp-actions">
            <button type="button" className="cp-button" onClick={() => resolve(newer, false)}>
              {text("Dùng bản mới nhất", "Use the latest version")}
            </button>
            <button type="button" className="cp-button" onClick={() => resolve(newer, true)}>
              {text("Giữ nội dung đang nhập", "Keep what you have typed")}
            </button>
          </div>
        </div>
      )}
      {error && !(conflict && newer) && (
        <div className="cp-error" role="alert">
          <p>{error}</p>
          {conflict && (
            <button type="button" className="cp-button" disabled={reloading} onClick={onReload}>
              {reloading ? text("Đang tải…", "Loading…") : text("Tải bản mới nhất", "Load the latest version")}
            </button>
          )}
        </div>
      )}
      <div className="cp-form-actions">
        <button className="cp-button cp-primary" disabled={!canSave}>
          {busy ? text("Đang lưu…", "Saving…") : text("Lưu thay đổi", "Save changes")}
        </button>
        {dirty && (
          <button type="button" className="cp-button cp-quiet" disabled={locked} onClick={() => resolve(base, false)}>
            {text("Hoàn tác", "Undo")}
          </button>
        )}
        {saved && (
          <span className="cp-success" role="status">
            <StreamIcon name="check" size={15} />
            {text("Đã lưu hồ sơ.", "Profile saved.")}
          </span>
        )}
      </div>
    </form>
  )
}

function changedFields(left: ProfileDraft, right: ProfileDraft, text: (vi: string, en: string) => string) {
  return (Object.keys(fieldLabels) as (keyof ProfileDraft)[])
    .filter((field) => left[field] !== right[field])
    .map((field) => text(...fieldLabels[field]))
    .join(", ")
}
