import { useEffect, useRef, useState } from "react"
import { LoaderCircle, Upload } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { ApiError, errorMessage } from "@/lib/api/errors"
import { RegistryLogoUploadError, uploadRegistryLogo } from "./team-logo-upload"

export function RegistryLogo({ url, name, portrait = false }: { url?: string; name: string; portrait?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase()
  const showImage = !!url && failedUrl !== url && /^https?:\/\//i.test(url)
  return (
    <span
      className="tournament-registry-logo"
      data-portrait={portrait || undefined}
      role="img"
      aria-label={`${portrait ? "Ảnh" : "Logo"} ${name}`}
    >
      <span aria-hidden="true">{initials || "ĐT"}</span>
      {showImage && <img src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)} />}
    </span>
  )
}

export function RegistryLogoField({
  value,
  name,
  onChange,
  onBusyChange,
  kind,
}: {
  value: string
  name: string
  onChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
  kind: "teams" | "tournaments" | "players"
}) {
  const canUpload = useSession().actor?.capabilities.includes("media:write") ?? false
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function choose(file?: File) {
    if (!file || !canUpload || busy) return
    const upload = new AbortController()
    controller.current = upload
    setBusy(true)
    onBusyChange(true)
    setError("")
    try {
      const url = await uploadRegistryLogo(
        backendRequest,
        file,
        { kind: kind === "teams" ? "team" : kind === "players" ? "player" : "tournament", name, sourceUrl: value },
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
      <span>{kind === "players" ? "Ảnh tuyển thủ" : `Logo ${kind === "teams" ? "đội tuyển" : "giải đấu"}`}</span>
      <div className="tournament-logo-upload-row">
        <RegistryLogo
          url={value}
          name={name || (kind === "teams" ? "Đội tuyển" : kind === "players" ? "Tuyển thủ" : "Giải đấu")}
          portrait={kind === "players"}
        />
        <div>
          <input
            ref={input}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            aria-label={
              kind === "players" ? "Tải ảnh tuyển thủ" : `Tải logo ${kind === "teams" ? "đội tuyển" : "giải đấu"}`
            }
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
            onClick={() => input.current?.click()}
          >
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? "Đang tải ảnh…" : kind === "players" ? "Tải ảnh lên" : "Tải logo lên"}
          </Button>
          <small>{canUpload ? "PNG, JPEG, WebP · tối đa 25 MB" : "Cần quyền media:write để tải ảnh."}</small>
        </div>
      </div>
      <label>
        {kind === "players" ? "Đường dẫn ảnh" : "Đường dẫn logo"}
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
