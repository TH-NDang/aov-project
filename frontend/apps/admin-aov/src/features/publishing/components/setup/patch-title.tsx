import { useState, type FormEvent } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Pencil, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import type { Variant } from "../../api/publication-overview"
import { publishingKeys } from "@/lib/api/publishing-api"

/** The overview shows the Vietnamese title, so that is the one renamed here. */
const TITLE_LOCALE = "vi-VN"

/** The name readers see in the Wiki's update list. The code stays fixed because links and imports use it. */
export function PatchTitle({ variant }: { variant: Variant }) {
  const cache = useQueryClient()
  const canWrite = useSession().actor?.capabilities.includes("patch:write")
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const title = variant.patchTitle?.trim() ?? ""

  async function save(event: FormEvent) {
    event.preventDefault()
    const next = draft?.trim() ?? ""
    if (!next || next === title) return setDraft(null)
    setBusy(true)
    setError("")
    try {
      await backendRequest(`/admin/patches/${variant.patchId}/title`, {
        method: "PUT",
        body: JSON.stringify({ locale: TITLE_LOCALE, title: next }),
      })
      await cache.invalidateQueries({ queryKey: publishingKeys.overview })
      setDraft(null)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (draft === null)
    return (
      <div className="flex min-w-0 items-start gap-1">
        <h2 className="type-section-title min-w-0 break-words">{title || variant.patchCode}</h2>
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-my-1 shrink-0"
            aria-label={`Đổi tên patch ${variant.patchCode}`}
            title="Đổi tên patch"
            onClick={() => setDraft(title)}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    )

  return (
    <form className="grid min-w-0 gap-1" onSubmit={save}>
      <label className="type-label" htmlFor={`patch-title-${variant.id}`}>
        Tên patch trên Wiki
      </label>
      <div className="flex min-w-0 items-center gap-1">
        <Input
          id={`patch-title-${variant.id}`}
          className="min-w-0 flex-1"
          value={draft}
          maxLength={200}
          autoFocus
          disabled={busy}
          aria-invalid={!!error || undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && setDraft(null)}
        />
        <Button type="submit" size="icon-sm" disabled={busy || !draft.trim()} aria-label="Lưu tên patch">
          <Check className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label="Hủy đổi tên"
          onClick={() => {
            setDraft(null)
            setError("")
          }}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
      <p className="type-meta">
        Mã {variant.patchCode} giữ nguyên. Ngày phát hành đã hiện cạnh tên, không cần ghi lại.
      </p>
      {error && (
        <p role="alert" className="type-meta text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
