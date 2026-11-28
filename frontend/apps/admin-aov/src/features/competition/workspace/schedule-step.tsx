import { useEffect, useState } from "react"
import { GitBranch, ListOrdered, Settings2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { cn } from "@aov/ui/lib/utils"
import { confirmDiscard } from "@/components/confirm-dialog"
import { NativeSelect } from "@/components/native-select"
import { Segmented } from "@/components/segmented"
import { seriesLabel } from "@/features/esports/model/series-label"
import { filterCounts, matchFilterOf, matchPasses, type MatchFacts, type MatchFilter } from "../model/schedule-model"
import { QuickResults } from "../schedule/quick-results"
import { QuickTimes } from "../schedule/quick-times"
import { LinkBracket, ScheduleSetup } from "../schedule/schedule-setup"
import { NeedFilter, TeamFilter } from "../schedule/schedule-toolbar"
import { BracketMatches, LeagueMatches } from "../schedule/stage-matches"
import { CheckMark } from "./content-check"
import { MatchPeople } from "./match-people"
import { isLeagueStage, layoutBracket, stageProgress } from "./model"
import { Chip, Notice, Panel, type Workspace } from "./parts"

type Mode = "view" | "results" | "times"
const MODES = [
  ["view", "Xem lịch"],
  ["results", "Nhập kết quả"],
  ["times", "Xếp lịch"],
] as const satisfies readonly (readonly [Mode, string])[]

const byTime = (a: MatchFacts, b: MatchFacts) =>
  (a.match.scheduledAt ? Date.parse(a.match.scheduledAt) : Infinity) -
    (b.match.scheduledAt ? Date.parse(b.match.scheduledAt) : Infinity) || a.match.round - b.match.round

/**
 * The schedule by stage, to read, to enter results of many matches, or to arrange many matches. A link names what to
 * open: `match` a series, `key` a planned match, `stage` a stage, `show` a list of matches with work left. What the
 * editor changes here (stage, filters, the open match, how a stage is shown) stays in the address without a new history
 * entry, so Back from a match's recording screen returns to the same screen and place.
 */
export function ScheduleStep({ ws }: { ws: Workspace }) {
  const { plan, focus } = ws
  const compact = usePageLayout() === "compact"
  const focused = plan.matches.find(
    (match) => (focus.match && match.seriesId === focus.match) || (focus.key && match.key === focus.key),
  )
  const outside = focus.match && !focused ? ws.series.find((row) => row.id === focus.match) : undefined
  const filter = matchFilterOf(focus.show ?? null)
  const facts = scheduleFacts(ws)
  const wanted = facts.find((row) => matchPasses(row, filter))
  const firstOpen = plan.stages.find((stage) => {
    const progress = stageProgress(stage.code, plan, ws.resolved)
    return progress.scored < progress.total
  })
  const mode: Mode = focus.open === "results" || focus.open === "times" ? focus.open : "view"
  const teamId = focus.team ?? ""
  const [setup, setSetup] = useState(false)
  const [unsaved, setUnsaved] = useState(false)
  const stageCode =
    focus.stage ??
    focused?.stageCode ??
    (filter !== "ALL" ? wanted?.match.stageCode : undefined) ??
    firstOpen?.code ??
    plan.stages.at(-1)?.code
  const stage = plan.stages.find((entry) => entry.code === stageCode) ?? plan.stages[0]
  // The stage shown first is pinned in the address, so a score entered meanwhile does not move Back to another stage.
  const pinned = stage?.code
  useEffect(() => {
    if (pinned && !focus.stage && !focus.match && !focus.key) ws.keep({ stage: pinned })
  }, [pinned, focus.stage, focus.match, focus.key, ws])

  if (!stage)
    return (
      <Notice tone="warn">
        Chưa có giai đoạn nào. Thiết lập thể thức trước khi tạo lịch.{" "}
        <button type="button" className="underline" onClick={() => ws.go("format")}>
          Mở bước Thể thức
        </button>
      </Notice>
    )

  const leaving = async () =>
    !unsaved ||
    (await confirmDiscard({
      title: "Bỏ kết quả chưa lưu?",
      description: "Các tỷ số và link vừa nhập chưa được ghi.",
    }))
  const open = async (code: string) => {
    if (await leaving()) ws.keep({ stage: code, key: undefined, match: undefined, view: undefined })
  }
  const own = facts.filter((row) => row.match.stageCode === stage.code)
  const withTeam = own.filter(
    ({ match, row }) => !teamId || [row?.teamAId ?? match.a.teamId, row?.teamBId ?? match.b.teamId].includes(teamId),
  )
  const shown = withTeam.filter((row) => matchPasses(row, filter))
  const matches = own.map((row) => row.match)
  const teamIds = plan.entrants
    .filter((entry) => entry.status !== "WITHDRAWN")
    .map((entry) => entry.teamId)
    .filter((id) => !stage.teamIds?.length || stage.teamIds.includes(id))
  const setFilter = (next: MatchFilter) => ws.keep({ stage: stage.code, show: next === "ALL" ? undefined : next })
  const setMode = (next: Mode) =>
    void leaving().then((ok) => ok && ws.keep({ open: next === "view" ? undefined : next, key: undefined }))
  const showSetup = ws.canEdit && (setup || !matches.length)
  const waiting = own.filter((row) => matchPasses(row, "NOT_OPEN")).length
  const league = isLeagueStage(stage)
  const loose = !league && matches.length > 2 && !layoutBracket(matches).linked
  const focusMode = focus.open === "result" ? "result" : undefined
  const props = {
    ws,
    stage,
    matches,
    shown: shown.map((row) => row.match),
    narrowed: filter !== "ALL" || !!teamId,
    focus: focused?.key,
    focusMode,
    teamIds,
  } as const

  const stageTabs = (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto rounded-xl border bg-card p-1 [&::-webkit-scrollbar]:hidden",
        compact ? "w-full" : "max-w-full",
      )}
      role="tablist"
      aria-label="Giai đoạn"
    >
      {plan.stages.map((entry) => {
        const progress = stageProgress(entry.code, plan, ws.resolved)
        const active = entry.code === stage.code
        const left = facts.filter((row) => row.match.stageCode === entry.code && matchPasses(row, filter)).length
        return (
          <button
            key={entry.code}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => void open(entry.code)}
            className={cn(
              "type-body flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 whitespace-nowrap transition-colors",
              compact && "min-h-10 flex-1 justify-center",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isLeagueStage(entry) ? (
              <ListOrdered className="size-4" aria-hidden />
            ) : (
              <GitBranch className="size-4" aria-hidden />
            )}
            {entry.name}
            {filter === "ALL" ? (
              <Chip tone={progress.total && progress.scored === progress.total ? "ok" : "warn"}>
                {progress.scored}/{progress.total}
              </Chip>
            ) : (
              <Chip tone={left ? "warn" : "neutral"}>{left}</Chip>
            )}
          </button>
        )
      })}
    </div>
  )
  const setupButton = ws.canEdit && (
    <Button
      type="button"
      variant={showSetup ? "secondary" : "ghost"}
      size={compact ? "icon" : "default"}
      aria-label={compact ? "Thiết lập lịch" : undefined}
      title="Thiết lập lịch"
      onClick={() => setSetup(!showSetup)}
    >
      <Settings2 aria-hidden /> {!compact && "Thiết lập lịch"}
    </Button>
  )
  const working = ws.canEdit && matches.length > 0
  const teamFilter = (
    <TeamFilter ws={ws} teamIds={teamIds} teamId={teamId} onTeam={(id) => ws.keep({ team: id || undefined })} />
  )
  const needFilter = (
    <NeedFilter
      filter={filter}
      counts={filterCounts(withTeam)}
      scroll={compact}
      onFilter={(next) => void leaving().then((ok) => ok && setFilter(next))}
    />
  )

  return (
    <div className="space-y-4">
      {compact ? (
        // A phone gets the stage, then one row for whose matches and what to do, then what is left: the matches
        // start within the first screen.
        <div className="space-y-2.5">
          {stageTabs}
          <div className="flex justify-end empty:hidden">
            <CheckMark ws={ws} part={`SCHEDULE:${stage.code}`} />
          </div>
          {matches.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">{teamFilter}</div>
              {working && (
                <NativeSelect
                  aria-label="Cách làm việc với lịch"
                  className="w-36"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as Mode)}
                >
                  {MODES.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {setupButton}
            </div>
          )}
          {matches.length > 0 && needFilter}
          {!matches.length && <div className="flex justify-end">{setupButton}</div>}
        </div>
      ) : (
        <>
          {/* The stage and the way of working on the first line, what is listed and the setup on the second. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {stageTabs}
            {working && <Segmented label="Cách làm việc với lịch" value={mode} options={MODES} onChange={setMode} />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {matches.length > 0 && (
              <>
                <div className="w-48">{teamFilter}</div>
                <div className="min-w-0 flex-1">{needFilter}</div>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              <CheckMark ws={ws} part={`SCHEDULE:${stage.code}`} />
              {setupButton}
            </div>
          </div>
        </>
      )}
      {outside && (
        <Panel title={seriesLabel(outside.content) || "Trận ngoài lịch"} meta="Không có trong lịch của giải">
          <div className="p-4">
            <MatchPeople ws={ws} record={outside} />
          </div>
        </Panel>
      )}
      {showSetup && <ScheduleSetup key={stage.code} ws={ws} stage={stage} />}
      {loose && !showSetup && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-(--aov-info-soft) px-3.5 py-2.5">
          <span className="type-body">Các trận của {stage.name} chưa nối thành nhánh.</span>
          <LinkBracket ws={ws} stage={stage} />
        </div>
      )}
      {mode === "results" ? (
        <QuickResults
          key={`${stage.code}-${filter}`}
          ws={ws}
          rows={[...shown].sort(byTime)}
          waiting={waiting}
          onDirtyChange={setUnsaved}
        />
      ) : mode === "times" ? (
        <QuickTimes key={stage.code} ws={ws} stage={stage} shown={shown.map((row) => row.match)} />
      ) : league ? (
        <LeagueMatches key={stage.code} {...props} />
      ) : (
        <BracketMatches key={stage.code} {...props} />
      )}
    </div>
  )
}

/** Every planned match with its series, its recorded games and what readers see of it. */
export function scheduleFacts(
  ws: Pick<Workspace, "plan" | "resolved" | "series" | "games" | "published">,
): MatchFacts[] {
  const series = new Map(ws.series.map((row) => [row.id, row]))
  const games = new Map<string, NonNullable<Workspace["games"]>>()
  for (const game of ws.games ?? []) {
    const list = games.get(game.content.seriesId)
    if (list) list.push(game)
    else games.set(game.content.seriesId, [game])
  }
  return ws.plan.matches.map((match) => ({
    match,
    row: ws.resolved.get(match.key),
    series: match.seriesId ? series.get(match.seriesId) : undefined,
    games: (match.seriesId && games.get(match.seriesId)) || [],
    gamesKnown: !!ws.games,
    published: ws.published ? (ws.published.resolved.find((row) => row.key === match.key) ?? null) : undefined,
  }))
}
