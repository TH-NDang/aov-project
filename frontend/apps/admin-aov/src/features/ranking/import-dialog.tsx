import { CaptureImportDialog } from "@/components/capture-import-dialog"
import { fetchCaptureSet, type RankingSummary } from "./ranking-api"
import { useCaptureSets, useSnapshotActions } from "./use-ranking"

/** Brings in a ranking snapshot read from the screenshots of the in-game statistics. */
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
  return (
    <CaptureImportDialog
      open={open}
      title="Nhập bản chụp thống kê"
      description="Bộ ảnh đã đọc nằm trong Quản lý tệp › Tệp nguồn. Số chờ duyệt là những giá trị đọc chưa chắc hoặc không có trên ảnh."
      emptyText="Chưa có bộ ảnh xếp hạng nào trong Tệp nguồn."
      sets={sets}
      importedCodes={snapshots.map((snapshot) => snapshot.code)}
      describe={(set) => ({
        name: `${set.modeLabel} · ${set.regionCode}`,
        counts: `${set.heroes} tướng · ${set.images} ảnh · ${set.needsReview} giá trị chờ duyệt`,
      })}
      importSet={async (capturedOn) => importSet.mutateAsync(await fetchCaptureSet(capturedOn))}
      onOpenChange={onOpenChange}
      onImported={onImported}
    />
  )
}
