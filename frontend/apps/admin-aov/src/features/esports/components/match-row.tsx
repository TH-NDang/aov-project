import type { ReactNode } from "react"
import { ChevronRight, PlayCircle } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { seriesWinner, type SeriesRecord } from "../model/competition"
import { formatTime, stageInfo } from "../model/labels"
import { RelativeDate } from "./relative-date"
import type { TeamView } from "../model/game-view"
import { youtubeVideoId } from "../model/vod"
import { BestOfBadge, ScorePill, TeamLogo } from "./primitives"

/** Compact Liquipedia-style match line: date · team A score–score team B · format. */
export function MatchRow({
  record,
  team,
  onOpen,
  showStage = false,
  trailing,
}: {
  record: SeriesRecord
  team: (id: string) => TeamView
  onOpen?: () => void
  showStage?: boolean
  trailing?: ReactNode
}) {
  const { content } = record
  const winner = seriesWinner(content)
  const a = team(content.teamAId)
  const b = team(content.teamBId)
  const played = !!content.result
  const hasVod = !!youtubeVideoId(content.sourceUrl)
  const side = (view: TeamView, align: "start" | "end", won: boolean) => (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2",
        align === "end" && "flex-row-reverse text-right",
        played && winner && !won && "esp-loser",
      )}
    >
      <TeamLogo team={view} size={28} />
      <span className="min-w-0">
        <span className={cn("block truncate text-sm", won ? "font-semibold" : "font-medium")}>
          <span className="@xl:hidden">{view.shortName}</span>
          <span className="hidden @xl:inline">{view.name}</span>
        </span>
      </span>
    </span>
  )
  const body = (
    <>
      <span className="hidden w-[92px] shrink-0 flex-col text-xs text-muted-foreground @lg:flex">
        <RelativeDate value={content.scheduledAt} fallback="Chưa lịch" className="w-fit" />
        <span className="esp-num">{formatTime(content.scheduledAt)}</span>
      </span>
      {side(a, "start", winner === "A")}
      <span className="flex shrink-0 flex-col items-center gap-1">
        <span className="flex items-center gap-1">
          <ScorePill score={content.result?.scoreA} win={winner === "A"} />
          <span className="text-xs text-muted-foreground">:</span>
          <ScorePill score={content.result?.scoreB} win={winner === "B"} />
        </span>
        <span className="flex items-center gap-1.5">
          <BestOfBadge bestOf={content.bestOf} />
          {showStage && (
            <span className="hidden text-[10px] text-muted-foreground @2xl:inline">
              {stageInfo(content.stage).label}
            </span>
          )}
        </span>
      </span>
      {side(b, "end", winner === "B")}
      <span className="flex w-10 shrink-0 items-center justify-end gap-1 text-muted-foreground">
        {hasVod && <PlayCircle size={15} aria-label="Có video" />}
        {trailing ?? (onOpen && <ChevronRight size={16} aria-hidden="true" />)}
      </span>
    </>
  )
  const className = "flex w-full items-center gap-3 px-3 py-2.5 text-left"
  return onOpen ? (
    <button
      type="button"
      className={cn(
        className,
        "transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
      )}
      onClick={onOpen}
      aria-label={`${a.name} ${content.result?.scoreA ?? ""} - ${content.result?.scoreB ?? ""} ${b.name}`}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}
