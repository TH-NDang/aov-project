import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { competitionApi, competitionKeys } from "@/features/competition/competition-api"
import { useNavigate, useSearchParams } from "react-router"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { Plus, Upload } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem } from "@aov/ui/components/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { FilterTab, FilterTabs } from "@/components/filter-tabs"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { RegistryImportSheet } from "@/features/tournaments/registry-import"
import { useRecords, useTournamentStats } from "../data/use-esports-data"
import type { TournamentStats } from "../components/tournament-cards"
import { TournamentList } from "@/features/tournaments/tournament-list"
import { registrySearchText } from "@/features/tournaments/registry-form-model"
import {
  ManagementEmpty,
  ManagementFooter,
  ManagementLoading,
  ManagementPanel,
  ManagementToolbar,
  managementSelectClassName,
  useManagementRows,
} from "@/features/tournaments/management-list"
import { STATUS_LABELS, TIER_LABELS, regionName } from "../model/labels"
import { AccessGate, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"

type StatusFilter = "all" | NonNullable<TournamentContent["status"]>
const STATUS_FILTERS: StatusFilter[] = ["all", "ONGOING", "UPCOMING", "FINISHED", "ANNOUNCED", "UNKNOWN"]
const STATUS_ORDER: Record<string, number> = { ONGOING: 0, UPCOMING: 1, ANNOUNCED: 2, UNKNOWN: 3, FINISHED: 4 }

export function TournamentHubPage() {
  return <AccessGate>{(access) => <Hub access={access} />}</AccessGate>
}

function Hub({ access }: { access: Access }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [order, setOrder] = useState("status")
  const status = (STATUS_FILTERS.find((value) => value === params.get("status")) ?? "all") as StatusFilter
  const tier = params.get("tier") ?? ""
  const region = params.get("region") ?? ""
  const year = params.get("year") ?? ""
  const tournaments = useRecords("tournaments")
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

  const visible = (tournaments.data ?? [])
    .filter((entry) => status === "all" || (entry.content.status ?? "UNKNOWN") === status)
    .filter((entry) => !tier || (entry.content.tier ?? "UNKNOWN") === tier)
    .filter((entry) => !region || entry.content.region === region)
    .filter((entry) => !year || String(entry.content.year ?? "") === year)
    .filter((entry) =>
      registrySearchText(
        `${entry.content.name} ${entry.content.code} ${entry.content.region} ${regionName(entry.content.region)}`,
      ).includes(registrySearchText(search)),
    )
    .sort((a, b) =>
      order === "name"
        ? a.content.name.localeCompare(b.content.name, "vi")
        : (STATUS_ORDER[a.content.status ?? "UNKNOWN"] ?? 3) - (STATUS_ORDER[b.content.status ?? "UNKNOWN"] ?? 3) ||
          (b.content.startsOn ?? "").localeCompare(a.content.startsOn ?? ""),
    )
  const listing = useManagementRows(visible, JSON.stringify([search, status, tier, region, year, order]))
  const filtered = !!search.trim() || status !== "all" || !!tier || !!region || !!year
  const regions = useMemo(
    () => [...new Set((tournaments.data ?? []).map((entry) => entry.content.region))].sort(),
    [tournaments.data],
  )
  const years = useMemo(
    () =>
      [...new Set((tournaments.data ?? []).map((entry) => entry.content.year).filter((value) => value != null))]
        .sort((a, b) => Number(b) - Number(a))
        .map(String),
    [tournaments.data],
  )
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
  const error = tournaments.error ?? counters.error

  return (
    <EsportsPage>
      <PageHeader
        title="Giải đấu"
        actions={
          access.canWrite && (
            <>
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" /> Tạo giải đấu
              </Button>
              <PageActionsMenu label="Giải đấu: nhập dữ liệu">
                <DropdownMenuItem onSelect={() => setImporting(true)}>
                  <Upload />
                  Nhập dữ liệu
                </DropdownMenuItem>
              </PageActionsMenu>
            </>
          )
        }
      />

      <FilterTabs label="Trạng thái giải đấu">
        {STATUS_FILTERS.map((value) => (
          <FilterTab
            key={value}
            active={status === value}
            count={
              tournaments.data?.filter((entry) => value === "all" || (entry.content.status ?? "UNKNOWN") === value)
                .length
            }
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
              onChange={(event) => setOrder(event.target.value)}
              className={managementSelectClassName}
            >
              <option value="status">Ưu tiên trạng thái</option>
              <option value="name">Tên A–Z</option>
            </select>
          </ManagementToolbar>
          {visible.length ? (
            <TournamentList entries={listing.rows} stats={stats} onOpen={open} />
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
          <ManagementFooter count={visible.length} total={tournaments.data?.length ?? 0} noun="giải đấu" {...listing} />
        </ManagementPanel>
      )}

      {creating && (
        <RegistryEditor
          kind="tournaments"
          open
          onClose={() => setCreating(false)}
          teams={teams.data ?? []}
          tournaments={tournaments.data ?? []}
        />
      )}
      {importing && <RegistryImportSheet key={access.actorKey} onClose={() => setImporting(false)} />}
    </EsportsPage>
  )
}
