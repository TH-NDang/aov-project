import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import type { MediaCredit } from "@aov/ui/lib/media-credit"
import { backendRequest } from "@/app/auth/session"
import { useIsWide } from "@/hooks/use-media-query"
import { control } from "../publishing/fields"
import { addSourcesPerTarget, type MediaSourceResult, type MediaSourceTarget } from "./bulk-media-sources"
import { invalidateMediaAsset } from "./media-cache"
import { LibraryImage } from "./image-library-presentation"

export interface OwnerTarget {
  target: MediaSourceTarget
  /** The image's verified source that only lacks its owner. */
  source: MediaCredit
}

/**
 * Completes the owner of many images at once. Every image keeps its own source name and link; owners are typed per
 * image because the right owner cannot be inferred from a team name or URL.
 */
export function MediaOwnerBulkEditor({
  items,
  onClose,
  onSettled,
}: {
  items: OwnerTarget[]
  onClose: () => void
  onSettled: (results: MediaSourceResult[]) => void
}) {
  const client = useQueryClient()
  const wide = useIsWide()
  const [owners, setOwners] = useState<Record<string, string>>({})
  const [shared, setShared] = useState("")
  const [results, setResults] = useState<Record<string, MediaSourceResult>>({})
  const [busy, setBusy] = useState(false)
  const stop = useRef(false)
  const filled = items.filter(({ target }) => owners[target.assetId]?.trim())
  const saved = Object.values(results).filter((result) => result.state === "success").length

  async function save() {
    const pending = filled.filter(({ target }) => results[target.assetId]?.state !== "success")
    if (!pending.length) return
    setBusy(true)
    stop.current = false
    const done = await addSourcesPerTarget(
      backendRequest,
      pending.map(({ target, source }) => ({
        target,
        source: { ...source, ownerName: owners[target.assetId].trim() },
      })),
      (result) => setResults((current) => ({ ...current, [result.target.assetId]: result })),
      () => stop.current,
    )
    await Promise.all(
      done
        .filter((result) => result.state === "success")
        .map((result) => invalidateMediaAsset(client, result.target.assetId)),
    )
    setBusy(false)
    onSettled(done)
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (open) return
        if (busy) stop.current = true
        else onClose()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(640px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader className="border-b">
          <SheetTitle>Bổ sung chủ sở hữu</SheetTitle>
          <SheetDescription>
            {items.length} ảnh đã có nơi lấy nhưng chưa ghi chủ sở hữu. Điền chủ sở hữu cho từng ảnh; tên nguồn và link
            của mỗi ảnh được giữ nguyên.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-6">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/20 p-3">
            <label className="grid min-w-0 flex-1 gap-1 text-sm">
              Điền giống nhau cho các ảnh còn trống
              <input
                className={control}
                maxLength={200}
                value={shared}
                disabled={busy}
                placeholder="Ví dụ: Garena"
                onChange={(event) => setShared(event.target.value)}
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={busy || !shared.trim()}
              onClick={() =>
                setOwners((current) => {
                  const next = { ...current }
                  for (const { target } of items)
                    if (!next[target.assetId]?.trim()) next[target.assetId] = shared.trim()
                  return next
                })
              }
            >
              Điền vào ô trống
            </Button>
          </div>
          <ul className="divide-y rounded-xl border" aria-label="Ảnh cần bổ sung chủ sở hữu">
            {items.map(({ target, source }) => {
              const result = results[target.assetId]
              return (
                <li key={target.assetId} className="flex items-center gap-3 p-3">
                  <LibraryImage url={target.previewUrl} className="size-11" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="truncate text-sm font-medium" title={source.label}>
                      {source.label}
                    </p>
                    <input
                      className={control}
                      aria-label={`Chủ sở hữu của ${source.label}`}
                      maxLength={200}
                      disabled={busy || result?.state === "success"}
                      placeholder="Chủ sở hữu / tên cần credit"
                      value={owners[target.assetId] ?? ""}
                      onChange={(event) =>
                        setOwners((current) => ({ ...current, [target.assetId]: event.target.value }))
                      }
                    />
                    {result?.message && result.state !== "success" && (
                      <p className="text-xs text-destructive">{result.message}</p>
                    )}
                  </div>
                  <span className="w-5 shrink-0" aria-live="polite">
                    {result?.state === "saving" && (
                      <LoaderCircle aria-label="Đang lưu" className="size-4 animate-spin" />
                    )}
                    {result?.state === "success" && (
                      <CircleCheck aria-label="Đã lưu" className="size-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {(result?.state === "error" || result?.state === "changed") && (
                      <CircleAlert aria-label="Chưa lưu" className="size-4 text-destructive" />
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-sm text-muted-foreground" role="status">
            {saved ? `Đã lưu ${saved} / ${items.length} ảnh` : `${filled.length} / ${items.length} ảnh đã điền`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              Đóng
            </Button>
            <Button
              disabled={busy || !filled.some(({ target }) => results[target.assetId]?.state !== "success")}
              onClick={() => void save()}
            >
              {busy ? "Đang lưu…" : "Lưu chủ sở hữu"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
