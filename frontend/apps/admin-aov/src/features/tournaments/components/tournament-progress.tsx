import { cn } from "@aov/ui/lib/utils"

/** How many matches of a tournament are played, as a thin bar that turns green once all are; the figures sit beside it. */
export function ProgressBar({ played, matches }: { played: number; matches: number }) {
  const done = matches > 0 && played >= matches
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <span
        className={cn("block h-full rounded-full", done ? "bg-(--aov-success)" : "bg-primary")}
        style={{ width: `${matches ? Math.min(100, (played / matches) * 100) : 0}%` }}
      />
    </span>
  )
}
