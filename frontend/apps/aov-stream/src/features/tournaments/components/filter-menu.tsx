import { PublicFilterSheet } from "@aov/ui/components/public-filter-sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import type { FilterOption } from "./schedule-controls"
import "./filter-menu.css"

/** One filter of a list: what it narrows by, the choice in use ("all" for none) and what it offers. */
export type FilterGroup = {
  key: string
  label: string
  value: string
  options: readonly FilterOption[]
}

/** A filter with a single choice narrows nothing, so it is only offered while that choice is in use. */
const offered = (groups: FilterGroup[]) => groups.filter((group) => group.options.length > 1 || group.value !== "all")
const chosen = (groups: FilterGroup[]) => groups.filter((group) => group.value !== "all")

type Change = (key: string, value: string) => void

/** Every filter as a line of chips; the chip in use lets go when pressed again. */
function Groups({ groups, onChange }: { groups: FilterGroup[]; onChange: Change }) {
  return (
    <div className="tn-filter-groups">
      {offered(groups).map((group) => (
        <section key={group.key} role="group" aria-label={group.label}>
          <h3>{group.label}</h3>
          <div>
            {group.options.map(([value, name, mark]) => (
              <button
                key={value}
                type="button"
                aria-pressed={group.value === value}
                onClick={() => onChange(group.key, group.value === value ? "all" : value)}
              >
                {mark}
                {name}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * The filters of a list behind one button: a panel under it, or a sheet on phones. Choices apply as they are made;
 * the foot says how many results they leave.
 */
export function FilterMenu({
  title,
  groups,
  result,
  onChange,
  onReset,
  className,
  align = "end",
}: {
  title: string
  groups: FilterGroup[]
  /** How many results the filters leave, as the words on the button, such as a count of matches. */
  result: string
  onChange: Change
  onReset: () => void
  /** Places the button in its bar. */
  className?: string
  /** The edge of the button the panel lines up with: the one at its end of the bar. */
  align?: "start" | "end"
}) {
  const { text } = useStreamLocale()
  const layout = usePageLayout()
  const count = chosen(groups).length
  const label = text("Lọc", "Filter")
  const reset = text("Xóa lọc", "Clear filters")
  if (!offered(groups).length) return null
  if (layout === "compact")
    return (
      <PublicFilterSheet
        title={title}
        triggerLabel={label}
        triggerClassName={className}
        count={count}
        resetLabel={reset}
        onReset={onReset}
        resultLabel={text(`Xem ${result}`, `Show ${result}`)}
      >
        <Groups groups={groups} onChange={onChange} />
      </PublicFilterSheet>
    )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={className ? `tn-filter-button ${className}` : "tn-filter-button"}
          data-active={count > 0 || undefined}
        >
          <StreamIcon name="filter" size={16} />
          {label}
          {count > 0 && <b>{count}</b>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        drawerTitle={title}
        align={align}
        sideOffset={8}
        collisionPadding={16}
        className="hub-popover tn-filter-panel"
      >
        <Groups groups={groups} onChange={onChange} />
        <footer className="tn-filter-foot">
          <span>{result}</span>
          <button type="button" disabled={count === 0} onClick={onReset}>
            {reset}
          </button>
        </footer>
      </PopoverContent>
    </Popover>
  )
}

/** The filters in use, each a chip that lets go of it; nothing while none is. */
export function FilterTokens({
  groups,
  onChange,
  onReset,
}: {
  groups: FilterGroup[]
  onChange: Change
  onReset: () => void
}) {
  const { text } = useStreamLocale()
  const used = chosen(groups)
  if (!used.length) return null
  return (
    <div className="tn-filter-tokens" role="group" aria-label={text("Bộ lọc đang dùng", "Filters in use")}>
      {used.map((group) => {
        const option = group.options.find(([value]) => value === group.value)
        const name = option?.[1] ?? group.value
        return (
          <button
            key={group.key}
            type="button"
            aria-label={text(`Bỏ lọc ${group.label}: ${name}`, `Remove the filter ${group.label}: ${name}`)}
            onClick={() => onChange(group.key, "all")}
          >
            {option?.[2]}
            {name}
            <StreamIcon name="close" size={14} />
          </button>
        )
      })}
      {used.length > 1 && (
        <button type="button" data-clear="" onClick={onReset}>
          {text("Xóa lọc", "Clear filters")}
        </button>
      )}
    </div>
  )
}
