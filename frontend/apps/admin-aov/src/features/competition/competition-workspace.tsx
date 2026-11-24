import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ComponentType } from "react"
import { useParams, useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Check, CircleAlert, GitBranch, LayoutDashboard, Send, Trophy, Users } from "lucide-react"
import type { CompetitionView, TeamContent } from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import { confirmAction, confirmDiscard } from "@/components/confirm-dialog"
import { leavingPage, useLeaveGuard } from "@/hooks/use-leave-guard"
import { pageApi, pageKeys } from "@/features/community/api/page-api"
import { useRosters, useTournamentGames, useTournamentSeries } from "@/features/esports/data/use-esports-data"
import {
  AccessGate,
  Crumbs,
  EsportsPage,
  LoadError,
  tournamentPath,
  type Access,
} from "@/features/esports/pages/esports-shell"
import { RegistryEditor } from "@/features/tournaments/components/registry-editor"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { partDefaults, partLabel, type EventFamily } from "@/features/tournaments/model/tournament-parts"
import { competitionApi, competitionKeys } from "./competition-api"
import { EventPartTabs } from "./workspace/event-parts"
import { FinalStep } from "./workspace/final-step"
import { FormatStep } from "./workspace/format-step"
import {
  STEP_LABELS,
  WORKSPACE_STEPS,
  hasScore,
  pendingChanges,
  recordingTotals,
  resolvedIndex,
  stepFromParam,
  workspaceChecks,
  type WorkspaceStep,
} from "./workspace/model"
import { OverviewStep } from "./workspace/overview-step"
import { CopySetupSheet } from "./workspace/copy-setup-sheet"
import { PlanHistorySheet } from "./workspace/plan-history-sheet"
import {
  FOCUS_KEYS,
  teamViewOf,
  type Workspace as WorkspaceApi,
  type WorkspaceAction,
  type WorkspaceFocus,
} from "./workspace/parts"
import { PublishStep } from "./workspace/publish-step"
import { ScheduleStep } from "./workspace/schedule-step"
import { TeamsStep } from "./workspace/teams-step"
import { usePlanDraft } from "./workspace/use-plan-draft"
import { useWorkspaceKeys } from "./workspace/use-workspace-keys"
import { WorkspaceHeader } from "./workspace/workspace-header"
import { draftChanges } from "./model/plan-draft"
import type { CopyPart } from "./model/copy-setup"

const STEP_ICONS: Record<WorkspaceStep, ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  teams: Users,
  format: GitBranch,
  schedule: CalendarDays,
  final: Trophy,
  publish: Send,
}

export function CompetitionWorkspace() {
  return <AccessGate>{(access) => <Loader access={access} />}</AccessGate>
}

function Loader({ access }: { access: Access }) {
  const { tournamentId = "" } = useParams()
  const query = useQuery({
    queryKey: competitionKeys.plan(access.actorKey, tournamentId),
    queryFn: () => competitionApi.read(tournamentId),
  })
  if (query.isError)
    return (
      <EsportsPage>
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      </EsportsPage>
    )
  if (!query.data)
    return (
      <EsportsPage>
        <p>Đang tải không gian giải đấu…</p>
      </EsportsPage>
    )
  return <Workspace entry={query.data} access={access} />
}

function Workspace({ entry, access }: { entry: CompetitionView; access: Access }) {
  const client = useQueryClient()
  const [params, setParams] = useSearchParams()
  const step = stepFromParam(params.get("step"))
  const go = useCallback(
    (value: WorkspaceStep, focus: WorkspaceFocus = {}) =>
      setParams({
        step: value,
        ...Object.fromEntries(FOCUS_KEYS.flatMap((key) => (focus[key] ? [[key, focus[key]]] : []))),
      }),
    [setParams],
  )
  const focus = useMemo(
    () => Object.fromEntries(FOCUS_KEYS.map((key) => [key, params.get(key) ?? undefined])) as WorkspaceFocus,
    [params],
  )
  const stepNavigation = useRef<HTMLElement>(null)
  useEffect(() => {
    const navigation = stepNavigation.current
    const active = navigation?.querySelector<HTMLElement>("[aria-current='step']")
    if (!navigation || !active) return
    const left = active.getBoundingClientRect().left - navigation.getBoundingClientRect().left
    if (left < 0 || left + active.offsetWidth > navigation.clientWidth)
      navigation.scrollTo({ left: navigation.scrollLeft + left - 8, behavior: "smooth" })
  }, [step])

  const draft = usePlanDraft(entry.content.plan)
  const { plan, change, changeAll, reset } = draft
  const [baseline, setBaseline] = useState(entry.content.plan)
  const [draftVersion, setDraftVersion] = useState(entry.version)
  const dirty = JSON.stringify(plan) !== JSON.stringify(baseline)
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState(false)
  const [addingPart, setAddingPart] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [copying, setCopying] = useState<{ parts?: CopyPart[] } | null>(null)
  const [pickedTeams, setPickedTeams] = useState<Record<string, TeamContent>>({})

  const series = useTournamentSeries(entry.id)
  const rosters = useRosters(entry.id)
  const games = useTournamentGames(entry.id)
  const tournament = useQuery({
    queryKey: tournamentKeys.one("tournaments", access.actorKey, entry.id),
    queryFn: ({ signal }) => tournamentApi.read("tournaments", entry.id, signal),
  })
  // A tournament is either a main event or a part of one; both show the same row of tabs.
  const mainEventId = entry.content.tournament.parentTournamentId || entry.id
  const isPart = mainEventId !== entry.id
  const mainEvent = useQuery({
    queryKey: tournamentKeys.one("tournaments", access.actorKey, mainEventId),
    queryFn: ({ signal }) => tournamentApi.read("tournaments", mainEventId, signal),
    enabled: isPart,
  })
  const parts = useQuery({
    queryKey: tournamentKeys.parts(access.actorKey, mainEventId),
    queryFn: ({ signal }) => tournamentApi.tournamentParts(mainEventId, signal),
    staleTime: 30_000,
  })
  const family: EventFamily = useMemo(
    () => ({
      mainEventId,
      mainName: isPart ? mainEvent.data?.content.name : entry.content.tournament.name,
      isPart,
      parts: parts.data ?? [],
    }),
    [mainEventId, isPart, mainEvent.data, entry.content.tournament.name, parts.data],
  )
  const organization = useQuery({
    queryKey: pageKeys.page(access.actorKey, plan.organizerPageId),
    queryFn: () => pageApi.read(plan.organizerPageId!),
    enabled: !!plan.organizerPageId,
  })
  // What readers see now; compared with the draft to list what a new publication would change.
  const published = useQuery({
    queryKey: competitionKeys.published(entry.id, entry.publishedAt),
    queryFn: () => competitionApi.readPublished(entry.id),
    enabled: !!entry.publishedAt,
  })

  useLeaveGuard(leavingPage(dirty), () =>
    confirmDiscard({
      title: "Rời trang?",
      description: "Bạn đang có thay đổi chưa lưu.",
      confirmLabel: "Rời trang, bỏ thay đổi",
    }),
  )
  // Read only when the server copy changes: a save that ends the edits must not take the plan and its version back to
  // the copy loaded before it.
  const hasEdits = useEffectEvent(() => dirty)
  useEffect(() => {
    if (!hasEdits()) {
      reset(entry.content.plan)
      setBaseline(entry.content.plan)
    }
    // A match result saved from the schedule bumps the plan's version on the server even while the plan has edits.
    setDraftVersion(entry.version)
  }, [entry.content.plan, entry.version, reset])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const mutate = useMutation({
    mutationFn: async (action: WorkspaceAction) => {
      let current = { ...entry, version: draftVersion }
      if (dirty || action === "save") current = await competitionApi.save(current, plan)
      return action === "save" ? current : competitionApi.action(current, action)
    },
    onSuccess: async (value, action) => {
      reset(value.content.plan)
      setBaseline(value.content.plan)
      setDraftVersion(value.version)
      setNotice(
        action === "publish"
          ? "Đã công bố."
          : action === "withdraw"
            ? "Đã gỡ khỏi trang công khai."
            : action === "materialize"
              ? "Đã mở nhập kết quả cho các cặp đã xác định."
              : "Đã lưu bản nháp.",
      )
      client.setQueryData(competitionKeys.plan(access.actorKey, entry.id), value)
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
    meta: { silent: true },
  })
  const teams = useMemo(() => ({ ...pickedTeams, ...entry.content.teams }), [pickedTeams, entry.content.teams])
  const resolved = useMemo(() => resolvedIndex(entry.content.resolved), [entry.content.resolved])
  const placements = tournament.data?.content.placements?.length ?? entry.content.tournament.placements?.length ?? 0
  const checks = useMemo(
    () =>
      workspaceChecks({
        plan,
        resolved: entry.content.resolved,
        rosters: (rosters.data ?? []).map((row) => row.content),
        organizerName: organization.data?.content?.name,
        organizerPublished: !!organization.data?.published,
        placements,
        now: Date.now(),
      }),
    [plan, entry.content.resolved, rosters.data, organization.data, placements],
  )
  const pending = useMemo(
    () => (published.data ? pendingChanges(entry.content, published.data.content) : []),
    [entry.content, published.data],
  )
  const totals = useMemo(() => (games.data ? recordingTotals(games.data) : undefined), [games.data])
  const check = (id: string) => checks.find((row) => row.id === id)
  const scored = plan.matches.filter((match) => hasScore(resolved.get(match.key))).length
  const blocked = checks.some((row) => row.required && row.state !== "ok")

  const ws: WorkspaceApi = {
    entry,
    access,
    plan,
    baseline,
    published: published.data?.content ?? null,
    change,
    changeAll,
    dirty,
    busy: mutate.isPending,
    canEdit: access.canWrite && !mutate.isPending,
    resolved,
    teams,
    team: (id) => teamViewOf(id ?? "", id ? teams[id] : undefined),
    rememberTeam: (id, name, content) => setPickedTeams((value) => ({ ...value, [id]: content ?? { code: "", name } })),
    series: series.data ?? [],
    rosters: rosters.data ?? [],
    loaded: series.isSuccess && rosters.isSuccess,
    games: games.data,
    go,
    focus,
    openCopy: (parts) => setCopying({ parts }),
    run: (action) => mutate.mutate(action),
  }
  const changes = useMemo(
    () => (dirty ? draftChanges(baseline, plan, (id) => teams[id]?.name ?? "đội mới") : []),
    [dirty, baseline, plan, teams],
  )

  const publish = async () => {
    if (entry.publishedAt) {
      const lines = [
        ...(dirty ? ["Bản nháp đang sửa sẽ được lưu trước."] : []),
        ...pending.slice(0, 6).map((row) => row.text),
        ...(pending.length > 6 ? [`và ${pending.length - 6} thay đổi khác`] : []),
      ]
      const confirmed = await confirmAction({
        title: "Cập nhật bản công bố?",
        description: lines.length
          ? `Trang công khai sẽ đổi: ${lines.join("; ")}.`
          : "Trang công khai sẽ được chụp lại từ bản nháp hiện tại.",
        confirmLabel: "Cập nhật",
      })
      if (!confirmed) return
    }
    mutate.mutate("publish")
  }
  const withdraw = async () => {
    const confirmed = await confirmAction({
      title: "Gỡ giải khỏi trang công khai?",
      description: "Người xem sẽ không còn thấy giải này cho tới khi bạn công bố lại. Bản nháp được giữ nguyên.",
      confirmLabel: "Gỡ khỏi trang công khai",
    })
    if (confirmed) mutate.mutate("withdraw")
  }
  const discard = async () => {
    const confirmed = await confirmDiscard({
      title: "Bỏ các thay đổi chưa lưu?",
      description: "Bản nháp trở về lần lưu gần nhất. Tỷ số đã lưu không bị ảnh hưởng.",
    })
    if (confirmed) reset(baseline)
  }

  const stepState: Record<WorkspaceStep, { detail: string; tone: "ok" | "todo" | "neutral" }> = {
    overview: {
      detail: plan.organizerPageId ? "Đã liên kết tổ chức" : "Chọn tổ chức",
      tone: check("source")?.state === "ok" && check("organizer")?.state === "ok" ? "ok" : "todo",
    },
    teams: {
      detail: rosters.data ? check("rosters")?.detail + " có đội hình" : `${plan.entrants.length} đội`,
      tone: !rosters.data ? "neutral" : check("rosters")?.state === "ok" ? "ok" : "todo",
    },
    format: { detail: `${plan.stages.length} giai đoạn`, tone: plan.stages.length ? "ok" : "todo" },
    schedule: {
      detail: plan.matches.length ? `${scored}/${plan.matches.length} trận có tỷ số` : "Chưa có lịch",
      tone: plan.matches.length && check("results")?.state === "ok" ? "ok" : "todo",
    },
    final: {
      detail: placements ? `${placements} thứ hạng` : (check("placements")?.detail ?? ""),
      tone: placements ? "ok" : check("placements")?.state === "waiting" ? "neutral" : "todo",
    },
    publish: {
      detail: entry.publishedAt
        ? pending.length
          ? `Đã công bố · ${pending.length} thay đổi mới`
          : "Đã công bố"
        : "Chưa công bố",
      tone: entry.publishedAt ? (pending.length ? "todo" : "ok") : "neutral",
    },
  }
  const info = entry.content.tournament
  useWorkspaceKeys({
    save: () => access.canWrite && dirty && !mutate.isPending && mutate.mutate("save"),
    undo: draft.undo,
    redo: draft.redo,
    step: (index) => WORKSPACE_STEPS[index] && go(WORKSPACE_STEPS[index]),
  })

  return (
    <EsportsPage>
      <Crumbs
        items={
          isPart
            ? [
                { label: "Giải đấu", to: "/tournaments" },
                { label: family.mainName ?? "Giải chính", to: tournamentPath(mainEventId) },
                { label: partLabel(info.name, family.mainName) },
              ]
            : [{ label: "Giải đấu", to: "/tournaments" }, { label: info.name }]
        }
      />
      <WorkspaceHeader
        ws={ws}
        entry={entry}
        notice={notice}
        changes={changes}
        pending={pending.length}
        blocked={blocked}
        canUndo={draft.canUndo}
        canRedo={draft.canRedo}
        actions={{
          save: () => mutate.mutate("save"),
          discard: () => void discard(),
          publish: () => void publish(),
          undo: draft.undo,
          redo: draft.redo,
          openHistory: () => setHistoryOpen(true),
          openCopy: () => setCopying({}),
        }}
      />
      <EventPartTabs family={family} currentId={entry.id} />
      <nav
        ref={stepNavigation}
        className="sticky top-0 z-20 flex overflow-x-auto overflow-y-hidden border-b bg-background/95 backdrop-blur-sm"
        aria-label="Các bước của giải"
      >
        {WORKSPACE_STEPS.map((id, index) => {
          const Icon = STEP_ICONS[id]
          const state = stepState[id]
          const active = step === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={active ? "step" : undefined}
              aria-label={`Bước ${index + 1}: ${STEP_LABELS[id]}. ${state.detail}`}
              title={`Alt+${index + 1}`}
              className={cn(
                "-mb-px flex min-w-44 flex-1 items-start gap-2.5 border-b-2 px-3 pt-2.5 pb-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active ? "border-primary" : "border-transparent hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full",
                  active
                    ? "bg-primary text-primary-foreground"
                    : state.tone === "ok"
                      ? "bg-[var(--aov-success-soft)] text-[var(--aov-success)]"
                      : state.tone === "todo"
                        ? "bg-[var(--aov-warning-soft)] text-[var(--aov-warning)]"
                        : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className={cn("type-body block whitespace-nowrap", !active && "text-muted-foreground")}>
                  {STEP_LABELS[id]}
                </span>
                <span className="type-meta flex items-center gap-1 whitespace-nowrap">
                  {state.tone === "ok" && <Check aria-hidden className="size-3 shrink-0 text-[var(--aov-success)]" />}
                  {state.tone === "todo" && (
                    <CircleAlert aria-hidden className="size-3 shrink-0 text-[var(--aov-warning)]" />
                  )}
                  {state.detail}
                </span>
              </span>
            </button>
          )
        })}
      </nav>
      {mutate.error && <LoadError error={mutate.error} onRetry={() => mutate.reset()} />}
      <div className="min-w-0">
        {step === "overview" && (
          <OverviewStep
            ws={ws}
            record={tournament.data}
            checks={checks}
            totals={totals}
            family={family}
            onEditTournament={() => setEditing(true)}
            onAddPart={() => setAddingPart(true)}
          />
        )}
        {step === "teams" && <TeamsStep key={`${focus.team}-${focus.open}`} ws={ws} tournament={tournament.data} />}
        {step === "format" && <FormatStep key={`${focus.stage}-${focus.open}`} ws={ws} />}
        {step === "schedule" && <ScheduleStep key={`${focus.match}-${focus.key}-${focus.open}`} ws={ws} />}
        {step === "final" && <FinalStep ws={ws} tournament={tournament.data} />}
        {step === "publish" && (
          <PublishStep
            ws={ws}
            checks={checks}
            pending={pending}
            onPublish={() => void publish()}
            onWithdraw={() => void withdraw()}
          />
        )}
      </div>
      {editing && tournament.data && (
        <RegistryEditor open kind="tournaments" entry={tournament.data} onClose={() => setEditing(false)} />
      )}
      {historyOpen && <PlanHistorySheet ws={ws} onRestore={changeAll} onClose={() => setHistoryOpen(false)} />}
      {copying && (
        <CopySetupSheet
          ws={ws}
          record={tournament.data}
          initialParts={copying.parts}
          onPlan={changeAll}
          onClose={() => setCopying(null)}
        />
      )}
      {addingPart && (
        <RegistryEditor
          open
          kind="tournaments"
          defaults={partDefaults(entry.id, info)}
          onClose={() => setAddingPart(false)}
        />
      )}
    </EsportsPage>
  )
}
