import { useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Check, EyeOff, ExternalLink, Pencil, Play, Trash2 } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { useSession } from "@/app/auth/auth-gate"
import { confirmAction } from "@/components/confirm-dialog"
import { videoPlayback, videoProviderName, videoThumbnail, videoWatchUrl } from "@aov/ui/lib/video-playback"
import { capabilityFor, PURPOSE_LABELS, STATUS_LABELS, type AdminVideo } from "./video-model"
import { formatClock } from "@/lib/clock"
import { VideoPlayerDialog } from "./video-player-dialog"

/** One video with what an editor needs to decide about it, and the actions they are allowed to take. */
export function VideoRow({
  video,
  context,
  patchCode,
  busy,
  onEdit,
  onStatus,
  onDelete,
  onMove,
}: {
  video: AdminVideo
  /** Names the subject when the list is not already about one. */
  context?: ReactNode
  patchCode?: string
  busy: boolean
  onEdit: () => void
  onStatus: (status: AdminVideo["status"]) => void
  onDelete: () => void
  onMove?: (direction: -1 | 1) => void
}) {
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = capabilities.includes(capabilityFor(video.subjectKind, "write"))
  const canPublish = capabilities.includes(capabilityFor(video.subjectKind, "publish"))
  // Taking a video off the wiki is a publishing decision too, so it needs the same capability.
  const canChange = canWrite && (video.status !== "PUBLISHED" || canPublish)
  const [watching, setWatching] = useState(false)
  const thumbnail = videoThumbnail(video, "mq")
  const playable = !!videoPlayback(video, window.location.hostname)
  const picture = (
    <>
      {thumbnail ? (
        <img src={thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        <span className="type-meta">{videoProviderName(video) || "Video"}</span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/20">
        {playable ? <Play className="size-5 fill-white text-white" /> : <ExternalLink className="size-5 text-white" />}
      </span>
    </>
  )
  const pictureClass =
    "relative flex aspect-video w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-muted"

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border p-2 @container">
      {playable ? (
        <button
          type="button"
          aria-label={`Xem video ${video.title}`}
          className={pictureClass}
          onClick={() => setWatching(true)}
        >
          {picture}
        </button>
      ) : (
        <a
          href={videoWatchUrl(video)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Mở liên kết ${video.title}`}
          className={pictureClass}
        >
          {picture}
        </a>
      )}
      <VideoPlayerDialog video={watching ? video : null} title={video.title} onClose={() => setWatching(false)} />
      <div className="min-w-48 flex-1">
        {context && <p className="type-meta truncate">{context}</p>}
        <p className="type-body line-clamp-2" title={video.title}>
          {video.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{PURPOSE_LABELS[video.purpose]}</Badge>
          <Badge
            variant="outline"
            className={cn(
              video.status === "PUBLISHED" && "border-primary/50 text-foreground",
              video.status === "HIDDEN" && "text-muted-foreground",
            )}
          >
            {STATUS_LABELS[video.status]}
          </Badge>
          {patchCode && <Badge variant="outline">Từ bản {patchCode}</Badge>}
          {video.origin === "IMPORT" && <span className="type-meta">Từ dữ liệu thu thập</span>}
          {video.durationSeconds && <span className="type-meta">{formatClock(video.durationSeconds)}</span>}
          {video.startSeconds > 0 && <span className="type-meta">Bắt đầu {formatClock(video.startSeconds)}</span>}
          {video.publishedOn && <span className="type-meta">{video.publishedOn}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onMove && (
          <>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Đưa lên trước"
              title="Đưa lên trước"
              disabled={busy || !canChange}
              onClick={() => onMove(-1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Đưa xuống sau"
              title="Đưa xuống sau"
              disabled={busy || !canChange}
              onClick={() => onMove(1)}
            >
              <ArrowDown className="size-4" />
            </Button>
          </>
        )}
        {video.status !== "PUBLISHED" && canPublish && (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onStatus("PUBLISHED")}>
            <Check className="size-4" /> Hiện
          </Button>
        )}
        {video.status !== "HIDDEN" && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Ẩn khỏi wiki"
            title="Ẩn khỏi wiki"
            disabled={busy || !canChange}
            onClick={() => onStatus("HIDDEN")}
          >
            <EyeOff className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Sửa video"
          title="Sửa video"
          disabled={busy || !canChange}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Xóa video"
          title="Xóa video"
          disabled={busy || !canChange}
          onClick={async () => {
            const accepted = await confirmAction({
              title: "Xóa video này?",
              description:
                video.origin === "IMPORT"
                  ? "Video từ dữ liệu thu thập sẽ quay lại ở lần nhập sau. Nếu không muốn dùng nữa, hãy chọn Ẩn."
                  : "Video sẽ biến mất khỏi wiki và không khôi phục được.",
              confirmLabel: "Xóa",
              cancelLabel: "Giữ lại",
            })
            if (accepted) onDelete()
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}
