import { Crown } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import type { GameView } from "../../model/game-view"
import type { RecordingProgress } from "../../model/recording-progress"
import type { GameChapter } from "../../model/series-vod"
import { killScoreAt } from "../../model/timeline"
import { ProgressBadge } from "../game/progress-badge"
import { TeamLogo, TimeTag } from "../primitives"

/** One chip per game of the match, with its progress, winner and length; picking one brings the video to it. */
export function GameChips({
  chapters,
  views,
  progressOf,
  focusedGameId,
  hasVideo,
  onPick,
}: {
  chapters: GameChapter[]
  views: Record<string, GameView>
  progressOf: Record<string, RecordingProgress | undefined>
  focusedGameId: string | undefined
  /** With a video, a game not placed on it yet says so. */
  hasVideo: boolean
  onPick: (chapter: GameChapter) => void
}) {
  if (!chapters.length) return null
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Các ván">
      {chapters.map((chapter) => {
        const view = views[chapter.gameId]
        const winner = chapter.winner ? view?.sides[chapter.winner].team : null
        const active = chapter.gameId === focusedGameId
        return (
          <button
            key={chapter.gameId}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onPick(chapter)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
              active ? "border-[var(--esp-gold)] bg-[var(--esp-gold-soft)]" : "bg-card hover:bg-muted",
            )}
          >
            <span className="text-sm font-bold">Ván {chapter.number}</span>
            {progressOf[chapter.gameId] && <ProgressBadge progress={progressOf[chapter.gameId]!} />}
            {winner && (
              <span className="flex items-center gap-1 text-xs">
                <TeamLogo team={winner} size={18} />
                <Crown size={12} className="text-[var(--esp-gold)]" aria-label="thắng" />
              </span>
            )}
            <span className="esp-num text-xs text-muted-foreground" title="Thời lượng ván">
              ⏱ {formatClock(chapter.duration)}
            </span>
            {!chapter.synced && hasVideo && (
              <span className="rounded bg-muted px-1 text-xs text-muted-foreground">chưa căn video</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** The game the page is on: the kill score at the playhead and its game clock, or the phase it is still in. */
export function GameScoreCard({
  chapter,
  view,
  playing,
  at,
  gameAt,
}: {
  chapter: GameChapter
  view: GameView
  /** True when the playhead is inside this game, false when it was only picked last. */
  playing: boolean
  at: number
  gameAt: number
}) {
  const score = killScoreAt(chapter.events, gameAt)
  return (
    <div className="flex items-center gap-3 admin-section px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground">
        {playing ? "Đang phát" : "Ván đang chọn"} · Ván {chapter.number}
      </span>
      <span className="esp-num ml-auto flex items-center gap-2 text-base font-bold">
        <TeamLogo team={view.sides.BLUE.team} size={22} />
        <span className="text-[var(--esp-blue)]">{score.BLUE}</span>
        <span className="text-muted-foreground">–</span>
        <span className="text-[var(--esp-red)]">{score.RED}</span>
        <TeamLogo team={view.sides.RED.team} size={22} />
      </span>
      {chapter.live && at >= chapter.start ? (
        <TimeTag kind="game" seconds={gameAt} className="rounded bg-muted px-2 text-xs font-semibold" />
      ) : (
        <span className="rounded bg-muted px-2 text-xs font-semibold">
          {chapter.draft && at >= chapter.from ? "Cấm chọn" : "Chưa vào trận"}
        </span>
      )}
    </div>
  )
}
