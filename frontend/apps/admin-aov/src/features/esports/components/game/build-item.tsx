import type { BuildStep, Selection } from "@aov/community-contracts"
import { Check, Shield, TriangleAlert, Zap } from "lucide-react"
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
  const gone = (step.replaces ?? []).map((entry) => itemName(entry, index))
  return [
    itemName(step.item, index),
    step.role === "PROTECTIVE" ? "bảo hộ" : null,
    parts.length ? `lên từ ${parts.join(" và ")}` : null,
    gone.length ? `bán ${gone.join(" và ")} để lấy` : null,
    step.atSeconds != null ? `có lúc ${formatClock(step.atSeconds)}` : null,
  ]
    .filter(Boolean)
    .join(", ")
}

/** What went into an item, as small pictures over its lower left corner: from small to large, the way it was built. */
export function Parts({ step, index, size }: { step: BuildStep; index: ItemIndex; size: number }) {
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
export function ProblemMark() {
  return (
    <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-popover">
      <TriangleAlert size={14} className="text-(--aov-warning)" aria-hidden="true" />
    </span>
  )
}

/**
 * The marks over the picture of an item: a bolt where the Wiki gives it an active effect, a shield where it was bought
 * for protection. Both say nothing of the other: an active item may be the build itself.
 */
export function ItemMarks({ item, index, protective }: { item: Selection; index: ItemIndex; protective?: boolean }) {
  return (
    <>
      {index.find(item)?.active && (
        <span
          className="absolute -top-1.5 -right-1.5 grid size-4.5 place-items-center rounded-full bg-(--aov-game-gold) text-(--aov-on-medal) ring-2 ring-popover"
          title="Có kích hoạt"
          data-mark="active"
        >
          <Zap size={10} strokeWidth={3} fill="currentColor" aria-hidden="true" />
        </span>
      )}
      {protective && (
        <span
          className="absolute -bottom-1.5 -left-1.5 grid size-4.5 place-items-center rounded-full bg-(--aov-info) text-background ring-2 ring-popover"
          title="Bảo hộ"
          data-mark="protective"
        >
          <Shield size={10} strokeWidth={3} fill="currentColor" aria-hidden="true" />
        </span>
      )}
    </>
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
