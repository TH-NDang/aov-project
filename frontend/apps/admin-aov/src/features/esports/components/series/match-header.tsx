import type { ReactNode } from "react"
import type { SeriesContent } from "@aov/community-contracts"
import { CalendarClock, Crown, ExternalLink } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { seriesWinner } from "../../model/competition"
import type { TeamView } from "../../model/game-view"
import { stageInfo } from "../../model/labels"
import { BestOfBadge, ResultTag, TeamLogo, WinPips } from "../primitives"
import { RelativeDate } from "../relative-date"

/** The match at a glance: stage, time, both teams with the score, and what can be done with the whole match. */
export function MatchHeader({
  content,
  team,
  children,
}: {
  content: SeriesContent
  team: (id: string) => TeamView
  children?: ReactNode
}) {
  const winner = seriesWinner(content)
  const side = (view: TeamView, wins: number | undefined, won: boolean, align: "left" | "right") => (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 @xl:gap-3",
        align === "right" && "flex-row-reverse text-right",
        winner && !won && "esp-loser",
      )}
    >
      <span className="relative shrink-0">
        <TeamLogo
          team={view}
          size={48}
          className={cn("bg-white/5", won && "shadow-[0_0_0_2px_var(--esp-win),0_0_22px_-4px_var(--esp-win)]")}
        />
        {won && <Crown size={16} className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[var(--esp-gold)]" />}
      </span>
      <span className={cn("flex min-w-0 flex-col gap-1", align === "right" ? "items-end" : "items-start")}>
        <span className="block max-w-full truncate font-bold @3xl:text-base">
          <span className="@xl:hidden">{view.shortName}</span>
          <span className="hidden @xl:inline">{view.name}</span>
        </span>
        <span className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
          {winner && <ResultTag won={won} />}
          <span className="hidden @xl:inline-flex">
            <WinPips wins={wins} bestOf={content.bestOf} align={align === "right" ? "end" : "start"} won={won} />
          </span>
        </span>
      </span>
    </div>
  )
  return (
    <section className="esp-banner rounded-2xl">
      <div className="space-y-3 p-4 @3xl:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/70">
          <span className="font-semibold text-white">{stageInfo(content.stage).label}</span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock size={14} />
            <RelativeDate value={content.scheduledAt} withTime fallback="Chưa xếp lịch" />
          </span>
          <BestOfBadge bestOf={content.bestOf} />
          {content.sourceUrl && /^https?:\/\//.test(content.sourceUrl) && (
            <a
              href={content.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:text-white"
              aria-label="Nguồn của trận"
              title={content.sourceUrl}
            >
              <ExternalLink size={14} />
            </a>
          )}
          <span className="ml-auto flex flex-wrap gap-1.5 @xl:gap-2">{children}</span>
        </div>
        <div className="flex items-center gap-2 @xl:gap-3 @3xl:gap-8">
          {side(team(content.teamAId), content.result?.scoreA, winner === "A", "left")}
          <div className="esp-num flex shrink-0 items-center gap-2 text-2xl font-bold">
            <span className={winner === "B" ? "text-white/35" : winner === "A" ? "text-[var(--esp-gold)]" : ""}>
              {content.result?.scoreA ?? "–"}
            </span>
            <span className="text-base text-white/40">:</span>
            <span className={winner === "A" ? "text-white/35" : winner === "B" ? "text-[var(--esp-gold)]" : ""}>
              {content.result?.scoreB ?? "–"}
            </span>
          </div>
          {side(team(content.teamBId), content.result?.scoreB, winner === "B", "right")}
        </div>
      </div>
    </section>
  )
}
