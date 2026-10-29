import { useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { BarChart3, CalendarClock, GitBranch, LayoutGrid, ListOrdered, Pencil, Plus, Swords, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { TeamRosterSheet } from "@/features/tournaments/team-roster-sheet"
import { useGameCatalog, useGames, useRecords, useRosters } from "../data/use-esports-data"
import { useTournamentView } from "../data/use-tournament-view"
import { BracketView } from "../components/bracket-view"
import { HeroStatistics } from "../components/hero-stats"
import { MatchRow } from "../components/match-row"
import { RelativeDate } from "../components/relative-date"
import { MATCH_STATE_LABELS, MatchRecordingStrip } from "../components/match-recording-strip"
import { ParticipantsGrid, type TeamEntry } from "../components/participants-grid"
import { EmptyState, SectionTitle } from "../components/primitives"
import { StandingsTable } from "../components/standings-table"
import { TournamentBanner, TournamentInfobox } from "../components/tournament-cards"
import { buildBracket, computeStandings, seriesTime, type SeriesRecord } from "../model/competition"
import { referenceIndex, type TeamView } from "../model/game-view"
import { PHASE_LABELS, formatDate, stageInfo, type StagePhase } from "../model/labels"
import { gameStatistics } from "../model/statistics"
import { matchRecording, type MatchRecording, type MatchRecordingState } from "../model/match-recording"
import { AccessGate, Crumbs, EsportsPage, LoadError, matchPath, type Access } from "./esports-shell"

const TABS = [
  { id: "overview", label: "Tổng quan", icon: LayoutGrid },
  { id: "matches", label: "Lịch thi đấu", icon: CalendarClock },
  { id: "standings", label: "Bảng xếp hạng", icon: ListOrdered },
  { id: "bracket", label: "Nhánh đấu", icon: GitBranch },
  { id: "teams", label: "Đội tham dự", icon: Users },
  { id: "stats", label: "Thống kê", icon: BarChart3 },
] as const
type TabId = (typeof TABS)[number]["id"]

export function TournamentPage() {
  return <AccessGate>{(access) => <TournamentView access={access} />}</AccessGate>
}

function TournamentView({ access }: { access: Access }) {
  const { tournamentId = "" } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((entry) => entry.id === params.get("tab"))?.id ?? "overview") as TabId
  const view = useTournamentView(tournamentId)
  const [editor, setEditor] = useState<"tournament" | "series" | null>(null)
  const [rosterTeam, setRosterTeam] = useState<string | null>(null)
  const openMatch = (seriesId: string) => navigate(matchPath(tournamentId, seriesId))
  // Editors see what each match still needs; opening a gap lands on that game in recording mode.
  const games = useGames(undefined, access.canWrite)
  const recordings = useMemo(() => {
    const bySeries = new Map<string, NonNullable<typeof games.data>>()
    for (const entry of games.data ?? [])
      bySeries.set(entry.content.seriesId, [...(bySeries.get(entry.content.seriesId) ?? []), entry])
    return new Map(
      view.records.map((record) => [record.id, matchRecording(record.content, bySeries.get(record.id) ?? [])]),
    )
  }, [games.data, view.records])
  const openRecording = (seriesId: string, gameId?: string) =>
    navigate(`${matchPath(tournamentId, seriesId)}?edit=1${gameId ? `&game=${gameId}` : ""}`)
  const setTab = (next: TabId) =>
    setParams(
      (current) => {
        const result = new URLSearchParams(current)
        if (next === "overview") result.delete("tab")
        else result.set("tab", next)
        return result
      },
      { replace: true },
    )

  if (view.error)
    return (
      <EsportsPage>
        <LoadError error={view.error} onRetry={() => void view.refetch()} />
      </EsportsPage>
    )
  if (view.pending)
    return (
      <EsportsPage>
        <div className="h-56 animate-pulse rounded-2xl bg-muted" />
      </EsportsPage>
    )
  if (!view.tournament)
    return (
      <EsportsPage>
        <EmptyState icon={<Swords size={28} />} title="Không tìm thấy giải đấu">
          <Link to="/tournaments" className="underline">
            Về danh sách giải
          </Link>
        </EmptyState>
      </EsportsPage>
    )

  const { tournament, records, team } = view
  const played = records.filter((record) => record.content.result).length
  const phases = new Set(records.map((record) => stageInfo(record.content.stage).phase))
  const visibleTabs = TABS.filter(
    (entry) =>
      (entry.id !== "standings" || phases.has("GROUP")) &&
      (entry.id !== "bracket" || phases.has("UPPER") || phases.has("LOWER") || phases.has("FINAL")),
  )

  return (
    <EsportsPage>
      <Crumbs items={[{ label: "Giải đấu", to: "/tournaments" }, { label: tournament.content.name }]} />
      <TournamentBanner
        content={tournament.content}
        stats={{ teams: view.teamIds.length, matches: records.length, played }}
        actions={
          access.canWrite && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditor("tournament")}>
                <Pencil size={14} /> Sửa giải
              </Button>
              <Button size="sm" onClick={() => setEditor("series")} disabled={view.teams.length < 2}>
                <Plus size={14} /> Thêm trận
              </Button>
            </>
          )
        }
      />
      <nav
        className="esp-tabs sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b bg-background/90 px-4 backdrop-blur md:-mx-6 md:px-6"
        aria-label="Mục của giải"
      >
        {visibleTabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={tab === entry.id ? "page" : undefined}
            onClick={() => setTab(entry.id)}
            className={cn(
              "-mb-px flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition",
              tab === entry.id
                ? "border-[var(--esp-gold)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <entry.icon size={15} /> {entry.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <Overview
          tournament={tournament}
          records={records}
          team={team}
          teamCount={view.teamIds.length}
          onOpen={openMatch}
          onTab={setTab}
        />
      )}
      {tab === "matches" && (
        <MatchesTab
          records={records}
          team={team}
          onOpen={openMatch}
          recordingOf={access.canWrite && games.data ? (seriesId) => recordings.get(seriesId) : undefined}
          onOpenRecording={openRecording}
        />
      )}
      {tab === "standings" && (
        <section className="space-y-3">
          <StandingsTable rows={computeStandings(records)} team={team} />
          <p className="text-xs text-muted-foreground">
            Tạm tính từ kết quả trận vòng bảng: 1 điểm mỗi trận thắng, xếp tiếp theo hiệu số ván. Chưa áp dụng luật đối
            đầu. Hàng tô xanh là đội có mặt ở vòng loại trực tiếp.
          </p>
        </section>
      )}
      {tab === "bracket" && <BracketView bracket={buildBracket(records)} team={team} onOpen={openMatch} />}
      {tab === "teams" && (
        <TeamsTab
          tournamentId={tournamentId}
          teamIds={view.teamIds}
          team={team}
          canWrite={access.canWrite}
          onRoster={setRosterTeam}
        />
      )}
      {tab === "stats" && <StatsTab records={records} />}

      {editor && (
        <RegistryEditor
          kind={editor === "tournament" ? "tournaments" : "series"}
          entry={editor === "tournament" ? (tournament as DocumentView<TournamentContent>) : undefined}
          open
          onClose={() => setEditor(null)}
          teams={view.teams}
          tournaments={[tournament]}
          tournamentId={tournamentId}
        />
      )}
      {rosterTeam && (
        <RosterSheet tournament={tournament} teamId={rosterTeam} access={access} onClose={() => setRosterTeam(null)} />
      )}
    </EsportsPage>
  )
}

function Overview({
  tournament,
  records,
  team,
  teamCount,
  onOpen,
  onTab,
}: {
  tournament: DocumentView<TournamentContent>
  records: SeriesRecord[]
  team: (id: string) => TeamView
  teamCount: number
  onOpen: (seriesId: string) => void
  onTab: (tab: TabId) => void
}) {
  const upcoming = records.filter((record) => !record.content.result).slice(0, 4)
  const recent = records
    .filter((record) => record.content.result)
    .sort((a, b) => seriesTime(b.content) - seriesTime(a.content))
    .slice(0, 5)
  const standings = computeStandings(records)
  return (
    <div className="grid gap-6 @5xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-3">
          <SectionTitle
            action={
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onTab("matches")}
              >
                Xem toàn bộ lịch
              </button>
            }
          >
            Trận sắp tới
          </SectionTitle>
          {upcoming.length ? (
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {upcoming.map((record) => (
                <MatchRow key={record.id} record={record} team={team} onOpen={() => onOpen(record.id)} showStage />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Không còn trận chưa có kết quả.</p>
          )}
        </section>
        {!!recent.length && (
          <section className="space-y-3">
            <SectionTitle>Kết quả gần đây</SectionTitle>
            <div className="divide-y overflow-hidden rounded-xl border bg-card">
              {recent.map((record) => (
                <MatchRow key={record.id} record={record} team={team} onOpen={() => onOpen(record.id)} showStage />
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="space-y-6">
        <TournamentInfobox content={tournament.content} teams={teamCount} />
        {!!standings.length && (
          <section className="space-y-3">
            <SectionTitle
              action={
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onTab("standings")}
                >
                  Chi tiết
                </button>
              }
            >
              Bảng xếp hạng
            </SectionTitle>
            <StandingsTable rows={standings} team={team} compact />
          </section>
        )}
      </div>
    </div>
  )
}

function MatchesTab({
  records,
  team,
  onOpen,
  recordingOf,
  onOpenRecording,
}: {
  records: SeriesRecord[]
  team: (id: string) => TeamView
  onOpen: (seriesId: string) => void
  /** Recording status per match, for editors. */
  recordingOf?: (seriesId: string) => MatchRecording | undefined
  onOpenRecording: (seriesId: string, gameId?: string) => void
}) {
  const [phase, setPhase] = useState<StagePhase | "all">("all")
  const [teamId, setTeamId] = useState("")
  const [pendingOnly, setPendingOnly] = useState(false)
  const [recordingState, setRecordingState] = useState<MatchRecordingState | "all">("all")
  const phases = [...new Set(records.map((record) => stageInfo(record.content.stage).phase))]
  const teamIds = [...new Set(records.flatMap((record) => [record.content.teamAId, record.content.teamBId]))]
  const filtered = records.filter(
    (record) =>
      (phase === "all" || stageInfo(record.content.stage).phase === phase) &&
      (!teamId || record.content.teamAId === teamId || record.content.teamBId === teamId) &&
      (!pendingOnly || !record.content.result),
  )
  const counts = new Map<MatchRecordingState, number>()
  for (const record of filtered) {
    const state = recordingOf?.(record.id)?.state
    if (state) counts.set(state, (counts.get(state) ?? 0) + 1)
  }
  const visible = filtered.filter(
    (record) => recordingState === "all" || recordingOf?.(record.id)?.state === recordingState,
  )
  const groups = new Map<string, Map<string, SeriesRecord[]>>()
  for (const record of visible) {
    const stage = stageInfo(record.content.stage).label
    const day = formatDate(record.content.scheduledAt) || "Chưa xếp lịch"
    const byDay = groups.get(stage) ?? new Map<string, SeriesRecord[]>()
    byDay.set(day, [...(byDay.get(day) ?? []), record])
    groups.set(stage, byDay)
  }
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...phases] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={phase === value}
            onClick={() => setPhase(value)}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium",
              phase === value ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {value === "all" ? "Tất cả" : PHASE_LABELS[value]}
          </button>
        ))}
        <select
          aria-label="Lọc theo đội"
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
          className="h-7 rounded-full border bg-background px-3 text-xs"
        >
          <option value="">Mọi đội</option>
          {teamIds.map((id) => (
            <option key={id} value={id}>
              {team(id).name}
            </option>
          ))}
        </select>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />
          Chỉ trận chưa có kết quả
        </label>
      </div>
      {recordingOf && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo tình trạng ghi">
          <span className="text-xs font-medium text-muted-foreground">Tình trạng ghi</span>
          {(["all", "missing", "unconfirmed", "complete", "upcoming"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={recordingState === value}
              onClick={() => setRecordingState(value)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs font-medium",
                recordingState === value ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                value === "missing" &&
                  recordingState !== value &&
                  counts.get("missing") &&
                  "border-destructive/40 text-destructive",
              )}
            >
              {value === "all" ? "Tất cả" : MATCH_STATE_LABELS[value]}
              {value !== "all" && <span className="esp-num ml-1 opacity-70">{counts.get(value) ?? 0}</span>}
            </button>
          ))}
        </div>
      )}
      {visible.length ? (
        [...groups.entries()].map(([stage, byDay]) => (
          <div key={stage} className="space-y-2">
            <h3 className="text-sm font-semibold">{stage}</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              {[...byDay.entries()].map(([day, entries]) => (
                <div key={day}>
                  <p className="border-b bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <RelativeDate value={entries[0]?.content.scheduledAt} dayOnly fallback={day} />
                  </p>
                  <div className="divide-y">
                    {entries.map((record) => {
                      const recording = recordingOf?.(record.id)
                      return (
                        <div key={record.id}>
                          <MatchRow record={record} team={team} onOpen={() => onOpen(record.id)} />
                          {recording && (
                            <MatchRecordingStrip
                              recording={recording}
                              onOpen={(gameId) => onOpenRecording(record.id, gameId)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <EmptyState icon={<CalendarClock size={26} />} title="Không có trận phù hợp" />
      )}
    </section>
  )
}

function TeamsTab({
  tournamentId,
  teamIds,
  team,
  canWrite,
  onRoster,
}: {
  tournamentId: string
  teamIds: string[]
  team: (id: string) => TeamView
  canWrite: boolean
  onRoster: (teamId: string) => void
}) {
  const rosters = useRosters(tournamentId)
  const players = useRecords("players")
  const entries = useMemo<TeamEntry[]>(() => {
    const ids = new Set([...teamIds, ...(rosters.data ?? []).map((entry) => entry.content.teamId)])
    const playerIndex = new Map((players.data ?? []).map((entry) => [entry.id, entry.content]))
    return [...ids]
      .map((id) => ({
        team: team(id),
        members: (rosters.data ?? [])
          .filter((entry) => entry.content.teamId === id)
          .map((entry) => ({
            id: entry.id,
            name: playerIndex.get(entry.content.playerId)?.nickname ?? "Chưa rõ",
            photoUrl: playerIndex.get(entry.content.playerId)?.photoUrl,
            lane: entry.content.lane,
            status: entry.content.status,
          })),
      }))
      .sort((a, b) => a.team.name.localeCompare(b.team.name))
  }, [players.data, rosters.data, team, teamIds])
  if (rosters.isPending || players.isPending) return <div className="h-48 animate-pulse rounded-xl bg-muted" />
  if (!entries.length) return <EmptyState icon={<Users size={26} />} title="Chưa có đội tham dự" />
  return (
    <ParticipantsGrid
      entries={entries}
      teamAction={
        canWrite
          ? (view) => (
              <Button size="sm" variant="ghost" onClick={() => onRoster(view.id)}>
                Đội hình
              </Button>
            )
          : undefined
      }
    />
  )
}

function StatsTab({ records }: { records: SeriesRecord[] }) {
  const games = useGames()
  const seriesIds = new Set(records.map((record) => record.id))
  const contents = (games.data ?? [])
    .filter((entry) => seriesIds.has(entry.content.seriesId))
    .map((entry) => entry.content)
  const catalog = useGameCatalog(contents[0])
  const lookup = referenceIndex(catalog.data?.heroes)
  if (games.isPending) return <div className="h-48 animate-pulse rounded-xl bg-muted" />
  if (!contents.length)
    return (
      <EmptyState icon={<BarChart3 size={26} />} title="Chưa có ván nào được ghi">
        Thống kê tướng (chọn, cấm, tỉ lệ thắng theo bên) xuất hiện khi các ván có dữ liệu cấm/chọn.
      </EmptyState>
    )
  return (
    <HeroStatistics
      stats={gameStatistics(contents)}
      icon={(key, name) => lookup({ id: key.startsWith("name:") ? null : key, name }) ?? { name }}
    />
  )
}

function RosterSheet({
  tournament,
  teamId,
  access,
  onClose,
}: {
  tournament: DocumentView<TournamentContent>
  teamId: string
  access: Access
  onClose: () => void
}) {
  const teams = useRecords("teams")
  const players = useRecords("players")
  const entry = teams.data?.find((candidate) => candidate.id === teamId)
  if (!entry) return null
  return (
    <TeamRosterSheet
      team={entry}
      tournaments={[tournament]}
      players={players.data ?? []}
      initialTournamentId={tournament.id}
      canWrite={access.canWrite}
      actorKey={access.actorKey}
      onClose={onClose}
    />
  )
}
