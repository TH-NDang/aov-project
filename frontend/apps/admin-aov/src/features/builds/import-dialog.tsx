import { useState } from "react"
import { FileUp } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { LocalTime } from "@aov/ui/components/local-time"
import { errorMessage } from "@/lib/api/errors"
import { fetchCaptureSet, type CaptureSummary } from "./builds-api"
import { useCaptureActions, useCaptureSets } from "./use-builds"

/**
 * Brings in a capture set published to the private bucket with publish-captures (ADR-030), so a built Admin offers the
 * same sets as a dev server. One already imported shows as such.
 */
export function ImportDialog({
  open,
  captures,
  onOpenChange,
  onImported,
}: {
  open: boolean
  captures: CaptureSummary[]
  onOpenChange: (open: boolean) => void
  onImported: (id: string) => void
}) {
  const sets = useCaptureSets()
  const { importSet } = useCaptureActions()
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imported = new Set(captures.map((capture) => capture.code))

  const run = async (capturedOn: string) => {
    setWorking(capturedOn)
    setError(null)
    try {
      const detail = await importSet.mutateAsync(await fetchCaptureSet(capturedOn))
      onImported(detail.id)
      onOpenChange(false)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setWorking(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nhập lần chụp build</DialogTitle>
          <DialogDescription>
            Bộ ảnh đã đọc nằm trong Quản lý tệp › Tệp nguồn. Bộ chờ duyệt là bộ có ô chưa nhận ra hoặc phải suy luận.
          </DialogDescription>
        </DialogHeader>
        {sets.isPending ? (
          <p className="type-body text-muted-foreground">Đang tìm bộ ảnh…</p>
        ) : sets.isError ? (
          <p className="type-body text-destructive">{errorMessage(sets.error)}</p>
        ) : !sets.data ? (
          <p className="type-body text-muted-foreground">
            Tài khoản này không mở được tệp nguồn, nên không có bộ ảnh nào để nhập.
          </p>
        ) : !sets.data.length ? (
          <p className="type-body text-muted-foreground">Chưa có bộ ảnh build nào trong Tệp nguồn.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sets.data.map((set) => (
              <li key={set.capturedOn} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="type-body">
                    {set.sourceLabel} · {set.regionCode}
                  </p>
                  <p className="type-meta">
                    <LocalTime value={set.capturedAt} sourceTimeZone={set.sourceTimeZone} /> · {set.heroes} tướng ·{" "}
                    {set.builds} bộ · {set.needsReview} bộ chờ duyệt
                  </p>
                </div>
                {imported.has(set.code) ? (
                  <span className="type-meta">Đã nhập</span>
                ) : (
                  <Button type="button" size="sm" disabled={!!working} onClick={() => run(set.capturedOn)}>
                    <FileUp className="size-4" /> {working === set.capturedOn ? "Đang nhập…" : "Nhập"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="type-body text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
