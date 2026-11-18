import { CaptureImportDialog } from "@/components/capture-import-dialog"
import { fetchCaptureSet, type CaptureSummary } from "./builds-api"
import { useCaptureActions, useCaptureSets } from "./use-builds"

/** Brings in a build capture set read from the screenshots of recommended builds. */
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
  return (
    <CaptureImportDialog
      open={open}
      title="Nhập lần chụp build"
      description="Bộ ảnh đã đọc nằm trong Quản lý tệp › Tệp nguồn. Bộ chờ duyệt là bộ có ô chưa nhận ra hoặc phải suy luận."
      emptyText="Chưa có bộ ảnh build nào trong Tệp nguồn."
      sets={sets}
      importedCodes={captures.map((capture) => capture.code)}
      describe={(set) => ({
        name: `${set.sourceLabel} · ${set.regionCode}`,
        counts: `${set.heroes} tướng · ${set.builds} bộ · ${set.needsReview} bộ chờ duyệt`,
      })}
      importSet={async (capturedOn) => importSet.mutateAsync(await fetchCaptureSet(capturedOn))}
      onOpenChange={onOpenChange}
      onImported={onImported}
    />
  )
}
