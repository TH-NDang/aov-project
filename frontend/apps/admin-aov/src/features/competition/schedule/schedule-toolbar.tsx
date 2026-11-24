import { NativeSelect } from "@/components/native-select"
import { cn } from "@aov/ui/lib/utils"
import { MATCH_FILTERS, MATCH_FILTER_LABELS, type MatchFilter } from "../model/schedule-model"
import type { Workspace } from "../workspace/parts"

/** One of a few views of the same list; the pressed one is the one on screen. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "type-label h-8 rounded px-3 whitespace-nowrap",
            value === option ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** Whose matches are listed and what they still need. A filter with nothing in it is left out. */
export function ScheduleToolbar({
  ws,
  teamIds,
  teamId,
  filter,
  counts,
  onTeam,
  onFilter,
  children,
}: {
  ws: Workspace
  teamIds: string[]
  teamId: string
  filter: MatchFilter
  counts: Record<MatchFilter, number>
  onTeam: (teamId: string) => void
  onFilter: (filter: MatchFilter) => void
  children?: React.ReactNode
}) {
  const shown = MATCH_FILTERS.filter((value) => value === "ALL" || value === filter || counts[value] > 0)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Lọc theo đội"
        className="w-full sm:w-44"
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
      {shown.length > 1 && (
        <div
          className="flex min-w-0 basis-full flex-wrap gap-1.5 sm:flex-1 sm:basis-0"
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
                "type-label inline-flex h-8 items-center gap-1.5 rounded-full border px-3 whitespace-nowrap transition-colors",
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
      )}
      {children}
    </div>
  )
}
