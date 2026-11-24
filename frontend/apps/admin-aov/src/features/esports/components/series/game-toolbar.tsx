import { CircleCheck, Flag, Gem, Info, Link2, ListChecks, Plus, ShieldBan } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import type { RecordingProgress, StepStatus } from "../../model/recording-progress"
import { RECORDING_TOOLS, recordingTools, type RecordingTool } from "../../model/recording-tools"
import { ProgressBadge } from "../game/progress-badge"
import { VideoMark } from "../primitives"

const TOOLS: Record<RecordingTool, { label: string; phone?: string; title?: string; icon: typeof Flag }> = {
  draft: { label: "Cấm chọn", icon: ShieldBan },
  loadout: {
    label: "Tuyển thủ, trang bị",
    phone: "Tuyển thủ",
    title: "Tuyển thủ, phụ trợ, phù hiệu, bảng ngọc và trang bị",
    icon: Gem,
  },
  sync: {
    label: "Video & kết thúc ván",
    phone: "Video",
    title: "Link video, mốc vào trận, tạm dừng, mốc kết thúc và đội thắng",
    icon: Link2,
  },
  progress: { label: "Tiến độ", icon: ListChecks },
}

/** A finished panel says so; a started one shows a dot, so what is left can be read off the row. */
function ToolMark({ status }: { status: StepStatus }) {
  if (status === "done") return <CircleCheck className="text-(--aov-success)" aria-label="đã đủ" />
  if (status === "partial")
    return <span className="size-2 rounded-full bg-[var(--esp-gold)]" role="img" aria-label="ghi một phần" />
  return null
}

/**
 * The panels of the game in the order it is recorded. The one to open next is outlined in gold; a phone keeps the
 * names and lets the row scroll sideways.
 */
export function GameTools({
  number,
  progress,
  editable,
  canSeeProgress,
  phone,
  openTool,
  onOpen,
}: {
  number: number
  progress: RecordingProgress
  editable: boolean
  canSeeProgress: boolean
  phone: boolean
  openTool: string | null
  onOpen: (tool: RecordingTool | "info") => void
}) {
  const { status, next } = recordingTools(progress)
  const tools = RECORDING_TOOLS.filter((tool) => (tool === "progress" ? canSeeProgress : editable))
  if (!tools.length) return null
  return (
    <div
      role="group"
      aria-label={`Ghi ván ${number}`}
      className={cn("flex items-center gap-1.5", phone ? "w-full overflow-x-auto pb-1 [&>*]:shrink-0" : "flex-wrap")}
    >
      {tools.map((tool) => {
        const { label, phone: short, title, icon: Icon } = TOOLS[tool]
        const isNext = editable && tool === next
        const name = tool === "progress" ? `Tiến độ ghi ván ${number}` : (title ?? label)
        return (
          <Button
            key={tool}
            size="sm"
            variant={isNext ? "ghost" : "outline"}
            aria-label={isNext ? `${name} · bước tiếp theo` : name}
            aria-pressed={openTool === tool}
            title={isNext ? `Bước tiếp theo · ${name}` : name}
            data-next={isNext || undefined}
            onClick={() => onOpen(tool)}
            className={cn("gap-1.5 px-2.5", isNext && "border border-[var(--esp-gold)] bg-[var(--esp-gold-soft)]")}
          >
            <Icon className={cn(!phone && "hidden @5xl:block")} aria-hidden />
            {phone ? (short ?? label) : label}
            {tool === "progress" ? <ProgressBadge progress={progress} /> : <ToolMark status={status[tool]} />}
          </Button>
        )
      })}
      {editable && (
        <Button
          size={phone ? "sm" : "icon-sm"}
          variant="ghost"
          onClick={() => onOpen("info")}
          aria-label={`Thông tin ván ${number}`}
          aria-pressed={openTool === "info"}
          title={`Thông tin ván ${number}: mùa và patch, MVP, số ván, ghi chú, gỡ công khai, xóa ván`}
        >
          <Info aria-hidden /> {phone && "Thông tin"}
        </Button>
      )}
    </div>
  )
}

/**
 * The one thing to press while the video plays: record a moment once the game is live, or set where it goes live.
 * A match without a video has no moments, so there is nothing to press.
 */
export function GamePrimary({
  number,
  live,
  hasVideo,
  canGoLive,
  at,
  onRecord,
  onGoLive,
}: {
  number: number
  live: boolean
  hasVideo: boolean
  canGoLive: boolean
  at: number
  onRecord: () => void
  onGoLive: () => void
}) {
  if (live)
    return (
      <Button size="sm" onClick={onRecord}>
        <Plus aria-hidden /> Ghi sự kiện
      </Button>
    )
  if (!hasVideo) return null
  return (
    <Button
      size="sm"
      disabled={!canGoLive}
      title={
        canGoLive
          ? `Đặt 0:00 của đồng hồ game ván ${number} tại vị trí video này`
          : "Tua video tới lúc vào trận, sau các lượt cấm chọn đã ghi"
      }
      onClick={onGoLive}
    >
      <Flag aria-hidden /> Vào trận {number} <VideoMark className="text-inherit" />{" "}
      <span className="esp-num">{formatClock(at)}</span>
    </Button>
  )
}
