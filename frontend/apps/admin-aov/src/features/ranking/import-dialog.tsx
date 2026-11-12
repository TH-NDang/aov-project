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
import { fetchCaptureSet, type RankingSummary } from "./ranking-api"
import { useCaptureSets, useSnapshotActions } from "./use-ranking"

/**
 * Brings in a capture set the screenshot reader left in `resources/extracted/ranking/<day>/`. Only sets on this machine
 * are offered, and one already imported shows as such.
 */
export function ImportDialog({
  open,
  snapshots,
  onOpenChange,
  onImported,
}: {
  open: boolean
  snapshots: RankingSummary[]
  onOpenChange: (open: boolean) => void
  onImported: (id: string) => void
}) {
  const sets = useCaptureSets()
  const { importSet } = useSnapshotActions()
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imported = new Set(snapshots.map((snapshot) => snapshot.code))

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
          <DialogTitle>Nhập bản chụp thống kê</DialogTitle>
          <DialogDescription>
            Bộ ảnh đã đọc nằm ở resources/extracted/ranking trên máy này. Số chờ duyệt là những giá trị đọc chưa chắc
            hoặc không có trên ảnh.
          </DialogDescription>
        </DialogHeader>
        {sets.isPending ? (
          <p className="type-body text-muted-foreground">Đang tìm bộ ảnh…</p>
        ) : !sets.data ? (
          <p className="type-body text-muted-foreground">
            Máy chủ dev không thấy thư mục resources, nên không có bộ ảnh nào để nhập.
          </p>
        ) : !sets.data.length ? (
          <p className="type-body text-muted-foreground">Chưa có bộ ảnh nào trong resources/extracted/ranking.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sets.data.map((set) => (
              <li key={set.capturedOn} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {set.modeLabel} · {set.regionCode}
                  </p>
                  <p className="type-meta text-muted-foreground">
                    <LocalTime value={set.capturedAt} sourceTimeZone={set.sourceTimeZone} /> · {set.heroes} tướng ·{" "}
                    {set.images} ảnh · {set.needsReview} giá trị chờ duyệt
                  </p>
                </div>
                {imported.has(set.code) ? (
                  <span className="type-meta text-muted-foreground">Đã nhập</span>
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
