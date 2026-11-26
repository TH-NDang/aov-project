import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import type { DocumentView, GameContent } from "@aov/community-contracts"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { currentTimeZone } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import { useTournamentGames } from "../../data/use-esports-data"
import { seriesWinner, type SeriesRecord } from "../../model/competition"
import type { TeamView } from "../../model/game-view"
import { formatDay, formatTime, stageInfo } from "../../model/labels"
import { matchDays, matchNeighbours } from "../../model/match-order"
import { matchRecording } from "../../model/match-recording"
import { nameKey } from "../../model/name-key"
import { seriesLabel } from "../../model/series-label"
import { matchPath } from "../../pages/esports-shell"
import { MATCH_STATE_LABELS } from "../match-recording-strip"
import { TeamLogo } from "../primitives"
import { isTyping } from "./key-owner"

/**
 * Moves between the matches of a tournament in time order, keeping the recording mode: the match before, the match
 * after, or any match from a list with its score and how far it is recorded.
 */
export function MatchSwitcher({
  records,
  seriesId,
  team,
  editing,
  keysEnabled = true,
}: {
  records: readonly SeriesRecord[]
  seriesId: string
  team: (id: string) => TeamView
  editing: boolean
  /** Shift + P and Shift + N; off with the Admin switch for shortcuts, and in a second place of the same screen. */
  keysEnabled?: boolean
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { position, total, previous, next } = matchNeighbours(records, seriesId)
  const path = (record: SeriesRecord) =>
    `${matchPath(record.content.tournamentId, record.id)}${editing ? "?edit=1" : ""}`
  const pairName = (record: SeriesRecord) =>
    `${team(record.content.teamAId).shortName} – ${team(record.content.teamBId).shortName}`

  const go = useRef({ P: () => {}, N: () => {} })
  go.current = {
    P: () => previous && void navigate(path(previous)),
    N: () => next && void navigate(path(next)),
  }
  useEffect(() => {
    if (!keysEnabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toUpperCase()
      // A question on screen is answered first; leaving the match would drop it.
      if ((key !== "P" && key !== "N") || isTyping(event.target) || document.querySelector('[role="alertdialog"]'))
        return
      event.preventDefault()
      go.current[key]()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keysEnabled])

  if (total < 2) return null
  const step = (record: SeriesRecord | null, label: string, key: string, icon: typeof ChevronLeft) => {
    const Icon = icon
    const name = record ? `${label}: ${pairName(record)} (Shift + ${key})` : `Không có ${label.toLowerCase()}`
    return record ? (
      <Button asChild size="icon-sm" variant="ghost">
        <Link to={path(record)} aria-label={name} title={name}>
          <Icon aria-hidden />
        </Link>
      </Button>
    ) : (
      <Button size="icon-sm" variant="ghost" disabled aria-label={name} title={name}>
        <Icon aria-hidden />
      </Button>
    )
  }
  return (
    <nav className="flex shrink-0 items-center" aria-label="Chuyển trận">
      {step(previous, "Trận trước", "P", ChevronLeft)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="esp-num px-2"
            aria-label={`Trận ${position} trên ${total}, chọn trận`}
            title="Chọn trận"
          >
            {position}/{total}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(26rem,calc(100vw-1.5rem))] p-0">
          <MatchList records={records} seriesId={seriesId} team={team} path={path} onPicked={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
      {step(next, "Trận sau", "N", ChevronRight)}
    </nav>
  )
}

/** The games of the tournament are only read while the list is open: they say how far each match is recorded. */
function MatchList({
  records,
  seriesId,
  team,
  path,
  onPicked,
}: {
  records: readonly SeriesRecord[]
  seriesId: string
  team: (id: string) => TeamView
  path: (record: SeriesRecord) => string
  onPicked: () => void
}) {
  const [search, setSearch] = useState("")
  const games = useTournamentGames(records[0]?.content.tournamentId ?? "")
  const byMatch = useMemo(() => {
    if (!games.data) return null
    const index = new Map<string, DocumentView<GameContent>[]>()
    for (const game of games.data) {
      const rows = index.get(game.content.seriesId)
      if (rows) rows.push(game)
      else index.set(game.content.seriesId, [game])
    }
    return index
  }, [games.data])
  const key = nameKey(search)
  const shown = records.filter(({ content }) => {
    const teams = [team(content.teamAId), team(content.teamBId)]
    const words = [...teams.flatMap((entry) => [entry.name, entry.shortName]), seriesLabel(content) ?? ""]
    return words.some((word) => nameKey(word).includes(key))
  })
  const list = useRef<HTMLDivElement>(null)
  const current = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const box = list.current
    if (!box) return
    let at = box.scrollTop
    const showCurrent = () => {
      if (Math.abs(box.scrollTop - at) > 1) return
      current.current?.scrollIntoView?.({ block: "center" })
      at = box.scrollTop
    }
    showCurrent()
    if (typeof ResizeObserver === "undefined") return
    // The list has its height only once the popover is placed. One that was scrolled meanwhile stays where it is.
    const observer = new ResizeObserver(showCurrent)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Tìm trận theo đội"
          placeholder="Tìm theo đội hoặc vòng"
          className="h-8 pl-8"
        />
      </div>
      {/* What is left of the room under the search field, so the list scrolls inside its popover. */}
      <div
        ref={list}
        className="max-h-[min(60vh,28rem,calc(var(--radix-popover-content-available-height,100vh)-3.25rem))] overflow-y-auto py-1"
      >
        {matchDays(shown, currentTimeZone()).map((group) => (
          <section key={group.day ?? "none"} aria-label={group.day ? formatDay(group.day) : "Chưa xếp lịch"}>
            <h3 className="type-label px-3 pt-2 pb-1 text-muted-foreground first-letter:uppercase">
              {group.day ? formatDay(group.day) : "Chưa xếp lịch"}
            </h3>
            {group.records.map((record) => {
              const here = record.id === seriesId
              const recording = byMatch && matchRecording(record.content, byMatch.get(record.id) ?? [])
              return (
                <Link
                  key={record.id}
                  ref={here ? current : undefined}
                  to={path(record)}
                  aria-current={here ? "page" : undefined}
                  onClick={onPicked}
                  className={cn(
                    "grid grid-cols-[2.75rem_minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-x-2 px-3 py-1.5 hover:bg-muted",
                    here && "bg-foreground/10",
                  )}
                >
                  <span className="type-meta esp-num">{formatTime(record.content.scheduledAt)}</span>
                  <MatchSide team={team(record.content.teamAId)} won={seriesWinner(record.content) === "A"} />
                  <span className="type-body esp-num text-center">
                    {record.content.result
                      ? `${record.content.result.scoreA} – ${record.content.result.scoreB}`
                      : "– : –"}
                  </span>
                  <MatchSide team={team(record.content.teamBId)} won={seriesWinner(record.content) === "B"} right />
                  <span className="type-meta col-start-2 col-end-5 flex min-w-0 justify-between gap-2">
                    <span className="truncate">
                      {seriesLabel(record.content) || stageInfo(record.content.stage).label}
                    </span>
                    {recording && recording.state !== "upcoming" && (
                      <span
                        className={cn(
                          "shrink-0",
                          recording.state === "complete" && "text-(--aov-success)",
                          recording.state === "unconfirmed" && "text-(--aov-warning)",
                        )}
                      >
                        {MATCH_STATE_LABELS[recording.state]}, {recording.games.length}
                        {recording.expected != null && `/${recording.expected}`} ván
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </section>
        ))}
        {!shown.length && <p className="type-body px-3 py-4 text-muted-foreground">Không có trận phù hợp.</p>}
      </div>
    </>
  )
}

function MatchSide({ team, won, right }: { team: TeamView; won: boolean; right?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", right && "flex-row-reverse")}>
      <TeamLogo team={team} size={20} />
      <span className={cn("type-body truncate", !won && "text-muted-foreground")}>{team.shortName}</span>
    </span>
  )
}
