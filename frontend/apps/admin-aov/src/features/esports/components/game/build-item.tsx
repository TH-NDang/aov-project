import type { ComponentProps } from "react"
import type { BuildStep, Selection } from "@aov/community-contracts"
import { Check, TriangleAlert } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { formatClock } from "@/lib/clock"
import { itemKey, itemName, type ItemIndex } from "../../model/build"
import { initials } from "../../model/game-view"
import { Monogram } from "../primitives"

/** The picture of an item, or the letters of one the catalogue has no picture of; its name stands beside it. */
export function ItemIcon({
  item,
  index,
  size,
  className,
}: {
  item: Selection
  index: ItemIndex
  size: number
  className?: string
}) {
  return (
    <Monogram
      url={index.find(item)?.iconUrl}
      label=""
      text={initials(itemName(item, index)).slice(0, 2)}
      size={size}
      portrait
      className={cn("shrink-0 rounded-md", className)}
    />
  )
}

/** The mark of something chosen, over the corner of its picture. */
export function ChosenMark() {
  return (
    <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-foreground text-background">
      <Check size={11} strokeWidth={3} aria-hidden="true" />
    </span>
  )
}

/** A step in words: the item, what it was built from and when the player had it. */
export function stepLabel(step: BuildStep, index: ItemIndex) {
  const parts = (step.from ?? []).map((part) => itemName(part, index))
  return [
    itemName(step.item, index),
    parts.length ? `lên từ ${parts.join(" và ")}` : null,
    step.atSeconds != null ? `có lúc ${formatClock(step.atSeconds)}` : null,
  ]
    .filter(Boolean)
    .join(", ")
}

/** What went into an item, as small pictures over its lower left corner: from small to large, the way it was built. */
function Parts({ step, index, size }: { step: BuildStep; index: ItemIndex; size: number }) {
  if (!step.from?.length) return null
  return (
    <span className="absolute -bottom-1.5 -left-2 flex -space-x-1.5" data-parts={step.from.length}>
      {step.from.map((part) => (
        <ItemIcon
          key={itemKey(part, index)}
          item={part}
          index={index}
          size={size}
          className="rounded-sm ring-2 ring-popover"
        />
      ))}
    </span>
  )
}

/** Marks an item with something to fix; the reason stands under the lists. */
function ProblemMark() {
  return (
    <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-popover">
      <TriangleAlert size={14} className="text-(--aov-warning)" aria-hidden="true" />
    </span>
  )
}

type StepProps = Omit<ComponentProps<"button">, "children"> & {
  step: BuildStep
  index: ItemIndex
  problem?: boolean
}

/** One of the six slots, filled: the item with its parts, its name and the time the player had it. */
export function BuildTile({
  step,
  index,
  number,
  borrowed,
  problem,
  className,
  ...props
}: StepProps & {
  number: number
  /** Read off a snapshot rather than from a list of the player's own. */
  borrowed: boolean
}) {
  return (
    <button
      type="button"
      data-item={itemKey(step.item, index)}
      title={stepLabel(step, index)}
      aria-label={`Ô ${number}: ${stepLabel(step, index)}`}
      {...props}
      className={cn(
        "flex w-full min-w-0 flex-col items-center gap-2 rounded-lg px-0.5 pt-2 pb-1.5 text-center hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-muted",
        className,
      )}
    >
      <span className="relative inline-flex">
        <ItemIcon
          item={step.item}
          index={index}
          size={52}
          className={cn(
            "rounded-lg",
            borrowed && "outline-1 outline-offset-2 outline-muted-foreground/50 outline-dashed",
          )}
        />
        <Parts step={step} index={index} size={22} />
        {problem && <ProblemMark />}
      </span>
      <span className="line-clamp-3 min-h-8 w-full text-xs leading-4 text-balance">
        {itemName(step.item, index)}
        {step.atSeconds != null && (
          <>
            {" "}
            <span className="esp-num text-muted-foreground">{formatClock(step.atSeconds)}</span>
          </>
        )}
      </span>
    </button>
  )
}

/** An item of a list that grows: smaller than a slot, its name beside it. */
export function BuildChip({ step, index, problem, className, ...props }: StepProps) {
  return (
    <button
      type="button"
      data-item={itemKey(step.item, index)}
      title={stepLabel(step, index)}
      aria-label={stepLabel(step, index)}
      {...props}
      className={cn(
        "flex h-full min-h-12 w-full min-w-0 items-center gap-3 rounded-lg border px-2 py-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-muted",
        className,
      )}
    >
      <span className="relative inline-flex">
        <ItemIcon item={step.item} index={index} size={32} className={cn(step.place === "REPLACED" && "opacity-75")} />
        <Parts step={step} index={index} size={16} />
        {problem && <ProblemMark />}
      </span>
      <span className="min-w-0 text-xs leading-4">
        <span className="line-clamp-2 font-semibold">{itemName(step.item, index)}</span>
        {step.atSeconds != null && <span className="esp-num text-muted-foreground">{formatClock(step.atSeconds)}</span>}
      </span>
    </button>
  )
}

/** An item as a choice: its picture over its name, marked while it is chosen. */
export function ItemButton({
  item,
  index,
  pressed,
  note,
  onClick,
}: {
  item: Selection
  index: ItemIndex
  /** Left out where a press does something once instead of choosing. */
  pressed?: boolean
  /** Under the name. */
  note?: string
  onClick: () => void
}) {
  const name = itemName(item, index)
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={note ? `${name}, ${note}` : name}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1 rounded-md px-0.5 py-1.5 text-center text-xs leading-tight hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        pressed && "bg-foreground/10",
      )}
    >
      <span className="relative inline-flex">
        <ItemIcon item={item} index={index} size={36} className={cn(pressed === false && "opacity-60")} />
        {pressed && <ChosenMark />}
      </span>
      <span className="line-clamp-2 w-full text-balance">{name}</span>
      {note && <span className="w-full truncate text-muted-foreground">{note}</span>}
    </button>
  )
}
