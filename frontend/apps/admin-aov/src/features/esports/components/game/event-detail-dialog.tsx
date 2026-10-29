import { useState } from "react"
import { Check, Link2, Pencil, Play, Trash2, Youtube } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/dialog"
import type { GameView } from "../../model/game-view"
import type { EventCluster, TimelineEvent } from "../../model/timeline"
import { formatClock } from "../../model/vod"
import { VIDEO_MARK } from "../primitives"
import { ClusterCard, clusterTitle, type ItemLookups } from "./cluster-card"

/** Full view of one marker or feed block, with links back to the exact moment. */
export function EventDetailDialog({
  cluster,
  game,
  lookups,
  videoLink,
  shareLink,
  videoTime,
  onWatch,
  onEdit,
  onDelete,
  onClose,
}: {
  cluster: EventCluster | null
  game: GameView
  lookups: ItemLookups
  videoLink: (event: TimelineEvent) => string | null
  /** Link to this page that reopens the viewer at the given second. */
  shareLink: (second: number) => string
  videoTime?: (event: TimelineEvent) => number | null
  onWatch: (event: TimelineEvent) => void
  onEdit?: (event: TimelineEvent) => void
  onDelete?: (event: TimelineEvent) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const event = cluster?.events.find((entry) => entry.id === selected) ?? cluster?.events[0]
  const youtube = event ? videoLink(event) : null
  const action = "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"

  return (
    <Dialog open={!!cluster} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>{cluster ? (clusterTitle(cluster) ?? "Chi tiết diễn biến") : ""}</DialogTitle>
        <DialogDescription>Chọn một dòng để xem riêng; các nút bên dưới áp dụng cho dòng đang chọn.</DialogDescription>
        {cluster && event && (
          <>
            <ClusterCard
              cluster={cluster}
              game={game}
              lookups={lookups}
              activeId={event.id}
              onSelect={(entry) => setSelected(entry.id)}
              videoTime={videoTime}
              size={40}
            />
            {event.note && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{event.note}</p>}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background"
                onClick={() => {
                  onWatch(event)
                  onClose()
                }}
              >
                <Play size={13} /> Xem từ ⏱ {formatClock(event.at)} trong trận
                {videoTime && videoTime(event) != null && ` (${VIDEO_MARK} ${formatClock(videoTime(event))})`}
              </button>
              {youtube && (
                <a className={action} href={youtube} target="_blank" rel="noreferrer">
                  <Youtube size={13} className="text-red-500" /> Mở trên YouTube
                </a>
              )}
              <button
                type="button"
                className={action}
                onClick={() =>
                  void navigator.clipboard?.writeText(shareLink(event.at)).then(() => {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1500)
                  })
                }
              >
                {copied ? <Check size={13} /> : <Link2 size={13} />} {copied ? "Đã sao chép" : "Sao chép link mốc"}
              </button>
              {onEdit && (
                <button
                  type="button"
                  className={action}
                  onClick={() => {
                    onEdit(event)
                    onClose()
                  }}
                >
                  <Pencil size={13} /> Sửa
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={`${action} text-destructive`}
                  onClick={() => {
                    onDelete(event)
                    onClose()
                  }}
                >
                  <Trash2 size={13} /> Xóa
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
