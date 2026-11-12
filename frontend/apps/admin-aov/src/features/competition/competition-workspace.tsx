import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react"
import { useParams, useSearchParams, useBlocker } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CalendarDays,
  Check,
  CircleAlert,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  RotateCcw,
  Save,
  Send,
  Trophy,
  Users,
} from "lucide-react"
import type { CompetitionPlan, CompetitionView, DocumentView, TeamContent } from "@aov/community-contracts"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Button } from "@aov/ui/components/button"
import { cn } from "@aov/ui/lib/utils"
import { communityRequest } from "@/app/auth/session"
import { confirmAction, confirmDiscard } from "@/components/confirm-dialog"
import { pageApi, pageKeys, publicSite } from "@/features/community/page-api"
import { StatusPill, TierBadge } from "@/features/esports/components/primitives"
import { useRosters, useTournamentGames, useTournamentSeries } from "@/features/esports/data/use-esports-data"
import { AccessGate, Crumbs, EsportsPage, LoadError, type Access } from "@/features/esports/pages/esports-shell"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/tournament-api"
import { tournamentDates } from "@/features/tournaments/tournament-metadata"
import { competitionApi, competitionKeys } from "./competition-api"
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
import { Chip, teamViewOf, type Workspace as WorkspaceApi, type WorkspaceAction } from "./workspace/parts"
import { PublishStep } from "./workspace/publish-step"
import { ScheduleStep } from "./workspace/schedule-step"
import { TeamsStep } from "./workspace/teams-step"

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
    queryKey: [...competitionKeys, access.actorKey, tournamentId],
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
  const go = useCallback((value: WorkspaceStep) => setParams({ step: value }), [setParams])
  const stepNavigation = useRef<HTMLElement>(null)
  useEffect(() => {
    const navigation = stepNavigation.current
    const active = navigation?.querySelector<HTMLElement>("[aria-current='step']")
    if (!navigation || !active) return
    const left = active.getBoundingClientRect().left - navigation.getBoundingClientRect().left
    if (left < 0 || left + active.offsetWidth > navigation.clientWidth)
      navigation.scrollTo({ left: navigation.scrollLeft + left - 8, behavior: "smooth" })
  }, [step])

  const [plan, setPlan] = useState(entry.content.plan)
  const [baseline, setBaseline] = useState(entry.content.plan)
  const [draftVersion, setDraftVersion] = useState(entry.version)
  const dirty = JSON.stringify(plan) !== JSON.stringify(baseline)
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState(false)
  const [pickedTeams, setPickedTeams] = useState<Record<string, TeamContent>>({})

  const series = useTournamentSeries(entry.id)
  const rosters = useRosters(entry.id)
  const games = useTournamentGames(entry.id)
  const tournament = useQuery({
    queryKey: [...tournamentKeys.all, "tournaments", access.actorKey, "one", entry.id],
    queryFn: ({ signal }) => tournamentApi.read("tournaments", entry.id, signal),
  })
  const organization = useQuery({
    queryKey: [...pageKeys, access.actorKey, plan.organizerPageId],
    queryFn: () => pageApi.read(plan.organizerPageId!),
    enabled: !!plan.organizerPageId,
  })
  // What readers see now; compared with the draft to list what a new publication would change.
  const published = useQuery({
    queryKey: [...competitionKeys, "published", entry.id, entry.publishedAt],
    queryFn: () => communityRequest<CompetitionView>(`/competitions/${entry.id}`),
    enabled: !!entry.publishedAt,
  })

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) {
      setPlan(entry.content.plan)
      setBaseline(entry.content.plan)
    }
    // A match result saved from the schedule bumps the plan's version on the server even while the plan has edits.
    setDraftVersion(entry.version)
  }, [entry.content.plan, entry.version])
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
      setPlan(value.content.plan)
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
      client.setQueryData([...competitionKeys, access.actorKey, entry.id], value)
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
    },
  })
  const change = useCallback(<K extends keyof CompetitionPlan>(key: K, value: CompetitionPlan[K]) => {
    setPlan((old) => ({ ...old, [key]: value }))
    setNotice("")
  }, [])

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
    dirty,
    busy: mutate.isPending,
    canEdit: access.canWrite && !mutate.isPending,
    resolved,
    teams,
    team: (id) => teamViewOf(id ?? "", id ? teams[id] : undefined),
    rememberTeam: (id, name) => setPickedTeams((value) => ({ ...value, [id]: { code: "", name } })),
    series: series.data ?? [],
    rosters: rosters.data ?? [],
    games: games.data,
    go,
    run: (action) => mutate.mutate(action),
  }

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
    if (confirmed) setPlan(baseline)
  }

  const stepState: Record<WorkspaceStep, { detail: string; tone: "ok" | "todo" | "neutral" }> = {
    overview: {
      detail: plan.organizerPageId ? "Đã liên kết tổ chức" : "Chọn tổ chức",
      tone: check("source")?.state === "ok" && check("organizer")?.state === "ok" ? "ok" : "todo",
    },
    teams: {
      detail: check("rosters")?.detail + " có đội hình",
      tone: check("rosters")?.state === "ok" ? "ok" : "todo",
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

  return (
    <EsportsPage>
      <Crumbs items={[{ label: "Giải đấu", to: "/tournaments" }, { label: info.name }]} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-14 rounded-lg border bg-background">
            <AvatarImage src={info.logoUrl || undefined} alt="" className="object-contain" />
            <AvatarFallback className="rounded-lg">
              <Trophy className="size-6" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="type-page-title">{info.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Chip tone={entry.publishedAt ? "ok" : "warn"}>{entry.publishedAt ? "Đã công bố" : "Bản nháp"}</Chip>
              <StatusPill status={info.status} />
              <TierBadge tier={info.tier} compact />
              {tournamentDates(info) && <Chip>{tournamentDates(info)}</Chip>}
              <Chip>{plan.entrants.length} đội</Chip>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-meta" role="status">
            {mutate.isPending ? "Đang ghi…" : dirty ? "Có thay đổi chưa lưu" : notice || "Bản nháp đã lưu"}
          </span>
          {entry.publishedAt && (
            <a
              className="type-body inline-flex items-center gap-1.5 underline"
              href={`${publicSite}/competitions/${entry.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Xem trang <ExternalLink size={14} aria-hidden />
            </a>
          )}
          {access.canWrite && dirty && (
            <Button type="button" variant="ghost" disabled={mutate.isPending} onClick={() => void discard()}>
              <RotateCcw aria-hidden /> Bỏ thay đổi
            </Button>
          )}
          {access.canWrite && (
            <Button
              type="button"
              variant={entry.publishedAt && !dirty ? "outline" : "default"}
              disabled={mutate.isPending || !dirty}
              onClick={() => mutate.mutate("save")}
            >
              <Save aria-hidden /> Lưu bản nháp
            </Button>
          )}
          {access.canPublish && entry.publishedAt && (pending.length > 0 || dirty) && (
            <Button type="button" disabled={mutate.isPending || blocked} onClick={() => void publish()}>
              <Send aria-hidden /> Cập nhật bản công bố{pending.length ? ` · ${pending.length}` : ""}
            </Button>
          )}
        </div>
      </header>
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
                <span
                  className={cn("type-body block font-semibold whitespace-nowrap", !active && "text-muted-foreground")}
                >
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
      {blocker.state === "blocked" && (
        <div role="alertdialog" aria-label="Thay đổi chưa lưu" className="rounded-xl border bg-card p-5">
          <p className="mb-3">Bạn đang có thay đổi chưa lưu.</p>
          <Button variant="outline" onClick={() => blocker.reset()}>
            Ở lại chỉnh sửa
          </Button>{" "}
          <Button variant="destructive" onClick={() => blocker.proceed()}>
            Rời trang, bỏ thay đổi
          </Button>
        </div>
      )}
      <div className="min-w-0">
        {step === "overview" && (
          <OverviewStep ws={ws} checks={checks} totals={totals} onEditTournament={() => setEditing(true)} />
        )}
        {step === "teams" && <TeamsStep ws={ws} />}
        {step === "format" && <FormatStep ws={ws} />}
        {step === "schedule" && <ScheduleStep ws={ws} />}
        {step === "final" && <FinalStep ws={ws} tournament={tournament.data} />}
        {step === "publish" && (
          <PublishStep
            ws={ws}
            checks={checks}
            pending={pending}
            totals={totals}
            onPublish={() => void publish()}
            onWithdraw={() => void withdraw()}
          />
        )}
      </div>
      {editing && tournament.data && (
        <RegistryEditor
          open
          kind="tournaments"
          entry={tournament.data}
          teams={Object.entries(teams).map(([id, content]) => documentOf(id, content))}
          onClose={() => setEditing(false)}
        />
      )}
    </EsportsPage>
  )
}

/** The tournament editor only lists team names, so the snapshot's teams stand in for full records. */
const documentOf = (id: string, content: TeamContent): DocumentView<TeamContent> => ({
  id,
  version: 0,
  createdAt: "",
  updatedAt: "",
  content,
  missingFields: [],
})
