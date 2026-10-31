import type { ComponentProps, ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"

/**
 * A row of single-choice filters with the look of the page tab strips. It scrolls sideways instead of wrapping and
 * keeps toggle-button semantics (`aria-pressed`) inside a labelled group.
 */
export function FilterTabs({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex w-fit max-w-full min-w-0 shrink-0 gap-1 overflow-x-auto overscroll-x-contain rounded-xl border bg-muted/40 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** One option of `FilterTabs`; `count` shows how many entries the option holds. */
export function FilterTab({
  active,
  count,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { active: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>}
    </button>
  )
}
