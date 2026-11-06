import { useEffect, useRef } from "react"

export type PublicTab<Key extends string = string> = {
  key: Key
  label: string
  count?: number
  /** Shows a dot, for a tab holding something new. */
  marked?: boolean
}

/**
 * Splits a long page into parts on a compact layout, pinned under the header. The row scrolls sideways rather than
 * wrapping, and keeps the chosen tab in view.
 */
export function PublicTabBar<Key extends string>({
  label,
  tabs,
  active,
  panelId,
  onSelect,
}: {
  label: string
  tabs: readonly PublicTab<Key>[]
  active: Key
  panelId?: string
  onSelect: (key: Key) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = bar.current
    const chosen = row?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!row || !chosen) return
    // Moves this row only: scrollIntoView would also scroll the page, which a pinned bar must not do.
    row.scrollLeft = chosen.offsetLeft - (row.clientWidth - chosen.offsetWidth) / 2
  }, [active])
  return (
    <div ref={bar} className="public-tab-bar" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          aria-controls={panelId}
          data-marked={tab.marked || undefined}
          onClick={() => onSelect(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="public-tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}
