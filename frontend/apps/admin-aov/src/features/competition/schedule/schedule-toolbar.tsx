import { NativeSelect } from "@/components/native-select"
import { cn } from "@aov/ui/lib/utils"
import { MATCH_FILTERS, MATCH_FILTER_LABELS, type MatchFilter } from "../model/schedule-model"
import type { Workspace } from "../workspace/parts"

/** Whose matches are listed. */
export function TeamFilter({
  ws,
  teamIds,
  teamId,
  onTeam,
}: {
  ws: Workspace
  teamIds: string[]
  teamId: string
  onTeam: (teamId: string) => void
}) {
  return (
    <NativeSelect
      aria-label="Lọc theo đội"
      className="w-full"
      value={teamId}
      onChange={(event) => onTeam(event.target.value)}
    >
      <option value="">Tất cả đội</option>
      {teamIds.map((id) => (
        <option key={id} value={id}>
          {ws.team(id).name}
        </option>
      ))}
    </NativeSelect>
  )
}

/**
 * What the listed matches still need. A filter with nothing in it is left out. On a phone the chips keep one line and
 * scroll sideways, so they never push the matches down.
 */
export function NeedFilter({
  filter,
  counts,
  scroll,
  onFilter,
}: {
  filter: MatchFilter
  counts: Record<MatchFilter, number>
  scroll?: boolean
  onFilter: (filter: MatchFilter) => void
}) {
  const shown = MATCH_FILTERS.filter((value) => value === "ALL" || value === filter || counts[value] > 0)
  if (shown.length < 2) return null
  return (
    <div
      className={cn(
        "flex min-w-0 gap-1.5",
        scroll ? "-mx-4 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden" : "flex-wrap",
      )}
      role="group"
      aria-label="Lọc trận theo việc còn thiếu"
    >
      {shown.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={filter === value}
          onClick={() => onFilter(filter === value ? "ALL" : value)}
          className={cn(
            "type-label inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 whitespace-nowrap transition-colors",
            filter === value
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {MATCH_FILTER_LABELS[value]}
          <span className="tabular-nums opacity-80">{counts[value]}</span>
        </button>
      ))}
    </div>
  )
}
