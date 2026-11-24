import type { ReactNode } from "react"
import { Crown, Loader2, Plus, ShieldBan, VideoOff, Zap } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import type { GameView } from "../../model/game-view"
import type { RecordingProgress } from "../../model/recording-progress"
import type { GameChapter } from "../../model/series-vod"
import { ProgressBadge } from "../game/progress-badge"
import { TeamLogo, VideoMark } from "../primitives"

/** The games of the match as tabs: who won, how far each is recorded and how long it took. */
export function GameChips({
  chapters,
  views,
  progressOf,
  focusedId,
  hasVideo,
  onSelect,
  children,
}: {
  chapters: GameChapter[]
  views: Record<string, GameView>
  progressOf: Record<string, RecordingProgress | undefined>
  focusedId: string | null
  hasVideo: boolean
  onSelect: (chapter: GameChapter) => void
  /** Actions on the list itself, such as adding a game; they stay in view while the tabs scroll. */
  children?: ReactNode
}) {
  if (!chapters.length && !children) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chapters.length > 0 && (
        <div className="flex min-w-0 gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Các ván">
          {chapters.map((chapter) => {
            const view = views[chapter.gameId]
            const winner = chapter.winner ? view?.sides[chapter.winner].team : null
            const active = chapter.gameId === focusedId
            const progress = progressOf[chapter.gameId]
            return (
              <button
                key={chapter.gameId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(chapter)}
                className={cn(
                  "flex shrink-0 flex-col gap-1 rounded-xl border px-3 py-1.5 text-left transition",
                  active ? "border-[var(--esp-gold)] bg-[var(--esp-gold-soft)]" : "bg-card hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  Ván {chapter.number}
                  {winner && (
                    <span className="ml-auto flex items-center gap-1">
                      <TeamLogo team={winner} size={18} />
                      <Crown size={12} className="text-[var(--esp-gold)]" aria-label="thắng" />
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {progress && <ProgressBadge progress={progress} />}
                  <span className="esp-num ml-auto" title="Thời lượng ván">
                    ⏱ {view?.durationSeconds != null ? formatClock(view.durationSeconds) : "--:--"}
                  </span>
                  {!chapter.synced && hasVideo && <VideoOff size={12} role="img" aria-label="Chưa căn video" />}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Adds the next game: at the position of the video when there is one, as an empty game otherwise. */
export function AddGameButton({
  number,
  first,
  pending,
  insideGame,
  videoAt,
  onAdd,
}: {
  number: number
  first: boolean
  pending: boolean
  /** The recorded game the video is in, which a new game may not start in. */
  insideGame: number | null
  /** The second a game recorded from the video starts at; null without a video. */
  videoAt: number | null
  onAdd: () => void
}) {
  const blocked = videoAt !== null && insideGame !== null
  const Icon = pending ? Loader2 : videoAt === null ? Plus : ShieldBan
  return (
    <Button
      size="sm"
      variant={first ? "default" : "outline"}
      disabled={pending || blocked}
      title={
        blocked
          ? `Đang trong ván ${insideGame}: kết thúc ván ${insideGame} hoặc tua ra ngoài ván`
          : videoAt === null
            ? "Ghi cấm chọn, tuyển thủ và kết quả; video gắn sau cũng được"
            : undefined
      }
      onClick={onAdd}
    >
      <Icon className={cn(pending && "animate-spin")} aria-hidden />
      {videoAt === null ? `Thêm ván ${number}` : `Cấm chọn ván ${number}`}
      {videoAt !== null && (
        <span className="esp-num">
          <VideoMark /> {formatClock(videoAt)}
        </span>
      )}
    </Button>
  )
}

/** Opens the quick entry for games the score counts but nobody recorded. */
export function QuickGamesButton({ missing, onOpen }: { missing: number; onOpen: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onOpen}>
      <Zap aria-hidden /> {missing ? `Ghi nhanh ${missing} ván thiếu` : "Ghi đội thắng các ván"}
    </Button>
  )
}
