import type { Participant } from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import type { ItemIndex } from "../../model/build"
import { SEAT_PARTS, partState } from "../../model/seat-progress"

/** Four dots for spell, emblems, arcana and items: filled when recorded, hollow when not shown, faint when missing. */
export function SeatDots({
  participant,
  duration,
  index,
}: {
  participant: Participant
  /** How long the game lasted, when known. */
  duration?: number | null
  index: ItemIndex
}) {
  return (
    <span className="flex justify-center gap-0.5" aria-hidden="true">
      {SEAT_PARTS.map((part) => {
        const state = partState(participant, part, duration, index)
        return (
          <span
            key={part}
            data-state={state}
            className={cn(
              "size-[var(--dot,5px)] rounded-full",
              state === "done" && "bg-foreground",
              state === "partial" && "bg-muted-foreground",
              state === "hidden" && "ring-1 ring-muted-foreground ring-inset",
              state === "todo" && "bg-muted-foreground/25",
            )}
          />
        )
      })}
    </span>
  )
}
