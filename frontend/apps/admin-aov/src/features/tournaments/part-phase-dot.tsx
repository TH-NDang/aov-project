import { cn } from "@aov/ui/lib/utils"
import type { PartPhase } from "./tournament-parts"

export const PART_PHASE_NAMES: Partial<Record<PartPhase, string>> = {
  ongoing: "Đang diễn ra",
  upcoming: "Sắp diễn ra",
}

/** A dot for a part that is running or about to start; parts that are over or undated carry none. */
export function PartPhaseDot({ phase }: { phase: PartPhase }) {
  const name = PART_PHASE_NAMES[phase]
  if (!name) return null
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        phase === "ongoing" ? "bg-[var(--aov-success)]" : "bg-[var(--aov-warning)]",
      )}
      role="img"
      aria-label={name}
      title={name}
    />
  )
}
