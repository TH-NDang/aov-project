import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import type { DocumentView, TournamentContent } from "@aov/community-contracts"
import { Plus, Trophy, Upload, UserRound, Users } from "lucide-react"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { FilterTab, FilterTabs } from "@/components/filter-tabs"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { SearchField } from "@/components/search-field"
import { RegistryEditor } from "@/features/tournaments/registry-editor"
import { RegistryImportSheet } from "@/features/tournaments/registry-import"
import { useRecords } from "../data/use-esports-data"
import { EmptyState } from "../components/primitives"
import { TournamentCard, type TournamentStats } from "../components/tournament-cards"
import { STATUS_LABELS, TIER_LABELS } from "../model/labels"
import { AccessGate, EsportsPage, LoadError, tournamentPath, type Access } from "./esports-shell"

type StatusFilter = "all" | "ONGOING" | "UPCOMING" | "FINISHED"
const STATUS_FILTERS: StatusFilter[] = ["all", "ONGOING", "UPCOMING", "FINISHED"]
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
  const status = (STATUS_FILTERS.find((value) => value === params.get("status")) ?? "all") as StatusFilter
  const tier = params.get("tier") ?? ""
  const tournaments = useRecords("tournaments")
  const series = useRecords("series")
  const teams = useRecords("teams")

  const stats = useMemo(() => {
    const result = new Map<string, TournamentStats>()
    for (const entry of series.data ?? []) {
      const current = result.get(entry.content.tournamentId) ?? { teams: 0, matches: 0, played: 0 }
      current.matches++
      if (entry.content.result) current.played++
      result.set(entry.content.tournamentId, current)
    }
    for (const [tournamentId, value] of result)
      value.teams = new Set(
        (series.data ?? [])
          .filter((entry) => entry.content.tournamentId === tournamentId)
          .flatMap((entry) => [entry.content.teamAId, entry.content.teamBId]),
      ).size
    return result
  }, [series.data])

  const visible = (tournaments.data ?? [])
    .filter((entry) => status === "all" || (entry.content.status ?? "UNKNOWN") === status)
    .filter((entry) => !tier || entry.content.tier === tier)
    .filter((entry) =>
      `${entry.content.name} ${entry.content.code} ${entry.content.region}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.content.status ?? "UNKNOWN"] ?? 3) - (STATUS_ORDER[b.content.status ?? "UNKNOWN"] ?? 3) ||
        (b.content.startsOn ?? "").localeCompare(a.content.startsOn ?? ""),
    )
  const tiers = [
    ...new Set((tournaments.data ?? []).map((entry) => entry.content.tier).filter(Boolean)),
  ] as NonNullable<TournamentContent["tier"]>[]
  const setFilter = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value && value !== "all") next.set(key, value)
      else next.delete(key)
      return next
    })
  const open = (entry: DocumentView<TournamentContent>) => navigate(tournamentPath(entry.id))
  const error = tournaments.error ?? series.error

  return (
    <EsportsPage>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Trophy size={20} className="shrink-0 text-[var(--esp-gold)]" /> Giải đấu
          </span>
        }
        search={
          <SearchField
            placement="header"
            label="Tìm giải"
            placeholder="Tìm giải…"
            shortcut
            value={search}
            onChange={setSearch}
          />
        }
        actions={
          <PageActionsMenu label="Giải đấu: tạo, nhập, đội tuyển và tuyển thủ">
            {access.canWrite && (
              <>
                <DropdownMenuItem onSelect={() => setCreating(true)}>
                  <Plus />
                  Tạo giải
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setImporting(true)}>
                  <Upload />
                  Nhập dữ liệu
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link to="/teams">
                <Users />
                Đội tuyển
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/players">
                <UserRound />
                Tuyển thủ
              </Link>
            </DropdownMenuItem>
          </PageActionsMenu>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterTabs label="Trạng thái">
          {STATUS_FILTERS.map((value) => (
            <FilterTab key={value} active={status === value} onClick={() => setFilter("status", value)}>
              {value === "all" ? "Tất cả" : STATUS_LABELS[value]}
            </FilterTab>
          ))}
        </FilterTabs>
        {tiers.length > 1 && (
          <select
            aria-label="Hạng giải"
            value={tier}
            onChange={(event) => setFilter("tier", event.target.value)}
            className="h-10 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="">Mọi hạng</option>
            {tiers.map((value) => (
              <option key={value} value={value}>
                {TIER_LABELS[value]}
              </option>
            ))}
          </select>
        )}
      </div>

      {error ? (
        <LoadError error={error} onRetry={() => void Promise.all([tournaments.refetch(), series.refetch()])} />
      ) : tournaments.isPending ? (
        <div className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-60 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : visible.length ? (
        <div className="grid gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
          {visible.map((entry, index) => (
            <TournamentCard
              key={entry.id}
              content={entry.content}
              stats={stats.get(entry.id) ?? { teams: 0, matches: 0, played: 0 }}
              featured={index === 0 && entry.content.status === "ONGOING" && status === "all" && !search}
              onOpen={() => open(entry)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Trophy size={28} />}
          title={search || status !== "all" ? "Không có giải phù hợp" : "Chưa có giải đấu"}
        >
          {access.canWrite && !tournaments.data?.length
            ? `Tạo giải, sau đó thêm đội (${teams.data?.length ?? 0} đội đã có) và lịch thi đấu.`
            : "Thử bỏ bớt bộ lọc."}
        </EmptyState>
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
