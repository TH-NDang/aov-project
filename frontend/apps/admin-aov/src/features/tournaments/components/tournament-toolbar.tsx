import { ArrowDownWideNarrow, CalendarRange, CircleDot, MapPin, Medal } from "lucide-react"
import type { TournamentFacets } from "@aov/community-contracts"
import { STATUS_LABELS, TIER_LABELS, regionName } from "@/features/esports/model/labels"
import type { TournamentSort } from "../api/tournament-api"
import { facetOptions } from "../model/facet-options"
import { FilterSelect } from "./filter-select"
import { ManagementToolbar } from "./management-list"

/** How the list is laid out: the seasons of each circuit together, or one list in the server's order. */
export type TournamentLayout = "CIRCUIT" | TournamentSort

export const TOURNAMENT_LAYOUTS: Record<TournamentLayout, string> = {
  CIRCUIT: "Theo hệ thống giải",
  RECENT: "Gần đây trước",
  STATUS: "Ưu tiên trạng thái",
  NAME: "Tên A–Z",
}

export type TournamentFilterKey = "status" | "tier" | "region" | "year" | "sort"

/** The search and filters of the tournament list; a filter without a value shows everything. */
export function TournamentToolbar({
  search,
  onSearchChange,
  values,
  facets,
  onFilter,
  onReset,
}: {
  search: string
  onSearchChange: (value: string) => void
  values: Record<TournamentFilterKey, string>
  /** What each filter can still find; missing while the counts are on their way. */
  facets?: TournamentFacets
  onFilter: (key: TournamentFilterKey, value: string) => void
  onReset?: () => void
}) {
  const { status, tier, region, year, sort } = values
  return (
    <ManagementToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchLabel="Tìm giải đấu"
      placeholder="Tên giải đấu, mã hoặc khu vực…"
      onReset={onReset}
    >
      <FilterSelect
        icon={CircleDot}
        label="Trạng thái giải đấu"
        every="Mọi trạng thái"
        value={status}
        options={facetOptions(
          facets?.statuses,
          status,
          (value) => STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value,
          { order: Object.keys(STATUS_LABELS) },
        )}
        onChange={(value) => onFilter("status", value)}
      />
      <FilterSelect
        icon={Medal}
        label="Hạng giải"
        every="Mọi hạng giải"
        value={tier}
        options={facetOptions(facets?.tiers, tier, (value) => TIER_LABELS[value as keyof typeof TIER_LABELS] ?? value, {
          order: Object.keys(TIER_LABELS),
        })}
        onChange={(value) => onFilter("tier", value)}
      />
      <FilterSelect
        icon={MapPin}
        label="Khu vực giải đấu"
        every="Mọi khu vực"
        value={region}
        options={facetOptions(facets?.regions, region, regionName)}
        onChange={(value) => onFilter("region", value)}
      />
      <FilterSelect
        icon={CalendarRange}
        label="Năm giải đấu"
        every="Mọi năm"
        value={year}
        options={facetOptions(facets?.years, year, (value) => value, { compare: (a, b) => Number(b) - Number(a) })}
        onChange={(value) => onFilter("year", value)}
      />
      <FilterSelect
        icon={ArrowDownWideNarrow}
        label="Sắp xếp giải đấu"
        value={sort}
        options={Object.entries(TOURNAMENT_LAYOUTS)}
        onChange={(value) => onFilter("sort", value)}
      />
    </ManagementToolbar>
  )
}
