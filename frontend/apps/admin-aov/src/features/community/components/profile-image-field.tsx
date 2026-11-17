import { useEffect, useRef, useState } from "react"
import { ImageIcon, LoaderCircle, Upload, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { cn } from "@aov/ui/lib/utils"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { ApiError, errorMessage } from "@/lib/api/errors"
import { RegistryLogoUploadError, uploadRegistryLogo } from "../../tournaments/model/team-logo-upload"
import { OwnerNameHints, OwnerNameInput } from "../../media/components/owner-name-field"
import { MediaUploadReferences, type UploadReferences } from "../../media/components/media-upload-references"

type Shape = "logo" | "portrait" | "cover"

/** The same look as the shared text input, for the owner field that needs suggestions. */
const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"

const frames: Record<Shape, string> = {
  logo: "size-20 rounded-2xl",
  portrait: "h-24 w-20 rounded-xl",
  cover: "aspect-[3/1] w-full rounded-xl",
}

/**
 * A profile image: preview, upload into the image library with its owner, or an existing image URL. The owner is
 * typed by the person uploading, never inferred from the profile name.
 */
export function ProfileImageField({
  label,
  shape,
  subject,
  name,
  sourceUrl,
  value,
  onChange,
  onBusyChange,
}: {
  label: string
  shape: Shape
  /** What the image shows, for the image library's source name. */
  subject: "organization" | "team" | "player" | "person" | "cover" | "circuit"
  name: string
  sourceUrl?: string
  value: string
  onChange: (url: string) => void
  onBusyChange: (busy: boolean) => void
}) {
  const canUpload = useSession().actor?.capabilities.includes("media:write") ?? false
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [owner, setOwner] = useState("")
  const [references, setReferences] = useState<UploadReferences>({})
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const ownerInput = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const showImage = !!value && failedUrl !== value && /^https?:\/\//i.test(value)

  function requireOwner() {
    if (owner.trim()) return true
    setError("Điền chủ sở hữu ảnh trước khi tải lên.")
    ownerInput.current?.focus()
    return false
  }

  async function upload(selected?: File) {
    if (!selected || !canUpload || busy || !requireOwner()) return
    const signal = new AbortController()
    controller.current = signal
    setBusy(true)
    onBusyChange(true)
    setError("")
    try {
      const url = await uploadRegistryLogo(
        backendRequest,
        selected,
        { kind: subject, name, sourceUrl, ownerName: owner, ...references },
        signal.signal,
      )
      if (!signal.signal.aborted) onChange(url)
    } catch (cause) {
      if (!signal.signal.aborted)
        setError(
          cause instanceof RegistryLogoUploadError
            ? "Ảnh chưa có đường dẫn hợp lệ. Hãy thử tải lại."
            : cause instanceof ApiError && cause.status === 403
              ? "Cần quyền media:write để tải ảnh lên kho."
              : errorMessage(cause).replace("Ảnh chưa được gắn vào tướng.", "Ảnh chưa được gắn vào hồ sơ."),
        )
    } finally {
      if (!signal.signal.aborted) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  const preview = (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border bg-muted/40 text-muted-foreground",
        frames[shape],
      )}
    >
      {showImage ? (
        <img
          src={value}
          alt={`${label} ${name}`}
          className={cn("size-full", shape === "cover" ? "object-cover" : "object-contain p-1")}
          onError={() => setFailedUrl(value)}
        />
      ) : (
        <ImageIcon aria-label={`Chưa có ${label.toLowerCase()}`} className="size-6" />
      )}
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/70">
          <LoaderCircle aria-hidden className="size-5 animate-spin" />
        </span>
      )}
    </span>
  )

  return (
    <div className="grid min-w-0 gap-3" role="group" aria-label={label}>
      <span className="type-label">{label}</span>
      <div className={cn("flex min-w-0 gap-3", shape === "cover" ? "flex-col" : "items-center")}>
        {preview}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            ref={file}
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            aria-label={`Tải ${label.toLowerCase()}`}
            onChange={(event) => {
              const selected = event.target.files?.[0]
              event.target.value = ""
              void upload(selected)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canUpload || busy}
            onClick={() => requireOwner() && file.current?.click()}
          >
            <Upload className="size-4" />
            {busy ? "Đang tải ảnh…" : value ? "Thay ảnh" : "Tải ảnh lên"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange("")}>
              <X className="size-4" />
              Gỡ ảnh
            </Button>
          )}
          <span className="type-meta">
            {canUpload ? "PNG, JPEG, WebP · tối đa 25 MB" : "Cần quyền media:write để tải ảnh."}
          </span>
        </div>
      </div>
      {canUpload && (
        <div className="grid gap-1.5">
          <label className="grid gap-1.5">
            <span className="type-meta">Chủ sở hữu ảnh (bắt buộc khi tải lên)</span>
            <OwnerNameInput
              ref={ownerInput}
              className={inputClass}
              value={owner}
              disabled={busy}
              aria-invalid={(!!error && !owner.trim()) || undefined}
              placeholder="Ví dụ: Garena / Liên Quân Mobile, tên đội…"
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
      <details className="text-sm">
        <summary className="type-meta cursor-pointer">Dùng đường dẫn ảnh có sẵn</summary>
        <Input
          className="mt-2"
          type="url"
          aria-label={`Đường dẫn ${label.toLowerCase()}`}
          value={value}
          maxLength={2048}
          placeholder="https://…"
          onChange={(event) => onChange(event.target.value)}
        />
      </details>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
