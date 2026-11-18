import { useState, type ReactNode } from "react"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { PublicDrawer, PublicDrawerContent } from "./public-overlay"

/**
 * Filters on a compact layout: one button beside the search, so the results start on the first screen, and every
 * control in a bottom sheet. Filters apply as they are chosen; the sheet's button only says what was found.
 */
export function PublicFilterSheet({
  title,
  triggerLabel,
  count,
  resetLabel,
  onReset,
  resultLabel,
  triggerClassName,
  children,
}: {
  title: string
  triggerLabel: string
  /** Places the button in the bar that holds it. */
  triggerClassName?: string
  /** How many filters are on. */
  count: number
  resetLabel: string
  onReset: () => void
  resultLabel: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={cn("public-filter-button", triggerClassName)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-active={count > 0 || undefined}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {triggerLabel}
        {count > 0 && <span className="public-filter-count">{count}</span>}
      </button>
      <PublicDrawer open={open} onOpenChange={setOpen}>
        <PublicDrawerContent title={title} aria-describedby={undefined}>
          <div className="public-filter-body">{children}</div>
          <div className="public-filter-actions">
            <button type="button" disabled={count === 0} onClick={onReset}>
              {resetLabel}
            </button>
            <button type="button" data-primary onClick={() => setOpen(false)}>
              {resultLabel}
            </button>
          </div>
        </PublicDrawerContent>
      </PublicDrawer>
    </>
  )
}
