import { useMemo, useState } from "react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { nextPageOf } from "@aov/ui/lib/page-slice"
import { competitionApi, competitionKeys } from "@/features/competition/competition-api"
import { useNavigate, useSearchParams } from "react-router"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { RegistryImportSheet } from "@/features/tournaments/registry-import"
import { useRecords, useTournamentStats } from "../data/use-esports-data"
import type { TournamentStats as ContractStats } from "@aov/community-contracts"
import { TournamentList } from "@/features/tournaments/tournament-list"
import { regionsNamedBy } from "@/features/tournaments/record-reason"
import { partsByMainEvent } from "@/features/tournaments/tournament-parts"
import { tournamentApi, tournamentKeys, type TournamentSort } from "@/features/tournaments/tournament-api"
import { useDebounced } from "@/features/community/directory/directory-api"
import {
  ManagementEmpty,
  ManagementFooter,
  ManagementLoading,
  ManagementPanel,
  ManagementToolbar,
  managementSelectClassName,
} from "@/features/tournaments/management-list"
import { STATUS_LABELS, TIER_LABELS, regionName } from "../model/labels"
import { AccessGate, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"

type StatusFilter = "all" | NonNullable<TournamentContent["status"]>
type TournamentStats = Omit<ContractStats, "tournamentId">

const STATUS_FILTERS: StatusFilter[] = ["all", "ONGOING", "UPCOMING", "FINISHED", "ANNOUNCED", "UNKNOWN"]
const SORTS: Record<TournamentSort, string> = {
  RECENT: "Gần đây trước",
  STATUS: "Ưu tiên trạng thái",
  NAME: "Tên A–Z",
}

export function TournamentHubPage() {
  return <AccessGate>{(access) => <Hub access={access} />}</AccessGate>
}

function Hub({ access }: { access: Access }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [order, setOrder] = useState<TournamentSort>("RECENT")
  const status = (STATUS_FILTERS.find((value) => value === params.get("status")) ?? "all") as StatusFilter
  const tier = params.get("tier") ?? ""
  const region = params.get("region") ?? ""
  const year = params.get("year") ?? ""
  const settled = useDebounced(search)
  const tournaments = useInfiniteQuery({
    queryKey: [...tournamentKeys.all, "hub", access.actorKey, settled, status, tier, region, year, order],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      tournamentApi.searchTournaments(
        {
          q: settled,
          status: status === "all" ? "" : status,
          tier,
          region,
          year,
          alsoRegions: regionsNamedBy(settled),
          sort: order,
          // Qualifiers, wildcards and other parts come with their main event instead of as rows of their own.
          level: "MAIN",
          page: pageParam,
        },
        signal,
      ),
    getNextPageParam: nextPageOf,
    // Keeps the toolbar and the rows on screen while a new search is on its way.
    placeholderData: keepPreviousData,
  })
  const facets = useQuery({
    queryKey: [...tournamentKeys.all, "hub-facets", access.actorKey],
    queryFn: ({ signal }) => tournamentApi.tournamentFacets(signal, "MAIN"),
    staleTime: 30_000,
  })
  const parts = useQuery({
    queryKey: [...tournamentKeys.all, "parts", access.actorKey, "every"],
    queryFn: ({ signal }) => tournamentApi.tournamentParts(undefined, signal),
    staleTime: 30_000,
  })
  const partsByEvent = useMemo(() => partsByMainEvent(parts.data ?? []), [parts.data])
  const counters = useTournamentStats()
  // Only the create form needs the team list; it is too long to load for every visit to this page.
  const teams = useRecords("teams", creating)
  const plans = useQuery({
    queryKey: [...competitionKeys, access.actorKey, "summaries"],
    queryFn: competitionApi.summaries,
  })

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

  const visible = useMemo(() => tournaments.data?.pages.flatMap((page) => page.items) ?? [], [tournaments.data])
  const matching = tournaments.data?.pages[0]?.totalElements ?? 0
  const filtered = !!search.trim() || status !== "all" || !!tier || !!region || !!year
  const regions = facets.data?.regions ?? []
  const years = (facets.data?.years ?? []).map(String)
  const resetFilters = () => {
    setSearch("")
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete("status")
      next.delete("tier")
      next.delete("region")
      next.delete("year")
      return next
    })
  }
  const setFilter = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value && value !== "all") next.set(key, value)
      else next.delete(key)
      return next
    })
  const open = (entry: DocumentView<TournamentContent>) => navigate(tournamentPath(entry.id))
  const error = (tournaments.isLoadingError ? tournaments.error : null) ?? counters.error

  return (
    <EsportsPage>
      <PageHeader
        title="Giải đấu"
        actions={
          <>
            {access.canWrite && (
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" /> Tạo giải đấu
              </Button>
            )}
            <PageActionsMenu label="Giải đấu: nhập dữ liệu và thùng rác">
              {access.canWrite && (
                <DropdownMenuItem onSelect={() => setImporting(true)}>
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

      <FilterTabs label="Trạng thái giải đấu">
        {STATUS_FILTERS.map((value) => (
          <FilterTab
            key={value}
            active={status === value}
            count={facets.data && (value === "all" ? facets.data.total : (facets.data.statuses[value] ?? 0))}
            onClick={() => setFilter("status", value)}
          >
            {value === "all" ? "Tất cả" : STATUS_LABELS[value]}
          </FilterTab>
        ))}
      </FilterTabs>

      {error ? (
        <LoadError error={error} onRetry={() => void Promise.all([tournaments.refetch(), counters.refetch()])} />
      ) : tournaments.isPending ? (
        <ManagementLoading />
      ) : (
        <ManagementPanel>
          <ManagementToolbar
            search={search}
            onSearchChange={setSearch}
            searchLabel="Tìm giải đấu"
            placeholder="Tên giải đấu, mã hoặc khu vực…"
            onReset={filtered ? resetFilters : undefined}
          >
            <select
              aria-label="Hạng giải"
              value={tier}
              onChange={(event) => setFilter("tier", event.target.value)}
              className={managementSelectClassName}
            >
              <option value="">Tất cả hạng giải</option>
              {Object.entries(TIER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Khu vực giải đấu"
              value={region}
              onChange={(event) => setFilter("region", event.target.value)}
              className={managementSelectClassName}
            >
              <option value="">Mọi khu vực</option>
              {regions.map((value) => (
                <option key={value} value={value}>
                  {regionName(value)}
                </option>
              ))}
            </select>
            <select
              aria-label="Năm giải đấu"
              value={year}
              onChange={(event) => setFilter("year", event.target.value)}
              className={managementSelectClassName}
            >
              <option value="">Mọi năm</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Sắp xếp giải đấu"
              value={order}
              onChange={(event) => setOrder(event.target.value as TournamentSort)}
              className={managementSelectClassName}
            >
              {Object.entries(SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </ManagementToolbar>
          {visible.length ? (
            <TournamentList
              entries={visible}
              stats={stats}
              onOpen={open}
              parts={partsByEvent}
              search={settled}
              partHref={tournamentPath}
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
            rows={visible}
            loader={tournaments}
          />
        </ManagementPanel>
      )}

      {creating && (
        <RegistryEditor kind="tournaments" open onClose={() => setCreating(false)} teams={teams.data ?? []} />
      )}
      {importing && <RegistryImportSheet key={access.actorKey} onClose={() => setImporting(false)} />}
    </EsportsPage>
  )
}
