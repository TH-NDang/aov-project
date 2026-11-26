import { Tip } from "./stream-tip"
import { useStreamLocale } from "./stream-locale"
import "./captain-badge.css"

/** A small round "C" after a captain's name, named on its tooltip and to a screen reader. */
export function CaptainBadge() {
  const { text } = useStreamLocale()
  const label = text("Đội trưởng", "Captain")
  return (
    <Tip label={label}>
      <span className="hub-captain" role="img" aria-label={label}>
        C
      </span>
    </Tip>
  )
}
