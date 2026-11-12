import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { useMutation } from "@tanstack/react-query"
import type { CompetitionStage, DocumentView, GameContent, PlannedMatch } from "@aov/community-contracts"
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  ListOrdered,
  Pencil,
  PlayCircle,
  Plus,
  Settings2,
  Trophy,
} from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { LocalTime } from "@aov/ui/components/local-time"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction } from "@/components/confirm-dialog"
import { MatchRecordingStrip } from "@/features/esports/components/match-recording-strip"
import { TeamLogo } from "@/features/esports/components/primitives"
import { matchRecording } from "@/features/esports/model/match-recording"
import { youtubeVideoId } from "@/features/esports/model/vod"
import { matchPath } from "@/features/esports/pages/esports-shell"
import { competitionApi } from "../competition-api"
import { MatchPanel } from "./match-panel"
import {
  dayKey,
  defaultGroupMode,
  groupMatches,
  hasScore,
  isLeagueStage,
  restingTeams,
  seedsFromStandings,
  slotText,
  stageProgress,
  type GroupMode,
  type MatchGroup,
} from "./model"
import { Chip, Notice, Panel, type Workspace } from "./parts"
import { PlanBracket } from "./plan-bracket"
import { selectClass } from "./plan-fields"

const ROW = "grid-cols-[88px_minmax(0,1fr)_72px_minmax(0,1fr)_minmax(0,auto)_20px]"

export function ScheduleStep({ ws }: { ws: Workspace }) {
  const { plan } = ws
  const firstOpen = plan.stages.find((stage) => {
    const progress = stageProgress(stage.code, plan, ws.resolved)
    return progress.scored < progress.total
  })
  const [stageCode, setStageCode] = useState(firstOpen?.code ?? plan.stages.at(-1)?.code ?? "")
  const stage = plan.stages.find((entry) => entry.code === stageCode) ?? plan.stages[0]
  const [setup, setSetup] = useState(false)

  if (!stage)
    return (
      <Notice tone="warn">
        Chưa có giai đoạn nào. Thiết lập thể thức trước khi tạo lịch.{" "}
        <button type="button" className="underline" onClick={() => ws.go("format")}>
          Mở bước Thể thức
        </button>
      </Notice>
    )

  const matches = plan.matches.filter((match) => match.stageCode === stage.code)
  const showSetup = setup || !matches.length
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-1" role="tablist" aria-label="Giai đoạn">
          {plan.stages.map((entry) => {
            const progress = stageProgress(entry.code, plan, ws.resolved)
            const active = entry.code === stage.code
            return (
              <button
                key={entry.code}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStageCode(entry.code)}
                className={cn(
                  "type-body flex min-h-9 items-center gap-2 rounded-md px-3 font-semibold transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isLeagueStage(entry) ? (
                  <ListOrdered className="size-4" aria-hidden />
                ) : (
                  <GitBranch className="size-4" aria-hidden />
                )}
                {entry.name}
                <Chip tone={progress.total && progress.scored === progress.total ? "ok" : "warn"}>
                  {progress.scored}/{progress.total}
                </Chip>
              </button>
            )
          })}
        </div>
        {ws.canEdit && (
          <Button type="button" variant={showSetup ? "secondary" : "ghost"} onClick={() => setSetup(!showSetup)}>
            <Settings2 aria-hidden /> Thiết lập lịch
          </Button>
        )}
      </div>
      {showSetup && ws.canEdit && <ScheduleSetup ws={ws} stage={stage} />}
      {isLeagueStage(stage) ? (
        <LeagueStage key={stage.code} ws={ws} stage={stage} matches={matches} />
      ) : (
        <BracketStage key={stage.code} ws={ws} stage={stage} matches={matches} />
      )}
    </div>
  )
}

function useGamesBySeries(games?: DocumentView<GameContent>[]) {
  return useMemo(() => {
    const index = new Map<string, DocumentView<GameContent>[]>()
    for (const entry of games ?? [])
      index.set(entry.content.seriesId, [...(index.get(entry.content.seriesId) ?? []), entry])
    return index
  }, [games])
}

function LeagueStage({ ws, stage, matches }: { ws: Workspace; stage: CompetitionStage; matches: PlannedMatch[] }) {
  const [mode, setMode] = useState<GroupMode>(() => defaultGroupMode(matches))
  const [teamId, setTeamId] = useState("")
  const shown = matches.filter((match) => {
    if (!teamId) return true
    const row = ws.resolved.get(match.key)
    return [row?.teamAId ?? match.a.teamId, row?.teamBId ?? match.b.teamId].includes(teamId)
  })
  const groups = groupMatches(shown, mode, ws.plan.timezone, ws.resolved)
  const teamIds = ws.plan.entrants.filter((entry) => entry.status !== "WITHDRAWN").map((entry) => entry.teamId)
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Lọc theo đội"
            className={cn(selectClass, "h-9 w-auto min-w-44")}
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">Tất cả đội</option>
            {teamIds.map((id) => (
              <option key={id} value={id}>
                {ws.team(id).name}
              </option>
            ))}
          </select>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Cách gom trận">
            {(
              [
                ["round", "Theo vòng"],
                ["day", "Theo ngày"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "type-label h-8 rounded px-3",
                  mode === value ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="type-meta ml-auto">{shown.length} trận</span>
        </div>
        <MatchGroups ws={ws} groups={groups} mode={mode} restFrom={teamId ? undefined : teamIds} />
        {!matches.length && <p className="type-meta">Giai đoạn này chưa có trận. Dùng "Thiết lập lịch" để tạo.</p>}
      </div>
      <StandingsPanel ws={ws} stage={stage} />
    </div>
  )
}

function BracketStage({ ws, stage, matches }: { ws: Workspace; stage: CompetitionStage; matches: PlannedMatch[] }) {
  const [view, setView] = useState<"bracket" | "list">("bracket")
  const [selected, setSelected] = useState<string | null>(
    () => matches.find((match) => !hasScore(ws.resolved.get(match.key)))?.key ?? null,
  )
  const chosen = matches.find((match) => match.key === selected)
  const usesSeeds = matches.some((match) => match.a.type === "SEED" || match.b.type === "SEED")
  return (
    <div className="space-y-4">
      {usesSeeds && <SeedStrip ws={ws} matches={matches} />}
      <Panel
        title={stage.name}
        icon={Trophy}
        meta={`BO${stage.bestOf} · ${matches.length} trận`}
        action={
          <div className="flex rounded-md border p-0.5" role="group" aria-label="Cách xem">
            {(
              [
                ["bracket", "Sơ đồ nhánh"],
                ["list", "Danh sách"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "type-label h-8 rounded px-3",
                  view === value ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {view === "bracket" ? (
          <div className="p-4">
            {matches.length ? (
              <PlanBracket ws={ws} matches={matches} selected={selected} onSelect={setSelected} />
            ) : (
              <p className="type-meta">Giai đoạn này chưa có trận. Dùng "Thiết lập lịch" để tạo nhánh đấu.</p>
            )}
          </div>
        ) : (
          <div className="p-3">
            <MatchGroups ws={ws} groups={groupMatches(matches, "round", ws.plan.timezone, ws.resolved)} mode="round" />
          </div>
        )}
      </Panel>
      {view === "bracket" && chosen && (
        <Panel
          title={chosen.label || chosen.key}
          meta={`${sideName(ws, chosen, "a")} gặp ${sideName(ws, chosen, "b")} · BO${chosen.bestOf}`}
          action={<ScoreChip ws={ws} match={chosen} />}
          className="border-primary/60"
          label="Trận đang chọn"
        >
          <MatchDetail ws={ws} match={chosen} />
        </Panel>
      )}
    </div>
  )
}

function sideName(ws: Workspace, match: PlannedMatch, which: "a" | "b") {
  const row = ws.resolved.get(match.key)
  const id = which === "a" ? row?.teamAId : row?.teamBId
  return id ? ws.team(id).name : slotText(match[which], ws.plan, ws.teams)
}

function ScoreChip({ ws, match }: { ws: Workspace; match: PlannedMatch }) {
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
function MatchDetail({ ws, match }: { ws: Workspace; match: PlannedMatch }) {
  const navigate = useNavigate()
  const gamesBySeries = useGamesBySeries(ws.games)
  const record = ws.series.find((row) => row.id === match.seriesId)
  return (
    <>
      {record && ws.games && (
        <MatchRecordingStrip
          recording={matchRecording(record.content, gamesBySeries.get(record.id) ?? [])}
          onOpen={(gameId) => navigate(`${matchPath(ws.entry.id, record.id)}?edit=1${gameId ? `&game=${gameId}` : ""}`)}
        />
      )}
      <MatchPanel ws={ws} match={match} />
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
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`))
}

const shortDay = (value: number, timeZone: string) =>
  new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone }).format(new Date(value))

function MatchGroups({
  ws,
  groups,
  mode,
  restFrom,
}: {
  ws: Workspace
  groups: MatchGroup[]
  mode: GroupMode
  /** Teams of the stage, to name who sits a round out; left out when the list is filtered. */
  restFrom?: string[]
}) {
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const [openMatch, setOpenMatch] = useState<string | null>(null)
  const today = dayKey(Date.now(), ws.plan.timezone)
  return (
    <div className="space-y-3">
      {groups.map((group, index) => {
        const open = toggled[group.key] ?? index < 2
        const complete = group.scored === group.matches.length
        const span = Number.isFinite(group.firstAt)
          ? shortDay(group.firstAt, ws.plan.timezone) +
            (Number.isFinite(group.lastAt) &&
            dayKey(group.lastAt, ws.plan.timezone) !== dayKey(group.firstAt, ws.plan.timezone)
              ? `–${shortDay(group.lastAt, ws.plan.timezone)}`
              : "")
          : ""
        const resting =
          mode === "round" && restFrom
            ? restingTeams(group, restFrom, ws.resolved).map((id) => ws.team(id).shortName)
            : []
        return (
          <section key={group.key} className="admin-panel min-w-0 overflow-hidden">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setToggled((value) => ({ ...value, [group.key]: !open }))}
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
                {open ? (
                  <ChevronDown className="size-4" aria-hidden />
                ) : (
                  <ChevronRight className="size-4" aria-hidden />
                )}
              </span>
            </button>
            {open && (
              <div className="overflow-x-auto border-t">
                <div className="min-w-[680px]">
                  {group.matches.map((match) => (
                    <MatchLine
                      key={match.key}
                      ws={ws}
                      match={match}
                      today={today}
                      open={openMatch === match.key}
                      onToggle={() => setOpenMatch(openMatch === match.key ? null : match.key)}
                    />
                  ))}
                </div>
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
  onToggle,
}: {
  ws: Workspace
  match: PlannedMatch
  today: string
  open: boolean
  onToggle: () => void
}) {
  const row = ws.resolved.get(match.key)
  const scored = hasScore(row)
  const record = ws.series.find((entry) => entry.id === match.seriesId)
  const live = ws.published ? ws.published.resolved.find((entry) => entry.key === match.key) : undefined
  const unpublished = !!ws.published && (row?.scoreA ?? null) !== (live?.scoreA ?? null)
  const isToday = !!match.scheduledAt && dayKey(match.scheduledAt, ws.plan.timezone) === today
  const games = ws.games?.filter((entry) => entry.content.seriesId === match.seriesId).length
  const side = (which: "a" | "b") => {
    const id = which === "a" ? row?.teamAId : row?.teamBId
    const won = scored && (which === "a" ? row!.scoreA! > row!.scoreB! : row!.scoreB! > row!.scoreA!)
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-2.5",
          which === "a" && "flex-row-reverse text-right",
          scored && !won && "text-muted-foreground",
        )}
      >
        {id ? <TeamLogo team={ws.team(id)} size={28} /> : <span className="size-7 shrink-0 rounded-md bg-muted" />}
        <span className={cn("type-body truncate", won && "font-semibold", !id && "text-muted-foreground")}>
          {id ? ws.team(id).name : slotText(match[which], ws.plan, ws.teams)}
        </span>
      </span>
    )
  }
  return (
    <div className={cn("border-b last:border-b-0", open && "bg-muted/40")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn("grid min-h-12 w-full items-center gap-3 px-4 py-1.5 text-left hover:bg-muted/60", ROW)}
      >
        <span className="type-meta">
          <LocalTime
            value={match.scheduledAt}
            sourceTimeZone={ws.plan.timezone}
            format={{ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }}
            fallback="Chưa có giờ"
          />
        </span>
        {side("a")}
        <span
          className={cn(
            "type-body inline-flex h-7 items-center justify-center rounded-md border px-2 font-bold tabular-nums",
            scored ? "bg-muted" : "border-dashed font-semibold text-primary",
            open && "border-primary",
          )}
        >
          {scored ? `${row!.scoreA} : ${row!.scoreB}` : "VS"}
        </span>
        {side("b")}
        <span className="flex items-center justify-end gap-1.5">
          {isToday && <Chip tone="info">Hôm nay</Chip>}
          {unpublished && <Chip tone="warn">Chưa công bố</Chip>}
          {games != null && games > 0 && <Chip>{games} ván</Chip>}
          {youtubeVideoId(record?.content.sourceUrl) && (
            <PlayCircle className="size-4 text-muted-foreground" role="img" aria-label="Có video" />
          )}
        </span>
        {open ? (
          <ChevronDown className="size-4 text-primary" aria-hidden />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open && <MatchDetail ws={ws} match={match} />}
    </div>
  )
}

function StandingsPanel({ ws, stage }: { ws: Workspace; stage: CompetitionStage }) {
  const table = ws.entry.content.standings.find((entry) => entry.stageCode === stage.code)
  const progress = stageProgress(stage.code, ws.plan, ws.resolved)
  if (!table) return null
  const tiedAtCut = stage.advance > 0 && table.rows[stage.advance - 1]?.tied && table.rows[stage.advance]?.tied
  return (
    <Panel
      title="Bảng xếp hạng"
      icon={ListOrdered}
      className="xl:sticky xl:top-24"
      action={
        <Chip tone={table.complete ? "ok" : "warn"}>
          {table.complete ? `Đủ ${progress.total} trận` : `Tạm tính · ${progress.scored}/${progress.total}`}
        </Chip>
      }
    >
      <table className="w-full">
        <thead>
          <tr className="type-label border-b text-muted-foreground">
            <th className="w-9 py-2 pl-4 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Đội</th>
            <th className="px-2 py-2 text-right font-semibold" title="Thắng – thua (trận)">
              T–B
            </th>
            <th className="px-2 py-2 text-right font-semibold" title="Thắng – thua (ván)">
              Ván
            </th>
            <th className="py-2 pr-4 text-right font-semibold" title="Hiệu số ván">
              HS
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => {
            const cut = stage.advance > 0 && index === stage.advance - 1
            const out = stage.advance > 0 && index >= stage.advance
            const diff = row.gameWins - row.gameLosses
            return (
              <tr
                key={row.teamId}
                className={cn(
                  "type-body border-b last:border-b-0",
                  cut && "border-b-2 border-b-primary",
                  out && "text-muted-foreground",
                )}
              >
                <td className="py-1.5 pl-4 tabular-nums">
                  {row.rank}
                  {row.tied ? "=" : ""}
                </td>
                <td className="w-full max-w-0 py-1.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TeamLogo team={ws.team(row.teamId)} size={24} />
                    <span className={cn("truncate", !out && "font-semibold")}>{ws.team(row.teamId).name}</span>
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {row.won}–{row.lost}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {row.gameWins}–{row.gameLosses}
                </td>
                <td className="py-1.5 pr-4 text-right whitespace-nowrap tabular-nums">
                  {diff > 0 ? `+${diff}` : diff}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {stage.advance > 0 && (
        <p className="type-meta border-t px-4 py-2.5">
          {stage.advance} đội trên vạch đi tiếp{table.complete ? "" : " (tạm tính, chưa xác nhận suất)"}.
          {tiedAtCut && " Có đội bằng hạng ngay tại vạch: kiểm tra tiêu chí phụ ở bước Thể thức."}
        </p>
      )}
    </Panel>
  )
}

function SeedStrip({ ws, matches }: { ws: Workspace; matches: PlannedMatch[] }) {
  const [editing, setEditing] = useState(false)
  const count = Math.max(
    0,
    ...matches.flatMap((match) => [match.a, match.b].map((slot) => (slot.type === "SEED" ? (slot.seed ?? 0) : 0))),
  )
  const seeds = Array.from({ length: count }, (_, index) => index + 1)
  const table = [...ws.entry.content.standings].reverse().find((entry) => entry.rows.length >= count)
  const fill = async () => {
    if (!table) return
    const next = seedsFromStandings(table.rows, count)
    const describe = (values: Record<number, string>) =>
      seeds.map((seed) => (values[seed] ? ws.team(values[seed]).shortName : "–")).join(", ")
    if (Object.keys(ws.plan.playoffSeeds).length && describe(ws.plan.playoffSeeds) !== describe(next)) {
      const confirmed = await confirmAction({
        title: "Thay hạt giống hiện tại?",
        description: `${describe(ws.plan.playoffSeeds)} → ${describe(next)}. Nhánh đấu trong bản nháp đổi theo khi bạn lưu.`,
        confirmLabel: "Thay hạt giống",
      })
      if (!confirmed) return
    }
    ws.change("playoffSeeds", next)
  }
  return (
    <Panel label="Hạt giống">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-label mr-1 text-muted-foreground">Hạt giống</span>
          {seeds.map((seed) => {
            const id = ws.plan.playoffSeeds[seed]
            return (
              <Chip key={seed} className="h-8 gap-2">
                <span className="text-primary">{seed}</span>
                {id ? (
                  <>
                    <TeamLogo team={ws.team(id)} size={20} />
                    <span className="text-foreground">{ws.team(id).shortName}</span>
                  </>
                ) : (
                  "Chưa xác định"
                )}
              </Chip>
            )
          })}
        </div>
        {ws.canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {table && (
              <Button type="button" variant="ghost" onClick={fill}>
                Lấy từ bảng xếp hạng
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setEditing(!editing)}>
              <Pencil aria-hidden /> {editing ? "Xong" : "Sửa hạt giống"}
            </Button>
          </div>
        )}
      </div>
      {editing && ws.canEdit && (
        <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-3">
          {seeds.map((seed) => (
            <label key={seed} className="grid gap-2">
              <span className="type-label">Hạt giống {seed}</span>
              <select
                className={selectClass}
                value={ws.plan.playoffSeeds[seed] || ""}
                onChange={(event) => {
                  const values = { ...ws.plan.playoffSeeds }
                  if (event.target.value) values[seed] = event.target.value
                  else delete values[seed]
                  ws.change("playoffSeeds", values)
                }}
              >
                <option value="">Chưa xác định</option>
                {ws.plan.entrants
                  .filter((entry) => entry.status !== "WITHDRAWN")
                  .map((entry) => (
                    <option key={entry.teamId} value={entry.teamId}>
                      {ws.team(entry.teamId).name}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </Panel>
  )
}

/** Tools that build the schedule. They sit behind a button because results are entered far more often. */
function ScheduleSetup({ ws, stage }: { ws: Workspace; stage: CompetitionStage }) {
  const [opponent, setOpponent] = useState(3)
  const [preview, setPreview] = useState<PlannedMatch[] | null>(null)
  const generate = useMutation({
    mutationFn: () => competitionApi.preview(ws.plan, stage.code, opponent),
    onSuccess: setPreview,
  })
  const canGenerate = ["ROUND_ROBIN", "DOUBLE_ELIMINATION"].includes(stage.format)
  const linked = ws.plan.matches.some((match) => match.stageCode === stage.code && match.seriesId)
  const waiting = ws.plan.matches.filter((match) => {
    const row = ws.resolved.get(match.key)
    return !match.seriesId && !!row?.teamAId && !!row?.teamBId
  }).length
  return (
    <Panel
      title="Thiết lập lịch"
      icon={Settings2}
      meta="Xem trước lịch rồi mới thêm vào bản nháp. Suất thắng/thua lấy từ kết quả trận trước, không cần tạo đội giả."
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {canGenerate && (
            <Button
              type="button"
              variant="outline"
              disabled={generate.isPending || linked}
              onClick={() => generate.mutate()}
            >
              Tạo lịch {stage.name}
            </Button>
          )}
          {stage.format === "DOUBLE_ELIMINATION" && (
            <label className="grid gap-2">
              <span className="type-label">Đối thủ do hạt giống 1 chọn</span>
              <select
                className={selectClass}
                value={opponent}
                onChange={(event) => setOpponent(Number(event.target.value))}
              >
                <option value={3}>Hạt giống 3</option>
                <option value={4}>Hạt giống 4</option>
              </select>
            </label>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              ws.change("matches", [
                ...ws.plan.matches,
                {
                  key: `M_${crypto.randomUUID().slice(0, 8)}`,
                  stageCode: stage.code,
                  round: 1,
                  label: "Trận bổ sung",
                  bestOf: stage.bestOf,
                  a: { type: "TBD", label: "Đội A" },
                  b: { type: "TBD", label: "Đội B" },
                },
              ])
            }
          >
            <Plus aria-hidden /> Thêm trận thủ công
          </Button>
          <Button type="button" disabled={ws.busy || !waiting} onClick={() => ws.run("materialize")}>
            Mở nhập kết quả cho {waiting} cặp đã xác định
          </Button>
        </div>
        {canGenerate && linked && (
          <p className="type-meta">Giai đoạn đã có trận mở nhập kết quả nên không tạo lại lịch tự động.</p>
        )}
        {generate.error && (
          <p className="type-body text-destructive" role="alert">
            Chưa tạo được lịch xem trước. Kiểm tra số đội và thể thức của giai đoạn.
          </p>
        )}
        {preview && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="type-label">
              Xem trước · {preview.length} trận. Thao tác sẽ thay lịch nháp chưa liên kết của giai đoạn này.
            </p>
            <div className="max-h-64 space-y-1 overflow-auto">
              {preview.map((match) => (
                <p className="type-body" key={match.key}>
                  {match.label} · {slotText(match.a, ws.plan, ws.teams)} – {slotText(match.b, ws.plan, ws.teams)} · BO
                  {match.bestOf}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  ws.change("matches", [
                    ...ws.plan.matches.filter((match) => match.stageCode !== stage.code),
                    ...preview,
                  ])
                  setPreview(null)
                }}
              >
                Dùng lịch này
              </Button>
              <Button type="button" variant="outline" onClick={() => setPreview(null)}>
                Hủy
              </Button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
