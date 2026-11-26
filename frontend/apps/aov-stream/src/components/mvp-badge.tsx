import { Tip } from "./stream-tip"
import "./mvp-badge.css"

/**
 * The word MVP on a small gold plate, which reads at once where a star or a spark had to be learnt. `label` says whose
 * MVP it is (of a game, of a match), on the plate's tooltip and to a screen reader.
 */
export function MvpBadge({
  label,
  size = "small",
  className = "",
}: {
  label: string
  size?: "small" | "large"
  /** Where the plate stands, set by the sheet of what holds it. */
  className?: string
}) {
  return (
    <Tip label={label}>
      <span className={`hub-mvp ${className}`.trim()} data-size={size} role="img" aria-label={label}>
        MVP
      </span>
    </Tip>
  )
}
