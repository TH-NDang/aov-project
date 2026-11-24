import { useState } from "react"
import { GitBranch, ListOrdered, Settings2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { confirmDiscard } from "@/components/confirm-dialog"
import { seriesLabel } from "@/features/esports/model/series-label"
import { filterCounts, matchFilterOf, matchPasses, type MatchFacts, type MatchFilter } from "../model/schedule-model"
import { QuickResults } from "../schedule/quick-results"
import { QuickTimes } from "../schedule/quick-times"
import { LinkBracket, ScheduleSetup } from "../schedule/schedule-setup"
import { ScheduleToolbar, Segmented } from "../schedule/schedule-toolbar"
import { BracketMatches, LeagueMatches } from "../schedule/stage-matches"
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
 * open: `match` a series, `key` a planned match, `stage` a stage, `show` a list of matches with work left.
 */
export function ScheduleStep({ ws }: { ws: Workspace }) {
  const { plan, focus } = ws
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
  const [picked, setPicked] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(focus.open === "results" || focus.open === "times" ? focus.open : "view")
  const [teamId, setTeamId] = useState(focus.team ?? "")
  const [setup, setSetup] = useState(false)
  const [unsaved, setUnsaved] = useState(false)
  const stageCode =
    picked ??
    focused?.stageCode ??
    focus.stage ??
    (filter !== "ALL" ? wanted?.match.stageCode : undefined) ??
    firstOpen?.code ??
    plan.stages.at(-1)?.code
  const stage = plan.stages.find((entry) => entry.code === stageCode) ?? plan.stages[0]

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
    if (await leaving()) setPicked(code)
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
  const setFilter = (next: MatchFilter) =>
    ws.go("schedule", { stage: stage.code, show: next === "ALL" ? undefined : next })
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-card p-1"
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
        <div className="flex flex-wrap items-center gap-2">
          {ws.canEdit && matches.length > 0 && (
            <Segmented
              label="Cách làm việc với lịch"
              value={mode}
              options={MODES}
              onChange={(next) => void leaving().then((ok) => ok && setMode(next))}
            />
          )}
          {ws.canEdit && (
            <Button type="button" variant={showSetup ? "secondary" : "ghost"} onClick={() => setSetup(!showSetup)}>
              <Settings2 aria-hidden /> Thiết lập lịch
            </Button>
          )}
        </div>
      </div>
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
      {matches.length > 0 && (
        <ScheduleToolbar
          ws={ws}
          teamIds={teamIds}
          teamId={teamId}
          filter={filter}
          counts={filterCounts(withTeam)}
          onTeam={setTeamId}
          onFilter={(next) => void leaving().then((ok) => ok && setFilter(next))}
        />
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
        <LeagueMatches key={`${stage.code}-${focused?.key ?? ""}`} {...props} />
      ) : (
        <BracketMatches key={`${stage.code}-${focused?.key ?? ""}`} {...props} />
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
