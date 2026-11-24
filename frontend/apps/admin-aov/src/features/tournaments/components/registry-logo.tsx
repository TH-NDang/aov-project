import { useEffect, useRef, useState } from "react"
import { LoaderCircle, Upload } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { ApiError, errorMessage } from "@/lib/api/errors"
import { RegistryLogoUploadError, uploadRegistryLogo } from "../model/team-logo-upload"
import { OwnerNameHints, OwnerNameInput } from "../../media/components/owner-name-field"
import { MediaUploadReferences, type UploadReferences } from "../../media/components/media-upload-references"
import { useThemedLogo } from "@/lib/themed-logo"

/** The same look as the shared text input, for the owner field that needs suggestions. */

export function RegistryLogo({
  url,
  darkUrl,
  name,
  portrait = false,
  surface = "theme",
}: {
  url?: string
  darkUrl?: string | null
  name: string
  portrait?: boolean
  /** "dark" previews a logo on a dark background whatever the theme, as the dark logo field does. */
  surface?: "theme" | "dark"
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const logo = useThemedLogo(url, darkUrl, surface)
  const shown = logo.url
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase()
  const showImage = !!shown && failedUrl !== shown && /^https?:\/\//i.test(shown)
  return (
    <span
      className="tournament-registry-logo"
      data-portrait={portrait || undefined}
      data-surface={surface === "dark" ? "dark" : undefined}
      role="img"
      aria-label={`${portrait ? "Ảnh" : "Logo"} ${name}`}
    >
      <span aria-hidden="true">{initials || "ĐT"}</span>
      {showImage && (
        <img
          src={shown}
          alt=""
          loading="lazy"
          data-logo-plate={portrait ? undefined : logo.plate}
          onError={() => setFailedUrl(shown)}
        />
      )}
    </span>
  )
}

export function RegistryLogoField({
  value,
  name,
  onChange,
  onBusyChange,
  kind,
  dark = false,
}: {
  value: string
  name: string
  onChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
  kind: "teams" | "tournaments" | "players"
  /** The version drawn for a dark background, previewed on one; Stream shows it in its dark theme. */
  dark?: boolean
}) {
  const what =
    kind === "players"
      ? "ảnh tuyển thủ"
      : `logo ${kind === "teams" ? "đội tuyển" : "giải đấu"}${dark ? " nền tối" : ""}`
  const canUpload = useSession().actor?.capabilities.includes("media:write") ?? false
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // Not inferred from the team or player name: the person uploading says who owns the image.
  const [owner, setOwner] = useState("")
  const [references, setReferences] = useState<UploadReferences>({})
  const input = useRef<HTMLInputElement>(null)
  const ownerInput = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function choose(file?: File) {
    if (!file || !canUpload || busy) return
    if (!owner.trim()) {
      setError("Điền chủ sở hữu ảnh trước khi tải lên.")
      ownerInput.current?.focus()
      return
    }
    const upload = new AbortController()
    controller.current = upload
    setBusy(true)
    onBusyChange(true)
    setError("")
    try {
      const url = await uploadRegistryLogo(
        backendRequest,
        file,
        {
          kind: kind === "teams" ? "team" : kind === "players" ? "player" : "tournament",
          name,
          sourceUrl: value,
          ownerName: owner,
          ...references,
        },
        upload.signal,
      )
      if (!upload.signal.aborted) onChange(url)
    } catch (cause) {
      if (!upload.signal.aborted)
        setError(
          cause instanceof RegistryLogoUploadError
            ? "Ảnh chưa có đường dẫn hợp lệ. Hãy thử tải lại."
            : cause instanceof ApiError && cause.status === 403
              ? "Cần quyền media:write để tải ảnh lên kho."
              : errorMessage(cause).replace("Asset chưa được gắn vào tướng.", "Ảnh chưa được gắn vào hồ sơ."),
        )
    } finally {
      if (!upload.signal.aborted) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  return (
    <div className="tournament-logo-field">
      <span>{what.charAt(0).toUpperCase() + what.slice(1)}</span>
      <div className="tournament-logo-upload-row">
        <RegistryLogo
          url={dark ? undefined : value}
          darkUrl={dark ? value : undefined}
          surface={dark ? "dark" : "theme"}
          name={name || (kind === "teams" ? "Đội tuyển" : kind === "players" ? "Tuyển thủ" : "Giải đấu")}
          portrait={kind === "players"}
        />
        <div>
          <input
            ref={input}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Tải ${what}`}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              void choose(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canUpload || busy}
            onClick={() => {
              if (!owner.trim()) {
                setError("Điền chủ sở hữu ảnh trước khi tải lên.")
                ownerInput.current?.focus()
              } else input.current?.click()
            }}
          >
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? "Đang tải ảnh…" : kind === "players" ? "Tải ảnh lên" : "Tải logo lên"}
          </Button>
          <small>{canUpload ? "PNG, JPEG, WebP · tối đa 25 MB" : "Cần quyền media:write để tải ảnh."}</small>
        </div>
      </div>
      {canUpload && (
        <div className="grid gap-1.5">
          <label>
            Chủ sở hữu ảnh (bắt buộc khi tải lên)
            <OwnerNameInput
              ref={ownerInput}
              value={owner}
              disabled={busy}
              aria-invalid={(!!error && !owner.trim()) || undefined}
              placeholder="Ví dụ: tên đội, ban tổ chức, Garena…"
              onValueChange={(next) => {
                setOwner(next)
                if (next.trim()) setError("")
              }}
            />
          </label>
          <OwnerNameHints value={owner} disabled={busy} onPick={setOwner} />
          <MediaUploadReferences
            value={references}
            onChange={setReferences}
            disabled={busy}
            onOwnerName={(next) => {
              if (!owner.trim()) setOwner(next)
            }}
          />
        </div>
      )}
      <label>
        {kind === "players" ? "Đường dẫn ảnh" : dark ? "Đường dẫn logo nền tối" : "Đường dẫn logo"}
        <Input
          type="url"
          value={value}
          maxLength={2048}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://…"
        />
      </label>
      {error && (
        <p className="tournament-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p className="tournament-muted" role="status">
          Ảnh đang tải trực tiếp lên kho lưu trữ. Vui lòng chờ trước khi đóng.
        </p>
      )}
    </div>
  )
}
