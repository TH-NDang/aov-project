import { useEffect, useRef, useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { COMMON_CURRENCIES, currencyChoice, currencyLabel, currentCurrency } from "@aov/ui/lib/currency"
import { COMMON_TIME_ZONES, canonicalTimeZone, currentTimeZone, timeZoneLabel } from "@aov/ui/lib/time-zone"
import { useCommunitySession } from "../community/community-auth"
import { AVATAR_TYPES, uploadAvatar } from "./avatar-upload"
import { profileKey, saveProfile, useOwnProfile, wikiRequest } from "./profile-api"
import {
  LANGUAGE_CODES,
  PROFILE_LIMITS,
  WikiApiError,
  initialDraft,
  initials,
  profileDraft,
  profileError,
  profileRequest,
  readBrowserPreferences,
  sameDraft,
  withCurrent,
  type ProfileDraft,
  type UserProfile,
} from "./profile-model"
import "./account.css"

const languageNames = new Intl.DisplayNames(["vi"], { type: "language" })
const languageLabel = (code: string) => {
  try {
    return languageNames.of(code) || code
  } catch {
    return code
  }
}
const timeZones = COMMON_TIME_ZONES.map((option) => option.value)
const fieldLabels: Record<keyof ProfileDraft, string> = {
  displayName: "tên hiển thị",
  biography: "giới thiệu",
  locale: "ngôn ngữ",
  timeZone: "múi giờ",
  currency: "tiền tệ",
  avatarAssetId: "ảnh đại diện",
}

export function AccountAvatar({ url, name, large = false }: { url?: string | null; name: string; large?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span className={large ? "account-avatar account-avatar-large" : "account-avatar"} aria-hidden="true">
      <span>{initials(name)}</span>
      {url && failed !== url && <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(url)} />}
    </span>
  )
}

export function AccountProfile() {
  const profile = useOwnProfile()
  if (profile.data)
    return (
      <ProfileEditor profile={profile.data} reloading={profile.isFetching} onReload={() => void profile.refetch()} />
    )
  return (
    <section className="cp-panel account-profile">
      <h2>Hồ sơ dùng chung</h2>
      {profile.isError ? (
        <div className="cp-error" role="alert">
          <p>{profileError(profile.error)}</p>
          <button className="cp-button" disabled={profile.isFetching} onClick={() => void profile.refetch()}>
            Thử lại
          </button>
        </div>
      ) : (
        <p className="cp-muted" role="status">
          Đang tải hồ sơ…
        </p>
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
  const differences = newer ? changedFields(draft, profileDraft(newer)) : ""
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
      const result = await uploadAvatar(file, wikiRequest, controller.signal, setUploading)
      if (!controller.signal.aborted) {
        setDraft((current) => ({ ...current, avatarAssetId: result.assetId }))
        setPreview({ assetId: result.assetId, url: result.avatarUrl })
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(profileError(cause))
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
      client.setQueryData(profileKey(session.revision), result)
      setSaved(true)
    } catch (cause) {
      setConflict(cause instanceof WikiApiError && cause.code === "USER_PROFILE_CONFLICT")
      setError(profileError(cause))
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
    <form className="cp-panel account-profile" aria-labelledby="account-profile-title" onSubmit={save}>
      <div className="account-profile-intro">
        <h2 id="account-profile-title">Hồ sơ dùng chung</h2>
        <p className="cp-muted">
          Tên và ảnh đại diện dùng chung cho AOV Stream, WiKi và cộng đồng. Mật khẩu và email được quản lý ở trang đăng
          nhập.
        </p>
      </div>
      <div className="account-avatar-field">
        <AccountAvatar url={avatarUrl} name={draft.displayName || session.name} large />
        <div>
          <span className="account-field-label">Ảnh đại diện</span>
          <div className="cp-actions">
            <label className="cp-button account-file" aria-disabled={locked || undefined}>
              {draft.avatarAssetId ? "Đổi ảnh" : "Chọn ảnh"}
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
                Gỡ ảnh
              </button>
            )}
            {base.avatarAssetId && draft.avatarAssetId !== base.avatarAssetId && (
              <button
                type="button"
                className="cp-text-button"
                disabled={locked}
                onClick={() => change({ avatarAssetId: base.avatarAssetId })}
              >
                Giữ ảnh cũ
              </button>
            )}
          </div>
          <p className="cp-meta">
            {draft.avatarAssetId !== base.avatarAssetId
              ? "Ảnh đại diện có thay đổi chưa lưu. Bấm Lưu thay đổi để áp dụng."
              : "PNG, JPEG hoặc WebP, tối đa 25 MB. Nên chọn ảnh vuông."}
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
              setError("Đã hủy tải ảnh.")
            }}
          >
            Hủy tải ảnh
          </button>
        </div>
      )}
      <fieldset disabled={busy}>
        <label>
          Tên hiển thị
          <input
            required
            autoComplete="nickname"
            maxLength={PROFILE_LIMITS.displayName}
            value={draft.displayName}
            onChange={(event) => change({ displayName: event.target.value })}
          />
        </label>
        <label>
          Giới thiệu
          <textarea
            rows={4}
            maxLength={PROFILE_LIMITS.biography}
            placeholder="Một vài điều về bạn…"
            value={draft.biography}
            onChange={(event) => change({ biography: event.target.value })}
          />
          <span className="cp-meta account-counter">
            {draft.biography.length}/{PROFILE_LIMITS.biography}
          </span>
        </label>
        <div className="cp-form-grid">
          <label>
            Ngôn ngữ
            <select value={draft.locale} onChange={(event) => change({ locale: event.target.value })}>
              {withCurrent(LANGUAGE_CODES, draft.locale).map((code) => (
                <option key={code} value={code}>
                  {languageLabel(code)} ({code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Múi giờ
            <select
              value={canonicalTimeZone(draft.timeZone)}
              onChange={(event) => change({ timeZone: event.target.value })}
            >
              {withCurrent(timeZones, canonicalTimeZone(draft.timeZone)).map((zone) => (
                <option key={zone} value={zone}>
                  {timeZoneLabel(zone)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tiền tệ
            <select
              value={draft.currency ?? currentCurrency()}
              onChange={(event) => change({ currency: event.target.value })}
            >
              {COMMON_CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {currencyLabel(option.code)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      {newer && (
        <div className="cp-confirm" role="alert">
          <p>
            Hồ sơ vừa được cập nhật ở nơi khác{differences && ` (khác ở ${differences})`}. Bạn muốn dùng bản mới nhất
            hay giữ nội dung đang nhập rồi lưu đè?
          </p>
          <div className="cp-actions">
            <button type="button" className="cp-button" onClick={() => resolve(newer, false)}>
              Dùng bản mới nhất
            </button>
            <button type="button" className="cp-button" onClick={() => resolve(newer, true)}>
              Giữ nội dung đang nhập
            </button>
          </div>
        </div>
      )}
      {error && !(conflict && newer) && (
        <div className="cp-error" role="alert">
          <p>{error}</p>
          {conflict && (
            <button type="button" className="cp-button" disabled={reloading} onClick={onReload}>
              {reloading ? "Đang tải…" : "Tải bản mới nhất"}
            </button>
          )}
        </div>
      )}
      {saved && (
        <p className="cp-success" role="status">
          Đã lưu hồ sơ.
        </p>
      )}
      <div className="cp-actions account-profile-actions">
        {dirty && (
          <button type="button" className="cp-button" disabled={locked} onClick={() => resolve(base, false)}>
            Hoàn tác
          </button>
        )}
        <button className="cp-button cp-primary" disabled={!canSave}>
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  )
}

function changedFields(left: ProfileDraft, right: ProfileDraft) {
  return (Object.keys(fieldLabels) as (keyof ProfileDraft)[])
    .filter((field) => left[field] !== right[field])
    .map((field) => fieldLabels[field])
    .join(", ")
}
