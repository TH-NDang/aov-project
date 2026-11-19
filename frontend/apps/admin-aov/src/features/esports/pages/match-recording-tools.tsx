import type { GameContent } from "@aov/community-contracts"
import { Flag, Gem, Info, Link2, ListChecks, Loader2, Plus, ShieldBan } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import { ProgressBadge } from "../components/game/progress-badge"
import { VideoMark } from "../components/primitives"
import { earliestLive, readDraft } from "../model/draft"
import type { RecordingProgress } from "../model/recording-progress"
import { chapterAt, type GameChapter } from "../model/series-vod"
import type { Panel } from "./focused-game"

/** Where a game recorded from the broadcast begins: its ban/pick phase at a second of the match video. */
export type GameStart = { url: string; second: number }

/** The game that can be added next: its number, whether it is being created, and how to record it. */
export type NextGame = { number: number; pending: boolean; onAdd: (start: GameStart | null) => Promise<string> }

/**
 * The tools beside the transport: the progress of the focused game and, while recording, its panels, going live and
 * starting the next game at the playhead. On a phone the tools keep their names and form one row that scrolls
 * sideways, instead of bare icons.
 */
export function RecordingTools({
  phone,
  editable,
  focused,
  focusedContent,
  progress,
  at,
  video,
  chapters,
  hasGames,
  nextGame,
  onPanel,
  onStarted,
  onSave,
}: {
  phone: boolean
  editable: boolean
  focused: GameChapter | undefined
  focusedContent: GameContent | undefined
  /** Progress of the focused game, shown to editors who can write or publish. */
  progress: RecordingProgress | undefined
  at: number
  video: { url: string } | null
  chapters: GameChapter[]
  hasGames: boolean
  /** Null when the match has all its games or the editor cannot write. */
  nextGame: NextGame | null
  onPanel: (panel: Panel) => void
  /** The next game was created at the playhead. */
  onStarted: () => void
  /** Saves a change of the focused game. */
  onSave: (change: (content: GameContent) => GameContent) => void
}) {
  const hasVideo = !!video
  // A new game starts at the playhead, which must lie outside every game already placed on the video.
  const inside = video
    ? chapterAt(
        chapters.filter((chapter) => chapter.synced),
        at,
      )
    : null
  const startGame = async () => {
    if (!nextGame) return
    try {
      await nextGame.onAdd(video ? { url: video.url, second: Math.floor(at) } : null)
    } catch {
      return
    }
    onStarted()
  }
  const liveFrom = focusedContent ? earliestLive(readDraft(focusedContent)) : 0
  const canGoLive = !!focused && !focused.live && !!video && at >= liveFrom
  const goLive = () =>
    onSave((content) => ({
      ...content,
      sourceUrl: content.sourceUrl || video?.url,
      sourceTimestampSeconds: Math.floor(at),
    }))

  const startButton = nextGame && editable && (
    <Button
      size="sm"
      variant={focused ? "outline" : "default"}
      disabled={nextGame.pending || !!inside || (!hasVideo && !hasGames)}
      title={
        inside
          ? `Đang trong ván ${inside.number}: kết thúc ván ${inside.number} hoặc tua ra ngoài ván`
          : !hasVideo && !hasGames
            ? "Gắn video của trận trước"
            : undefined
      }
      onClick={() => void startGame()}
    >
      {nextGame.pending ? <Loader2 size={14} className="animate-spin" /> : <ShieldBan size={14} />}{" "}
      {hasVideo ? "Bắt đầu cấm chọn ván" : "Thêm ván"} {nextGame.number}
      {hasVideo && (
        <span className="esp-num">
          {" "}
          tại <VideoMark /> {formatClock(at)}
        </span>
      )}
    </Button>
  )

  const progressButton = focused && progress && (
    <Button
      size="sm"
      variant="outline"
      onClick={() => onPanel({ kind: "progress" })}
      aria-label={`Tiến độ ghi ván ${focused.number}`}
    >
      <ListChecks size={14} /> Tiến độ
      <ProgressBadge progress={progress} />
    </Button>
  )
  if (!editable && !progressButton) return null

  return (
    <span
      className={cn(
        "flex items-center gap-1.5",
        phone ? "w-full flex-nowrap overflow-x-auto pb-1 [&>*]:shrink-0" : "flex-wrap",
      )}
    >
      {progressButton}
      {editable && focused && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPanel({ kind: "sync" })}
            aria-label="Video, đồng bộ và kết thúc ván"
            title="Link video, mốc vào trận, tạm dừng, mốc kết thúc và đội thắng"
          >
            <Link2 size={14} /> {phone ? "Video" : "Video & kết thúc ván"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onPanel({ kind: "draft" })} aria-label="Cấm chọn">
            <ShieldBan size={14} /> Cấm chọn
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPanel({ kind: "loadout" })}
            aria-label="Tuyển thủ, phụ trợ, phù hiệu, bảng ngọc và trang bị"
          >
            <Gem size={14} /> {phone ? "Tuyển thủ, đồ" : "Tuyển thủ, ngọc, trang bị"}
          </Button>
          {focused.live ? (
            !phone && (
              <Button size="sm" onClick={() => onPanel({ kind: "composer", eventKind: "KILL" })}>
                <Plus size={14} /> Ghi sự kiện
              </Button>
            )
          ) : (
            <Button
              size="sm"
              disabled={!canGoLive}
              title={
                canGoLive
                  ? "Đặt 0:00 của đồng hồ game tại vị trí video này"
                  : hasVideo
                    ? "Tua video tới lúc vào trận, sau các lượt cấm chọn đã ghi"
                    : "Gắn video của trận trước"
              }
              onClick={goLive}
            >
              <Flag size={14} /> Vào trận {focused.number} tại <VideoMark /> {formatClock(at)}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPanel({ kind: "info" })}
            aria-label={`Thông tin ván ${focused.number}`}
            title="Mùa và patch của ván, số ván, ghi chú, gỡ công khai, xóa ván"
          >
            <Info size={14} /> {phone ? "Thông tin" : `Thông tin ván ${focused.number}`}
          </Button>
        </>
      )}
      {editable && startButton}
    </span>
  )
}
