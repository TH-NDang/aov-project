import type { Ref } from "react"
import type { Fold } from "../lib/use-fold"
import { useHeldPlace } from "../lib/use-held-place"
import { StreamIcon } from "./stream-icon"
import { useStreamLocale } from "./stream-locale"
import "./fold-button.css"

/**
 * Unfolds the rest of a list in its place, and folds it again; `more` says what comes. Folding keeps the button where
 * it was pressed while the rows above it go; unfolding leaves the page as it is, so the rows it brings follow the last
 * one read.
 */
export function FoldButton({ fold, more, ref }: { fold: Fold; more: string; ref?: Ref<HTMLButtonElement> }) {
  const { text } = useStreamLocale()
  const hold = useHeldPlace(String(fold.open))
  if (!fold.folds) return null
  const toggle = (button: HTMLButtonElement) => {
    if (fold.open) hold(button)
    fold.toggle()
  }
  return (
    <button
      ref={ref}
      type="button"
      className="tn-more"
      aria-expanded={fold.open}
      onClick={(event) => toggle(event.currentTarget)}
    >
      {fold.open ? text("Thu gọn", "Show less") : more}
      <StreamIcon name={fold.open ? "chevronLeft" : "chevronRight"} size={14} />
    </button>
  )
}

/** The same in a grid of pictures, in the place of the next one: how many more there are, which `label` says in words. */
export function FoldTile({
  rest,
  unit,
  label,
  onOpen,
}: {
  rest: number
  unit: string
  label: string
  onOpen: () => void
}) {
  return (
    <button type="button" className="tn-more-tile" aria-expanded={false} aria-label={label} onClick={onOpen}>
      <span>+{rest}</span>
      <small>{unit}</small>
    </button>
  )
}
