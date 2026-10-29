import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import type { MediaSourceInput } from "@aov/ui/lib/media-credit"
import { backendRequest } from "@/app/auth/session"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import {
  addMediaSourcesInBulk,
  bulkSourceValidation,
  type MediaSourceResult,
  type MediaSourceTarget,
} from "./bulk-media-sources"
import { invalidateMediaAssets } from "./media-cache"
import { MediaSourceFields } from "./media-source-fields"

const stateLabels = {
  pending: "Chưa xử lý",
  saving: "Đang lưu…",
  success: "Thành công",
  error: "Lưu chưa thành công",
  changed: "Cần chọn lại",
}

export function MediaBulkSourceEditor({
  targets,
  onClose,
  onSettled,
}: {
  targets: readonly MediaSourceTarget[]
  onClose: () => void
  onSettled: (results: MediaSourceResult[]) => void
}) {
  const client = useQueryClient()
  const wide = useIsWide()
  const [source, setSource] = useState<MediaSourceInput>({ type: "OTHER", label: "" })
  const [results, setResults] = useState<MediaSourceResult[]>(() =>
    targets.map((target) => ({ target, state: "pending" })),
  )
  const [busy, setBusy] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState("")
  const submittedSource = useRef<MediaSourceInput | null>(null)
  const stop = useRef(false)
  const running = useRef(false)
  useEffect(
    () => () => {
      stop.current = true
    },
    [],
  )
  useEffect(() => {
    if (!busy) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [busy])
  const succeeded = results.filter((result) => result.state === "success").length
  const failed = results.filter((result) => result.state === "error" || result.state === "changed").length
  const remaining = results.filter((result) => result.state === "pending" || result.state === "error")
  async function save() {
    if (running.current) return
    const payload = submittedSource.current ?? source
    const validation = bulkSourceValidation(payload)
    if (validation) {
      setError(validation)
      return
    }
    submittedSource.current = { ...payload }
    running.current = true
    stop.current = false
    setBusy(true)
    setStopping(false)
    setError("")
    const attempted = remaining.map((result) => result.target)
    try {
      const settled = await addMediaSourcesInBulk(
        backendRequest,
        attempted,
        submittedSource.current,
        (update) => {
          setResults((current) =>
            current.map((result) => (result.target.assetId === update.target.assetId ? update : result)),
          )
        },
        () => stop.current,
      )
      onSettled(settled)
      await invalidateMediaAssets(
        client,
        attempted.map((target) => target.assetId),
      )
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !running.current) onClose()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        showCloseButton={!busy}
        className={wide ? "w-[680px] sm:max-w-[680px]" : "max-h-[90dvh] rounded-t-2xl"}
        onEscapeKeyDown={(event) => {
          if (running.current) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (running.current) event.preventDefault()
        }}
      >
        <SheetHeader>
          <SheetTitle>Bổ sung nguồn / credit hàng loạt</SheetTitle>
          <SheetDescription>
            Áp dụng cùng thông tin cho {targets.length} ảnh đã chọn. Nguồn hiện có vẫn được giữ lại.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <MediaSourceFields value={source} onChange={setSource} disabled={busy || !!submittedSource.current} />
          <section className="space-y-2" aria-label="Ảnh được bổ sung nguồn hàng loạt">
            <h3 className="text-sm font-semibold">{targets.length} ảnh đã chọn</h3>
            <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
              {results.map((result) => (
                <li key={result.target.assetId} className="flex items-start gap-3 p-3">
                  {result.target.previewUrl && (
                    <img
                      src={result.target.previewUrl}
                      alt=""
                      loading="lazy"
                      className="size-10 shrink-0 rounded bg-muted object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p>{result.target.label}</p>
                    <p
                      className={
                        result.state === "error" || result.state === "changed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {stateLabels[result.state]}
                      {result.message ? ` · ${result.message}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="space-y-3 border-t p-4">
          {submittedSource.current && (
            <p role="status" className="text-sm">
              Đã lưu {succeeded} / {targets.length} ảnh{failed ? ` · ${failed} ảnh cần xử lý lại` : ""}
              {stopping && busy ? " · Đang dừng sau các ảnh đang xử lý…" : ""}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {busy ? (
              <Button
                variant="outline"
                disabled={stopping}
                onClick={() => {
                  stop.current = true
                  setStopping(true)
                }}
              >
                Dừng xử lý
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose}>
                Đóng
              </Button>
            )}
            {remaining.length > 0 && (
              <Button disabled={busy || !source.label.trim()} onClick={() => void save()}>
                {busy
                  ? "Đang lưu…"
                  : submittedSource.current
                    ? `Thử lại / tiếp tục ${remaining.length} ảnh`
                    : `Áp dụng cho ${targets.length} ảnh`}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
