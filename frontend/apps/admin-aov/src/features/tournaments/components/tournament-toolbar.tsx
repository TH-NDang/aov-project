import { NativeSelect } from "@/components/native-select"
import { TIER_LABELS, regionName } from "@/features/esports/model/labels"
import type { TournamentSort } from "../api/tournament-api"
import { ManagementToolbar } from "./management-list"

export const TOURNAMENT_SORTS: Record<TournamentSort, string> = {
  RECENT: "Gần đây trước",
  STATUS: "Ưu tiên trạng thái",
  NAME: "Tên A–Z",
}

export type TournamentFilterKey = "tier" | "region" | "year" | "sort"

/** The search and filters of the tournament list; a filter without a value shows everything. */
export function TournamentToolbar({
  search,
  onSearchChange,
  values,
  regions,
  years,
  onFilter,
  onReset,
}: {
  search: string
  onSearchChange: (value: string) => void
  values: Record<TournamentFilterKey, string>
  regions: string[]
  years: string[]
  onFilter: (key: TournamentFilterKey, value: string) => void
  onReset?: () => void
}) {
  const filters: { key: TournamentFilterKey; label: string; every?: string; options: [string, string][] }[] = [
    { key: "tier", label: "Hạng giải", every: "Mọi hạng giải", options: Object.entries(TIER_LABELS) },
    {
      key: "region",
      label: "Khu vực giải đấu",
      every: "Mọi khu vực",
      options: regions.map((value) => [value, regionName(value)]),
    },
    { key: "year", label: "Năm giải đấu", every: "Mọi năm", options: years.map((value) => [value, value]) },
    { key: "sort", label: "Sắp xếp giải đấu", options: Object.entries(TOURNAMENT_SORTS) },
  ]
  return (
    <ManagementToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchLabel="Tìm giải đấu"
      placeholder="Tên giải đấu, mã hoặc khu vực…"
      onReset={onReset}
    >
      {filters.map(({ key, label, every, options }) => (
        <NativeSelect
          key={key}
          aria-label={label}
          value={values[key]}
          onChange={(event) => onFilter(key, event.target.value)}
          className="max-w-full"
        >
          {every && <option value="">{every}</option>}
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </NativeSelect>
      ))}
    </ManagementToolbar>
  )
}
