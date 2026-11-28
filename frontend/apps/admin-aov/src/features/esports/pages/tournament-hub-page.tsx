import { useMemo, useState, type ReactNode } from "react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useRevealedRows } from "@aov/ui/hooks/use-revealed-rows"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { competitionApi, competitionKeys } from "@/features/competition/competition-api"
import { useNavigate, useSearchParams } from "react-router"
import type { DocumentView, TournamentContent, TournamentStats as ContractStats } from "@aov/community-contracts"
import { Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { CreateTournamentSheet } from "@/features/tournaments/components/create-tournament-sheet"
import { RegistryEditor } from "@/features/tournaments/components/registry-editor"
import { RegistryImportSheet } from "@/features/tournaments/components/registry-import"
import { useTournamentStats } from "../data/use-esports-data"
import { TournamentList } from "@/features/tournaments/components/tournament-list"
import { TournamentBulkBar } from "@/features/tournaments/components/tournament-bulk-bar"
import { TournamentShelf } from "@/features/tournaments/components/tournament-shelf"
import {
  TOURNAMENT_LAYOUTS,
  TournamentToolbar,
  type TournamentLayout,
} from "@/features/tournaments/components/tournament-toolbar"
import type { TournamentRowActions } from "@/features/tournaments/components/tournament-row-menu"
import { useRecordLifecycle } from "@/features/tournaments/components/use-record-lifecycle"
import { useRowSelection } from "@/features/tournaments/components/use-row-selection"
import { useTournamentChanges } from "@/features/tournaments/components/use-tournament-changes"
import { useUrlSearch } from "@/features/tournaments/components/use-url-search"
import { regionsNamedBy } from "@/features/tournaments/model/record-reason"
import {
  activeTournaments,
  circuitGroups,
  contradictedTournaments,
  foldGroups,
  type CircuitRef,
} from "@/features/tournaments/model/tournament-groups"
import { partDefaults, partsByMainEvent } from "@/features/tournaments/model/tournament-parts"
import { tournamentApi, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import {
  ManagementEmpty,
  ManagementFooter,
  ManagementLoading,
  ManagementPanel,
} from "@/features/tournaments/components/management-list"
import { STATUS_LABELS } from "../model/labels"
import { AccessGate, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"

type TournamentStats = Omit<ContractStats, "tournamentId">
type Entry = DocumentView<TournamentContent>
/** The sheet open over the list. */
type Dialog = { type: "create"; source?: Entry; partOf?: Entry } | { type: "edit"; entry: Entry } | { type: "import" }

/** Grouping needs every season at once; the registry holds a few hundred main events, and this is the largest page. */
const WHOLE_LIST = 500
/** Circuits drawn before the reader scrolls for more. */
const CIRCUITS = 8

export function TournamentHubPage() {
  return <AccessGate>{(access) => <Hub access={access} />}</AccessGate>
}

function Hub({ access }: { access: Access }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { search, setSearch, settled } = useUrlSearch()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set())
  const wanted = params.get("status") ?? ""
  const status = wanted in STATUS_LABELS ? wanted : ""
  const tier = params.get("tier") ?? ""
  const region = params.get("region") ?? ""
  const year = params.get("year") ?? ""
  const layout =
    (Object.keys(TOURNAMENT_LAYOUTS) as TournamentLayout[]).find((value) => value === params.get("sort")) ?? "CIRCUIT"
  const grouped = layout === "CIRCUIT"
  const narrowed = {
    q: settled,
    status,
    tier,
    region,
    year,
    alsoRegions: regionsNamedBy(settled),
    // Qualifiers, wildcards and other parts come with their main event instead of as rows of their own.
    level: "MAIN" as const,
  }
  const tournaments = useInfiniteQuery({
    queryKey: tournamentKeys.hub(access.actorKey, settled, { status, tier, region, year }, layout),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      tournamentApi.searchTournaments(
        {
          ...narrowed,
          sort: grouped ? "RECENT" : layout,
          page: pageParam,
          ...(grouped && { size: WHOLE_LIST }),
        },
        signal,
      ),
    getNextPageParam: nextPageOf,
    // Keeps the toolbar and the rows on screen while a new search is on its way.
    placeholderData: keepPreviousData,
  })
  const facets = useQuery({
    queryKey: tournamentKeys.hubFacets(access.actorKey, settled, { status, tier, region, year }),
    queryFn: ({ signal }) => tournamentApi.tournamentFacets(narrowed, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
  const parts = useQuery({
    queryKey: tournamentKeys.parts(access.actorKey, "every"),
    queryFn: ({ signal }) => tournamentApi.tournamentParts(undefined, signal),
    staleTime: 30_000,
  })
  const partsByEvent = useMemo(() => partsByMainEvent(parts.data ?? []), [parts.data])
  const counters = useTournamentStats()
  const plans = useQuery({
    queryKey: competitionKeys.summaries(access.actorKey),
    queryFn: competitionApi.summaries,
  })
  // How far the owner's own checks of each tournament go; only Admin shows them.
  const verifications = useQuery({
    queryKey: competitionKeys.verificationSummaries(access.actorKey),
    queryFn: competitionApi.verificationSummaries,
    staleTime: 30_000,
  })
  const checked = useMemo(
    () => verifications.data && new Map(verifications.data.map((row) => [row.tournamentId, row])),
    [verifications.data],
  )

  const stats = useMemo(() => {
    const result = new Map<string, TournamentStats>()
    for (const row of counters.data ?? [])
      result.set(row.tournamentId, { teams: row.teams, matches: row.matches, played: row.played })
    for (const plan of plans.data || []) {
      const previous = result.get(plan.id)
      result.set(plan.id, { teams: plan.entrants, matches: plan.matches, played: previous?.played || 0 })
    }
    return result
  }, [counters.data, plans.data])

  const published = useMemo(
    () => plans.data && new Set(plans.data.filter((plan) => plan.publishedAt).map((plan) => plan.id)),
    [plans.data],
  )

  const circuits = useMemo(() => {
    const result = new Map<string, CircuitRef>()
    for (const { id, circuit, circuitPageId } of plans.data ?? [])
      if (circuit) result.set(id, { id: circuitPageId || circuit, name: circuit })
    return result
  }, [plans.data])

  const loaded = useMemo(() => tournaments.data?.pages.flatMap((page) => page.items) ?? [], [tournaments.data])
  const matching = tournaments.data?.pages[0]?.totalElements ?? 0
  const filtered = !!search.trim() || !!status || !!tier || !!region || !!year
  const scope = [settled, status, tier, region, year, layout].join("|")
  const groups = useMemo(
    () => (grouped ? foldGroups(circuitGroups(loaded, circuits), (key) => filtered || openGroups.has(key)) : []),
    [grouped, loaded, circuits, filtered, openGroups],
  )
  const revealed = useRevealedRows(groups, scope, CIRCUITS)
  const visible = grouped ? revealed.rows.flatMap((group) => group.entries) : loaded
  const toggleGroup = (key: string) =>
    setOpenGroups((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const resetFilters = () => {
    setSearch("")
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of ["q", "status", "tier", "region", "year"]) next.delete(key)
      return next
    })
  }
  const setFilter = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  const selection = useRowSelection(
    visible.map((entry) => entry.id),
    scope,
  )
  const selected = visible.filter((entry) => selection.ids.has(entry.id))
  const changes = useTournamentChanges({ parts: partsByEvent, onSettled: selection.settle })
  const lifecycle = useRecordLifecycle("tournaments", { onChanged: () => {} })
  const actions: TournamentRowActions | undefined = access.canWrite
    ? {
        duplicate: (source) => setDialog({ type: "create", source }),
        addPart: (partOf) => setDialog({ type: "create", partOf }),
        edit: (entry) => setDialog({ type: "edit", entry }),
        changeStatus: (entry, next) => void changes.changeStatus([entry], next),
        trash: (entry) => void lifecycle.remove(entry, entry.content.name),
      }
    : undefined
  const error = (tournaments.isLoadingError ? tournaments.error : null) ?? counters.error

  return (
    <EsportsPage>
      <PageHeader
        title="Giải đấu"
        actions={
          <>
            {access.canWrite && (
              <Button onClick={() => setDialog({ type: "create" })}>
                <Plus aria-hidden="true" /> Tạo giải đấu
              </Button>
            )}
            <PageActionsMenu label="Giải đấu: nhập dữ liệu và thùng rác">
              {access.canWrite && (
                <DropdownMenuItem onSelect={() => setDialog({ type: "import" })}>
                  <Upload />
                  Nhập dữ liệu
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => navigate("/tournaments/trash")}>
                <Trash2 />
                Thùng rác
              </DropdownMenuItem>
            </PageActionsMenu>
          </>
        }
      />

      {grouped && !filtered && (
        <TournamentShelf
          entries={[...activeTournaments(loaded), ...contradictedTournaments(loaded)]}
          stats={counters.isSuccess && !plans.isPending ? stats : undefined}
          href={tournamentPath}
        />
      )}

      {error ? (
        <LoadError error={error} onRetry={() => void Promise.all([tournaments.refetch(), counters.refetch()])} />
      ) : tournaments.isPending || (grouped && plans.isPending) ? (
        <ManagementLoading />
      ) : (
        <ManagementPanel>
          <TournamentToolbar
            search={search}
            onSearchChange={setSearch}
            values={{ status, tier, region, year, sort: layout }}
            facets={facets.data}
            onFilter={(key, value) => setFilter(key, key === "sort" && value === "CIRCUIT" ? "" : value)}
            onReset={filtered ? resetFilters : undefined}
          />
          {lifecycle.failure && <div className="border-b p-3">{lifecycle.failure}</div>}
          {visible.length ? (
            <TournamentList
              entries={visible}
              groups={grouped ? revealed.rows : undefined}
              onToggleGroup={filtered ? undefined : toggleGroup}
              stats={counters.isSuccess && !plans.isPending ? stats : undefined}
              parts={partsByEvent}
              published={published}
              checked={checked}
              actions={actions}
              selection={access.canWrite ? selection : undefined}
              search={settled}
              href={tournamentPath}
            />
          ) : (
            <ManagementEmpty
              title={filtered ? "Không tìm thấy giải đấu" : "Chưa có giải đấu"}
              description={
                filtered
                  ? "Thử tên khác hoặc xóa bộ lọc để xem toàn bộ giải đấu."
                  : "Tạo giải đấu để bắt đầu quản lý lịch thi đấu và kết quả."
              }
              onReset={filtered ? resetFilters : undefined}
            />
          )}
          <ManagementFooter
            count={matching}
            total={facets.data?.total ?? matching}
            noun="giải đấu"
            rows={grouped ? loaded : visible}
            loader={grouped && revealed.loader.hasNextPage ? revealed.loader : tournaments}
          />
        </ManagementPanel>
      )}

      {access.canWrite && (
        <TournamentBulkBar selected={selected} changes={changes} onClear={() => selection.select([])} />
      )}
      <HubDialog dialog={dialog} actorKey={access.actorKey} onClose={() => setDialog(null)} />
    </EsportsPage>
  )
}

function HubDialog({
  dialog,
  actorKey,
  onClose,
}: {
  dialog: Dialog | null
  actorKey: string
  onClose: () => void
}): ReactNode {
  if (dialog?.type === "create")
    return (
      <CreateTournamentSheet
        source={dialog.source}
        defaults={dialog.partOf && partDefaults(dialog.partOf.id, dialog.partOf.content)}
        onClose={onClose}
      />
    )
  if (dialog?.type === "edit") return <RegistryEditor kind="tournaments" entry={dialog.entry} open onClose={onClose} />
  if (dialog?.type === "import") return <RegistryImportSheet key={actorKey} onClose={onClose} />
  return null
}
