import { useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { LocalTime } from "@aov/ui/components/local-time"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { confirmAction } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import { useIsWide } from "@/hooks/use-media-query"
import { useDeleteOrphan, useSourceOrphans, type SourceOrphan } from "./files-api"
import { fileKind, formatCount, formatStorage } from "./files-format"
import { ErrorState } from "@/components/query-state"

/**
 * Bytes that no collection places and no record uses. Removing a file never deletes bytes; this is the one place that
 * does, one deliberate confirmation at a time.
 */
export function OrphansSheet({ open, writable, onClose }: { open: boolean; writable: boolean; onClose: () => void }) {
  const wide = useIsWide()
  const orphans = useSourceOrphans(open)
  const deletion = useDeleteOrphan()
  const rows = orphans.data?.pages.flatMap((page) => page.items) ?? []
  const total = orphans.data?.pages[0]?.totalElements ?? 0
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const remove = async (orphan: SourceOrphan) => {
    const accepted = await confirmAction({
      title: "Xóa vĩnh viễn dữ liệu tệp này?",
      description: `${orphan.firstPath} (${formatStorage(orphan.sizeBytes)}) sẽ bị xóa khỏi R2 và không khôi phục được. Không bộ nào và không bản ghi nào còn dùng nó.`,
      confirmLabel: "Xóa vĩnh viễn",
    })
    if (!accepted) return
    setError(null)
    deletion.mutate(orphan.sha256, { onError: (cause) => setError(errorMessage(cause)) })
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(520px,94vw)] sm:max-w-none" : "max-h-[90dvh] rounded-t-2xl"}
      >
        <SheetHeader>
          <SheetTitle>Dữ liệu tệp mồ côi</SheetTitle>
          <SheetDescription>
            {orphans.isPending
              ? "Đang tải…"
              : total === 0
                ? "Không có dữ liệu tệp nào thừa."
                : `${formatCount(total)} tệp không còn trong bộ nào và không còn bản ghi nào dùng.`}
          </SheetDescription>
        </SheetHeader>
        <div ref={scrollRef} className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto px-4 pb-6">
          {error && (
            <p role="alert" className="type-body text-destructive">
              {error}
            </p>
          )}
          {orphans.isLoadingError && (
            <ErrorState message="Không đọc được danh sách dữ liệu tệp mồ côi." onRetry={() => void orphans.refetch()} />
          )}
          <ul className="grid gap-2">
            {rows.map((orphan) => (
              <li key={orphan.sha256} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3">
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate type-body">{orphan.firstPath}</span>
                  <span className="type-meta">
                    {fileKind(orphan.contentType)} · {formatStorage(orphan.sizeBytes)} · lưu{" "}
                    <LocalTime value={orphan.createdAt} />
                    {orphan.state === "DELETING" && " · đang xóa dở"}
                  </span>
                </span>
                {writable && (
                  <Button variant="outline" size="sm" disabled={deletion.isPending} onClick={() => void remove(orphan)}>
                    <Trash2 />
                    {orphan.state === "DELETING" ? "Xóa tiếp" : "Xóa"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <InfiniteScroll query={orphans} label="dữ liệu tệp mồ côi" rootRef={scrollRef} enabled={open} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
