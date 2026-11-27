import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useNavigationType } from "react-router"
import type { PlannedMatch } from "@aov/community-contracts"
import { ChevronDown, ChevronRight, Pencil, PlayCircle, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@aov/ui/components/drawer"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { LocalTime } from "@aov/ui/components/local-time"
import { dayKeyInZone, formatCalendarDate, formatInZone } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import { MatchRecordingStrip } from "@/features/esports/components/match-recording-strip"
import { TeamLogo } from "@/features/esports/components/primitives"
import { matchRecording } from "@/features/esports/model/match-recording"
import { youtubeVideoId } from "@/features/esports/model/vod"
import { matchPath } from "@/features/esports/pages/esports-shell"
import { TeamName } from "../peek/competitor-peek"
import { MatchPanel, type MatchPanelMode } from "../workspace/match-panel"
import { hasScore, matchLabel, restingTeams, slotText, type GroupMode, type MatchGroup } from "../workspace/model"
import { Chip, type Workspace } from "../workspace/parts"

const ROW = "@2xl:grid-cols-[88px_minmax(0,1fr)_72px_minmax(0,1fr)_minmax(0,auto)_20px]"

export function sideName(ws: Workspace, match: PlannedMatch, which: "a" | "b") {
  const row = ws.resolved.get(match.key)
  const id = which === "a" ? row?.teamAId : row?.teamBId
  return id ? ws.team(id).name : slotText(match[which], ws.plan, ws.teams)
}

/** A side's name: the team's, which opens its card, or the slot it waits for. */
export function SideName({ ws, match, which }: { ws: Workspace; match: PlannedMatch; which: "a" | "b" }) {
  const row = ws.resolved.get(match.key)
  const id = which === "a" ? row?.teamAId : row?.teamBId
  return id ? <TeamName id={id} /> : <>{slotText(match[which], ws.plan, ws.teams)}</>
}

/** Router state of a link to a match's recording screen opened from the schedule: its way back is Back itself. */
export const FROM_SCHEDULE = { fromSchedule: true } as const

export function ScoreChip({ ws, match }: { ws: Workspace; match: PlannedMatch }) {
  const row = ws.resolved.get(match.key)
  return hasScore(row) ? (
    <Chip tone="ok">
      {row!.scoreA} : {row!.scoreB}
    </Chip>
  ) : (
    <Chip tone="warn">Chưa có tỷ số</Chip>
  )
}

/** Recording status of the match's games, then the read-first panel with its actions. */
export function MatchDetail({
  ws,
  match,
  mode,
  sheet,
}: {
  ws: Workspace
  match: PlannedMatch
  mode?: MatchPanelMode
  sheet?: boolean
}) {
  const navigate = useNavigate()
  const record = ws.series.find((row) => row.id === match.seriesId)
  const games = ws.games?.filter((entry) => entry.content.seriesId === record?.id)
  return (
    <>
      {record && games && (
        <MatchRecordingStrip
          recording={matchRecording(record.content, games)}
          onOpen={(gameId) =>
            navigate(`${matchPath(ws.entry.id, record.id)}?edit=1${gameId ? `&game=${gameId}` : ""}`, {
              state: FROM_SCHEDULE,
            })
          }
        />
      )}
      <MatchPanel key={mode} ws={ws} match={match} initialMode={mode} sheet={sheet} />
    </>
  )
}

function dayLabel(day: string | undefined, today: string) {
  if (!day) return "Chưa có lịch"
  const shift = (offset: number) => {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }
  if (day === today) return "Hôm nay"
  if (day === shift(1)) return "Ngày mai"
  if (day === shift(-1)) return "Hôm qua"
  return formatCalendarDate(day, { weekday: "long", day: "2-digit", month: "2-digit" })
}

const shortDay = (value: number, timeZone: string) =>
  formatInZone(value, timeZone, { day: "2-digit", month: "2-digit" })

/**
 * One match over the list on a phone: its teams and score on top, then everything the wide screen shows under the row.
 * It closes when dragged down or tapped outside, and the list stays where it was.
 */
export function MatchSheet({
  ws,
  match,
  mode,
  onClose,
}: {
  ws: Workspace
  match: PlannedMatch
  mode?: MatchPanelMode
  onClose: () => void
}) {
  const row = ws.resolved.get(match.key)
  const scored = hasScore(row)
  return (
    <Drawer open onOpenChange={(value) => !value && onClose()}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerTitle className="sr-only">{matchLabel(match)}</DrawerTitle>
        <DrawerDescription className="sr-only">Kết quả, video và người của trận</DrawerDescription>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <header className="space-y-2 border-b px-4 pt-1 pb-3">
            <p className="type-meta flex flex-wrap items-center gap-x-2">
              <span>{matchLabel(match)}</span>
              <span aria-hidden>·</span>
              <LocalTime
                value={match.scheduledAt}
                sourceTimeZone={ws.plan.timezone}
                format={{ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }}
                fallback="Chưa có giờ"
              />
              <span aria-hidden>·</span>
              <span>BO{match.bestOf}</span>
            </p>
            {(["a", "b"] as const).map((which) => {
              const id = which === "a" ? row?.teamAId : row?.teamBId
              const score = which === "a" ? row?.scoreA : row?.scoreB
              const won = scored && score! > (which === "a" ? row!.scoreB! : row!.scoreA!)
              return (
                <div key={which} className="flex items-center gap-3">
                  {id ? (
                    <TeamLogo team={ws.team(id)} size={32} />
                  ) : (
                    <span className="size-8 shrink-0 rounded-md bg-muted" />
                  )}
                  <span className={cn("type-section-title min-w-0 flex-1 truncate", scored && !won && "opacity-70")}>
                    <SideName ws={ws} match={match} which={which} />
                  </span>
                  <span className={cn("type-section-title tabular-nums", won && "text-primary")}>{score ?? "–"}</span>
                </div>
              )
            })}
          </header>
          <MatchDetail ws={ws} match={match} mode={mode} sheet />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/** Folds the editor opened or closed, kept for the tab, so coming back shows the list as it was left. */
function useRememberedFolds(name: string) {
  const key = `aov:schedule-folds:${name}`
  const [folds, setFolds] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const change = (next: Record<string, boolean>) => {
    setFolds(next)
    try {
      sessionStorage.setItem(key, JSON.stringify(next))
    } catch {
      // A browser that keeps nothing still folds; it only forgets on the way back.
    }
  }
  return [folds, change] as const
}

export function MatchGroups({
  ws,
  groups,
  mode,
  restFrom,
  focus,
  focusMode,
  openAll,
  remember,
}: {
  ws: Workspace
  groups: MatchGroup[]
  mode: GroupMode
  /** Teams of the stage, to name who sits a round out; left out when the list is filtered. */
  restFrom?: string[]
  /** The open match, kept in the address. */
  focus?: string
  /** What the focused match opens with. */
  focusMode?: MatchPanelMode
  /** A narrowed list shows every group, so nothing that matched stays folded away. */
  openAll?: boolean
  /** Names the list whose folds are remembered for the tab. */
  remember: string
}) {
  const compact = usePageLayout() === "compact"
  const [toggled, setToggled] = useRememberedFolds(`${ws.entry.id}:${remember}`)
  // A link scrolls to the match it names once; Back leaves the scroll where it was.
  const navigation = useNavigationType()
  const [arrivedAt] = useState(() => (navigation === "POP" ? undefined : focus))
  const openMatch = (key: string | null, panel?: MatchPanelMode) =>
    ws.keep({ key: key ?? undefined, match: undefined, open: panel === "result" ? "result" : undefined })
  const opened = focus ? groups.flatMap((group) => group.matches).find((match) => match.key === focus) : undefined
  const today = dayKeyInZone(Date.now(), ws.plan.timezone)
  return (
    <div className="space-y-3">
      {groups.map((group, index) => {
        const shown = toggled[group.key] ?? (openAll || index < 2 || group.matches.some((match) => match.key === focus))
        const complete = group.scored === group.matches.length
        const span = Number.isFinite(group.firstAt)
          ? shortDay(group.firstAt, ws.plan.timezone) +
            (Number.isFinite(group.lastAt) &&
            dayKeyInZone(group.lastAt, ws.plan.timezone) !== dayKeyInZone(group.firstAt, ws.plan.timezone)
              ? `–${shortDay(group.lastAt, ws.plan.timezone)}`
              : "")
          : ""
        const resting =
          mode === "round" && restFrom
            ? restingTeams(group, restFrom, ws.resolved).map((id) => ws.team(id).shortName)
            : []
        return (
          <section key={group.key} className="admin-panel @container min-w-0 overflow-hidden">
            <button
              type="button"
              aria-expanded={shown}
              onClick={() => setToggled({ ...toggled, [group.key]: !shown })}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
            >
              {/* A narrow card puts the facts under the name, so the status stays beside it. */}
              <span className="flex min-w-0 flex-col gap-0.5 @2xl:flex-row @2xl:flex-wrap @2xl:items-baseline @2xl:gap-x-3">
                <span className="type-section-title">
                  {mode === "round" ? `Vòng ${group.round}` : dayLabel(group.day, today)}
                </span>
                <span className="type-meta">
                  {[
                    mode === "round" ? span : "",
                    `${group.matches.length} trận`,
                    resting.length ? `${resting.join(", ")} nghỉ` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Chip tone={complete ? "ok" : "warn"}>
                  {complete ? "Đủ tỷ số" : `${group.scored}/${group.matches.length} có tỷ số`}
                </Chip>
                {shown ? (
                  <ChevronDown className="size-4" aria-hidden />
                ) : (
                  <ChevronRight className="size-4" aria-hidden />
                )}
              </span>
            </button>
            {shown && (
              <div className="border-t">
                {group.matches.map((match) => (
                  <MatchLine
                    key={match.key}
                    ws={ws}
                    match={match}
                    today={today}
                    open={focus === match.key}
                    inline={!compact}
                    mode={focus === match.key ? focusMode : undefined}
                    focused={match.key === arrivedAt}
                    onOpen={(next) => openMatch(next ? match.key : null, next?.mode)}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
      {compact && opened && <MatchSheet ws={ws} match={opened} mode={focusMode} onClose={() => openMatch(null)} />}
    </div>
  )
}

function MatchLine({
  ws,
  match,
  today,
  open,
  inline,
  mode,
  focused,
  onOpen,
}: {
  ws: Workspace
  match: PlannedMatch
  today: string
  open: boolean
  /** Whether the open match unfolds under its row; on a phone it opens in a sheet instead. */
  inline: boolean
  mode?: MatchPanelMode
  /** The match a link asked for: it is scrolled into view once. */
  focused?: boolean
  /** Opens the line, straight in one of its forms when asked; null closes it. */
  onOpen: (value: { mode?: MatchPanelMode } | null) => void
}) {
  const line = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focused) line.current?.scrollIntoView?.({ block: "center" })
  }, [focused])
  const row = ws.resolved.get(match.key)
  const scored = hasScore(row)
  const record = ws.series.find((entry) => entry.id === match.seriesId)
  const live = ws.published ? ws.published.resolved.find((entry) => entry.key === match.key) : undefined
  const unpublished = !!ws.published && (row?.scoreA ?? null) !== (live?.scoreA ?? null)
  const isToday = !!match.scheduledAt && dayKeyInZone(match.scheduledAt, ws.plan.timezone) === today
  const games = ws.games?.filter((entry) => entry.content.seriesId === match.seriesId).length
  const won = (which: "a" | "b") =>
    scored && (which === "a" ? row!.scoreA! > row!.scoreB! : row!.scoreB! > row!.scoreA!)
  const side = (which: "a" | "b", mirrored: boolean) => {
    const id = which === "a" ? row?.teamAId : row?.teamBId
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          mirrored && "flex-row-reverse text-right",
          scored && !won(which) && "text-muted-foreground",
        )}
      >
        {id ? <TeamLogo team={ws.team(id)} size={28} /> : <span className="size-7 shrink-0 rounded-md bg-muted" />}
        <span className={cn("type-body truncate", won(which) && "font-semibold", !id && "text-muted-foreground")}>
          {id ? ws.team(id).name : slotText(match[which], ws.plan, ws.teams)}
        </span>
      </span>
    )
  }
  const time = (
    <LocalTime
      value={match.scheduledAt}
      sourceTimeZone={ws.plan.timezone}
      format={{ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }}
      fallback="Chưa có giờ"
    />
  )
  const marks = (
    <>
      {isToday && <Chip tone="info">Hôm nay</Chip>}
      {unpublished && <Chip tone="warn">Chưa công bố</Chip>}
      {games != null && games > 0 && <Chip>{games} ván</Chip>}
      {youtubeVideoId(record?.content.sourceUrl) && (
        <PlayCircle className="size-4 text-muted-foreground" role="img" aria-label="Có video" />
      )}
    </>
  )
  const arrow = open ? (
    <ChevronDown className="size-4 shrink-0 text-primary" aria-hidden />
  ) : (
    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  )
  return (
    <div ref={line} className={cn("border-b last:border-b-0", open && "bg-muted/40")}>
      <div className="flex items-stretch hover:bg-muted/60">
        <button
          type="button"
          aria-expanded={inline ? open : undefined}
          aria-haspopup={inline ? undefined : "dialog"}
          onClick={() => onOpen(open ? null : {})}
          className="min-w-0 flex-1 py-1.5 pr-2 pl-4 text-left"
        >
          <span className={cn("hidden min-h-9 items-center gap-3 @2xl:grid", ROW)}>
            <span className="type-meta">{time}</span>
            {side("a", true)}
            <span
              className={cn(
                "type-body inline-flex h-7 items-center justify-center rounded-md border px-2 tabular-nums",
                scored ? "bg-muted" : "border-dashed font-semibold text-primary",
                open && "border-primary",
              )}
            >
              {scored ? `${row!.scoreA} : ${row!.scoreB}` : "VS"}
            </span>
            {side("b", false)}
            <span className="flex items-center justify-end gap-1.5">{marks}</span>
            {arrow}
          </span>
          <span className="grid gap-1.5 py-1 @2xl:hidden">
            <span className="flex flex-wrap items-center gap-2">
              <span className="type-meta">{time}</span>
              {marks}
              {inline && <span className="ml-auto">{arrow}</span>}
            </span>
            {(["a", "b"] as const).map((which) => (
              <span key={which} className="flex items-center justify-between gap-3">
                {side(which, false)}
                <span className={cn("type-body tabular-nums", won(which) && "font-bold text-primary")}>
                  {(which === "a" ? row?.scoreA : row?.scoreB) ?? "–"}
                </span>
              </span>
            ))}
          </span>
        </button>
        {/* On a phone the row only opens its sheet, which holds every action. */}
        {!inline ? (
          <span className="flex shrink-0 items-center pr-4" aria-hidden>
            <ChevronRight className="size-4 text-muted-foreground" />
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-0.5 pr-2">
            {ws.canEdit && record && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`${scored ? "Sửa" : "Nhập"} tỷ số ${sideName(ws, match, "a")} gặp ${sideName(ws, match, "b")}`}
                title={scored ? "Sửa tỷ số" : "Nhập tỷ số"}
                onClick={() => onOpen({ mode: "result" })}
              >
                <Pencil aria-hidden />
              </Button>
            )}
            {record && (
              <Button asChild variant="ghost" size="icon" className="size-9">
                <Link
                  to={`${matchPath(ws.entry.id, record.id)}?edit=1`}
                  state={FROM_SCHEDULE}
                  aria-label={`Ghi ván ${sideName(ws, match, "a")} gặp ${sideName(ws, match, "b")}`}
                  title="Ghi ván đấu"
                >
                  <Swords aria-hidden />
                </Link>
              </Button>
            )}
          </span>
        )}
      </div>
      {open && inline && <MatchDetail ws={ws} match={match} mode={mode} />}
    </div>
  )
}
