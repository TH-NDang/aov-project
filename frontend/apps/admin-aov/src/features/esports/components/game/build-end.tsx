import type { ReactNode } from "react"
import type { BuildStep } from "@aov/community-contracts"
import { cn } from "@aov/ui/lib/utils"
import { MAX_HELD, endSlots, itemKey, itemName, type ItemIndex } from "../../model/build"
import { ItemIcon, ItemMarks } from "./build-item"

/**
 * The six slots the game ended with, read from the path and never typed: the items of the build itself, then those
 * bought for protection behind a line. A slot nobody filled stays empty.
 */
export function BuildEnd({
  steps,
  index,
  borrowed,
  aside,
}: {
  steps: BuildStep[]
  index: ItemIndex
  /** The list is read off a snapshot. */
  borrowed: boolean
  /** At the end of the heading's line. */
  aside?: ReactNode
}) {
  const held = endSlots(steps, index)
  const core = held.filter((step) => step.role !== "PROTECTIVE")
  const protective = held.filter((step) => step.role === "PROTECTIVE")
  const free = Math.max(0, MAX_HELD - held.length)

  const slot = (step: BuildStep) => (
    <li key={itemKey(step.item, index)} className="relative inline-flex" title={itemName(step.item, index)}>
      <ItemIcon
        item={step.item}
        index={index}
        size={44}
        className={cn(
          "rounded-lg",
          borrowed && "outline-1 outline-offset-2 outline-muted-foreground/50 outline-dashed",
        )}
      />
      <ItemMarks item={step.item} index={index} protective={step.role === "PROTECTIVE"} />
    </li>
  )

  return (
    <section className="space-y-2" aria-label="Cuối ván" data-end>
      <header className="flex min-h-6 flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-sm font-semibold">Cuối ván</h4>
        <span className="type-meta">tự tính từ lộ trình</span>
        <span className={cn("esp-num type-meta", held.length > MAX_HELD && "text-destructive")}>
          {held.length}/{MAX_HELD}
        </span>
        {aside}
      </header>
      <ol className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
        {core.map(slot)}
        {core.length > 0 && protective.length > 0 && (
          <li aria-hidden="true" className="mx-0.5 h-8 w-px self-center bg-border" />
        )}
        {protective.map(slot)}
        {Array.from({ length: free }, (_, position) => (
          <li
            key={`free-${position}`}
            aria-label="Ô trống"
            className="size-11 rounded-lg border border-dashed border-muted-foreground/40"
          />
        ))}
      </ol>
    </section>
  )
}
