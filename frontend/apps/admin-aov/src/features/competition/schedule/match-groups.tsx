import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import type { PlannedMatch } from "@aov/community-contracts"
import { ChevronDown, ChevronRight, Pencil, PlayCircle, Swords } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import { dayKeyInZone, formatCalendarDate, formatInZone } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import { MatchRecordingStrip } from "@/features/esports/components/match-recording-strip"
import { TeamLogo } from "@/features/esports/components/primitives"
import { matchRecording } from "@/features/esports/model/match-recording"
import { youtubeVideoId } from "@/features/esports/model/vod"
import { matchPath } from "@/features/esports/pages/esports-shell"
import { MatchPanel, type MatchPanelMode } from "../workspace/match-panel"
import { hasScore, restingTeams, slotText, type GroupMode, type MatchGroup } from "../workspace/model"
import { Chip, type Workspace } from "../workspace/parts"

const ROW = "@2xl:grid-cols-[88px_minmax(0,1fr)_72px_minmax(0,1fr)_minmax(0,auto)_20px]"

export function sideName(ws: Workspace, match: PlannedMatch, which: "a" | "b") {
  const row = ws.resolved.get(match.key)
  const id = which === "a" ? row?.teamAId : row?.teamBId
  return id ? ws.team(id).name : slotText(match[which], ws.plan, ws.teams)
}

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
export function MatchDetail({ ws, match, mode }: { ws: Workspace; match: PlannedMatch; mode?: MatchPanelMode }) {
  const navigate = useNavigate()
  const record = ws.series.find((row) => row.id === match.seriesId)
  const games = ws.games?.filter((entry) => entry.content.seriesId === record?.id)
  return (
    <>
      {record && games && (
        <MatchRecordingStrip
          recording={matchRecording(record.content, games)}
          onOpen={(gameId) => navigate(`${matchPath(ws.entry.id, record.id)}?edit=1${gameId ? `&game=${gameId}` : ""}`)}
        />
      )}
      <MatchPanel key={mode} ws={ws} match={match} initialMode={mode} />
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

type OpenMatch = { key: string; mode?: MatchPanelMode }

export function MatchGroups({
  ws,
  groups,
  mode,
  restFrom,
  focus,
  focusMode,
  openAll,
}: {
  ws: Workspace
  groups: MatchGroup[]
  mode: GroupMode
  /** Teams of the stage, to name who sits a round out; left out when the list is filtered. */
  restFrom?: string[]
  focus?: string
  /** What the focused match opens with. */
  focusMode?: MatchPanelMode
  /** A narrowed list shows every group, so nothing that matched stays folded away. */
  openAll?: boolean
}) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState<OpenMatch | null>(focus ? { key: focus, mode: focusMode } : null)
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
              onClick={() => setToggled((value) => ({ ...value, [group.key]: !shown }))}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-left"
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
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
              <span className="flex items-center gap-2">
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
                    open={open?.key === match.key}
                    mode={open?.key === match.key ? open.mode : undefined}
                    focused={match.key === focus}
                    onOpen={(next) => setOpen(next ? { key: match.key, ...next } : null)}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function MatchLine({
  ws,
  match,
  today,
  open,
  mode,
  focused,
  onOpen,
}: {
  ws: Workspace
  match: PlannedMatch
  today: string
  open: boolean
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
          aria-expanded={open}
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
              <span className="ml-auto">{arrow}</span>
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
                aria-label={`Ghi ván ${sideName(ws, match, "a")} gặp ${sideName(ws, match, "b")}`}
                title="Ghi ván đấu"
              >
                <Swords aria-hidden />
              </Link>
            </Button>
          )}
        </span>
      </div>
      {open && <MatchDetail ws={ws} match={match} mode={mode} />}
    </div>
  )
}
