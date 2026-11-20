import { ItemStatBadge } from "@aov/ui/components/warehouse/item-stat-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import type { ItemStatFilterDefinition } from "@aov/ui/lib/item-description"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiText } from "../../context/wiki-context"
import type { ItemCatalogView } from "./use-item-catalog"
import "./warehouse-stat-filter.css"

/** A stat's mark: its icon in its own colour on a soft disc of that colour. */
export function StatBadge({ filter, size = 28 }: { filter: ItemStatFilterDefinition; size?: number }) {
  return <ItemStatBadge group={filter.key} size={size} />
}

function toggled(values: readonly string[], value: string) {
  return values.includes(value) ? values.filter((current) => current !== value) : [...values, value]
}

/**
 * The stat filter of the item catalog on wide screens: one button on the toolbar that opens every stat with how many
 * items it would leave. The stats chosen show as chips under the toolbar, each one a tap from being taken off.
 */
export function StatFilterButton({ view, options }: { view: ItemCatalogView; options: ItemStatFilterDefinition[] }) {
  const text = useWikiText()
  const chosen = view.stats.length
  return (
    <Popover>
      <PopoverTrigger className="wiki-stat-filter-trigger" data-active={chosen > 0 || undefined}>
        <WikiIcon name="settings" size={18} />
        {text("Chỉ số", "Stats")}
        {chosen > 0 && <span className="wiki-stat-filter-count">{chosen}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="wiki-stat-filter-panel">
        <div className="wiki-stat-filter-head">
          <strong>{text("Lọc theo chỉ số", "Filter by stat")}</strong>
          <span>{text("Chỉ giữ trang bị có đủ các chỉ số đã chọn.", "Keeps items that have every stat chosen.")}</span>
        </div>
        <div className="wiki-stat-filter-grid" role="group" aria-label={text("Chỉ số", "Stats")}>
          {options.map((filter) => {
            const pressed = view.stats.includes(filter.key)
            const count = view.counts[filter.key] ?? 0
            return (
              <button
                key={filter.key}
                type="button"
                className="wiki-stat-filter-choice"
                aria-pressed={pressed}
                disabled={!pressed && count === 0}
                onClick={() => view.setStats(toggled(view.stats, filter.key))}
              >
                <StatBadge filter={filter} size={28} />
                <span className="wiki-stat-filter-name">{text(filter.vi, filter.en)}</span>
                <small>{count}</small>
              </button>
            )
          })}
        </div>
        {chosen > 0 && (
          <button type="button" className="wiki-stat-filter-reset" onClick={() => view.setStats([])}>
            {text("Xóa lọc chỉ số", "Clear stat filters")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** The stats being filtered on, under the toolbar; each chip takes its stat off. */
export function ChosenStats({ view, options }: { view: ItemCatalogView; options: ItemStatFilterDefinition[] }) {
  const text = useWikiText()
  const chosen = options.filter((filter) => view.stats.includes(filter.key))
  if (!chosen.length) return null
  return (
    <div className="wiki-stat-chosen" role="group" aria-label={text("Chỉ số đang lọc", "Stats filtered on")}>
      {chosen.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className="wiki-stat-chosen-chip"
          aria-label={text(`Bỏ lọc ${filter.vi}`, `Remove ${filter.en}`)}
          onClick={() => view.setStats(view.stats.filter((key) => key !== filter.key))}
        >
          <StatBadge filter={filter} size={22} />
          {text(filter.vi, filter.en)}
          <WikiIcon name="close" size={14} />
        </button>
      ))}
      {chosen.length > 1 && (
        <button type="button" className="wiki-stat-chosen-clear" onClick={() => view.setStats([])}>
          {text("Xóa tất cả", "Clear all")}
        </button>
      )}
    </div>
  )
}
