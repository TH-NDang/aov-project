import type { MouseEvent, ReactNode } from "react"
import { Link } from "react-router"
import type { SeriesContent } from "@aov/community-contracts"
import { ChevronLeft, ChevronRight, Ellipsis } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import { Segmented } from "@/components/segmented"
import { seriesWinner } from "../../model/competition"
import type { TeamView } from "../../model/game-view"
import { formatTime, relativeDay, stageInfo } from "../../model/labels"
import { seriesLabel } from "../../model/series-label"
import { TeamLogo } from "../primitives"

type Mode = "view" | "record"
const MODES: readonly (readonly [Mode, string])[] = [
  ["view", "Xem"],
  ["record", "Ghi"],
]

/** The round of a match. A typed name may repeat the two teams, which stand beside it, after the name of its group. */
export const roundName = (content: SeriesContent) =>
  (seriesLabel(content) || stageInfo(content.stage).label).replace(/ · [^·]+ vs [^·]+$/, "")

/** When a match is played: its day the way people say it, and the hour. */
export function MatchTime({ value }: { value: string | null | undefined }) {
  return (
    <LocalTime
      value={value}
      label={() => [relativeDay(value), formatTime(value)].filter(Boolean).join(", ")}
      fallback="Chưa xếp lịch"
    />
  )
}

function Team({ team, lost, first }: { team: TeamView; lost: boolean; first?: boolean }) {
  return (
    <>
      {first && <TeamLogo team={team} size={22} />}
      <span data-lost={lost || undefined}>
        <span className="esp-head-short">{team.shortName}</span>
        <span className="esp-head-full">{team.name}</span>
      </span>
      {!first && <TeamLogo team={team} size={22} />}
    </>
  )
}

/** One line for the match: where it belongs, both teams with the score, and what is done with the whole of it. */
export function StudioHead({
  tournament,
  content,
  team,
  mode,
  onMode,
  publish,
  menuOpen,
  onMenu,
  switcher,
}: {
  /** Where the trail leads: the match in the tournament's schedule; `back` when Back itself returns there. */
  tournament: { name: string; path: string; back?: () => void }
  content: SeriesContent
  team: (id: string) => TeamView
  mode: Mode
  /** Absent for an account that may only read. */
  onMode?: (mode: Mode) => void
  /** Absent without games, or for an account that can neither record nor publish. */
  publish: { waiting: number; open: boolean; onOpen: () => void } | null
  menuOpen: boolean
  onMenu: () => void
  /** The way to the other matches of the tournament. */
  switcher: ReactNode
}) {
  const winner = seriesWinner(content)
  const score = content.result ? ([content.result.scoreA, content.result.scoreB] as const) : null
  const menuName = publish?.waiting ? `Trận này, ${publish.waiting} ván chờ xuất bản` : "Trận này"
  const toSchedule = (event: MouseEvent) => {
    if (!tournament.back || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    tournament.back()
  }
  const scheduleName = `Lịch & kết quả · ${tournament.name}`
  return (
    <header className="esp-head type-body">
      {/* A narrow head has no room for the tournament's name: an arrow leads to the same place. */}
      <Button asChild size="icon-sm" variant="ghost" className="esp-head-back">
        <Link to={tournament.path} aria-label={`Về ${scheduleName}`} title={scheduleName} onClick={toSchedule}>
          <ChevronLeft aria-hidden />
        </Link>
      </Button>
      <span className="esp-head-trail">
        <Link to={tournament.path} title={scheduleName} className="truncate hover:text-foreground" onClick={toSchedule}>
          {tournament.name}
        </Link>
        <ChevronRight size={14} className="shrink-0" aria-hidden />
      </span>
      <h1 className="esp-head-teams type-section-title">
        <Team team={team(content.teamAId)} lost={winner === "B"} first />
        <span className="esp-num">
          <span data-lost={winner === "B" || undefined}>{score?.[0]}</span>
          <span data-lost> – </span>
          <span data-lost={winner === "A" || undefined}>{score?.[1]}</span>
        </span>
        <Team team={team(content.teamBId)} lost={winner === "A"} />
      </h1>
      <span className="esp-head-round">{roundName(content)}</span>
      <span className="esp-head-when type-meta">
        BO{content.bestOf}, <MatchTime value={content.scheduledAt} />
      </span>
      <span className="esp-head-acts">
        {onMode && <Segmented label="Chế độ" value={mode} options={MODES} onChange={onMode} />}
        {publish && (
          <span className="esp-head-wide">
            <Button
              variant="outline"
              className="px-3 aria-pressed:bg-accent"
              aria-pressed={publish.open}
              onClick={publish.onOpen}
            >
              Xuất bản {publish.waiting > 0 && <span className="esp-num">{publish.waiting}</span>}
            </Button>
          </span>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="esp-head-more aria-pressed:bg-accent"
          aria-label={menuName}
          aria-pressed={menuOpen}
          title={menuName}
          onClick={onMenu}
        >
          <Ellipsis aria-hidden />
          {!!publish?.waiting && <span className="esp-tab-mark" />}
        </Button>
        <span className="esp-head-wide">{switcher}</span>
      </span>
    </header>
  )
}
